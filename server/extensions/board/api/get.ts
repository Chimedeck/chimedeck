// GET /api/v1/boards/:id — get a single board with shallow lists and cards.
// PUBLIC boards: no auth required. WORKSPACE/PRIVATE: min role VIEWER.
import { db } from '../../../common/db';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';
import { VISIBLE_EVENT_TYPES } from '../../activity/config/visibleEventTypes';
import { buildAvatarProxyUrlsInCollection } from '../../../common/avatar/resolveAvatarUrl';
import { searchLog } from '../../search/common/searchLogger';
import { resolveCoverImageUrls } from '../../../common/cards/cover';
import { resolveBackgroundUrl } from '../common/resolveBackgroundUrl';
import { flags } from '../../../mods/flags';

export async function handleGetBoard(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) {
    const scopedForLog = req as Partial<BoardVisibilityScopedRequest>;
    searchLog.boardAccessChecked({
      boardId,
      userId: (scopedForLog.currentUser as { id?: string } | undefined)?.id,
      visibility: 'unknown',
      callerRole: scopedForLog.callerRole,
      result: 'denied',
      statusCode: visibilityError.status,
    });
    return visibilityError;
  }

  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board!;
  const resolvedBoardId = board.id;

  searchLog.boardAccessChecked({
    boardId,
    userId: (scopedReq.currentUser as { id?: string } | undefined)?.id,
    visibility: board.visibility,
    callerRole: scopedReq.callerRole,
    result: 'allowed',
    statusCode: 200,
  });

  const url = new URL(req.url);

  // Load active lists now that the lists table exists (sprint 06)
  const lists = await db('lists')
    .where({ board_id: resolvedBoardId, archived: false })
    .orderBy('position', 'asc');

  const listIds = lists.map((l: { id: string }) => l.id);
  const incrementalEnabled = await flags.isEnabled('INCREMENTAL_BOARD_HYDRATION');
  const requestedInitialCardsPerList = Number.parseInt(url.searchParams.get('initialCardsPerList') ?? '0', 10);
  const initialCardsPerList =
    incrementalEnabled && Number.isFinite(requestedInitialCardsPerList) && requestedInitialCardsPerList > 0
      ? Math.min(requestedInitialCardsPerList, 100)
      : null;

  async function loadCards(cardIds?: string[]): Promise<Array<Record<string, unknown>>> {
    if (listIds.length === 0) return [];

    const commentCountsQuery = db('comments')
      .select('card_id')
      .count('* as comment_count')
      .where({ deleted: false })
      .groupBy('card_id')
      .as('cc');

    const attachmentCountsQuery = db('attachments')
      .select('card_id')
      .select(
        db.raw(`SUM(CASE WHEN status = 'READY' AND referenced_card_id IS NULL THEN 1 ELSE 0 END) as attachment_count`),
        db.raw(`SUM(CASE WHEN status = 'READY' AND referenced_card_id IS NOT NULL THEN 1 ELSE 0 END) as linked_card_count`),
      )
      .groupBy('card_id')
      .as('ac');

    const checklistCountsQuery = db('checklists as ch')
      .join('checklist_items as ci', 'ci.checklist_id', 'ch.id')
      .select('ch.card_id')
      .count('* as checklist_total')
      .sum({ checklist_done: db.raw("CASE WHEN ci.checked = true THEN 1 ELSE 0 END") })
      .groupBy('ch.card_id')
      .as('kc');

    const cardsQuery = db('cards as c')
      .whereIn('c.list_id', listIds)
      .where({ 'c.archived': false })
      .orderBy('c.position', 'asc')
      .select(
        'c.id',
        'c.short_id',
        'c.list_id',
        'c.title',
        'c.description',
        'c.position',
        'c.archived',
        'c.due_date',
        'c.due_complete',
        'c.start_date',
        'c.amount',
        'c.currency',
        'c.cover_attachment_id',
        'c.cover_color',
        'c.cover_size',
        'c.created_at',
        'c.updated_at',
        db.raw(
          `COALESCE(json_agg(DISTINCT jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color)) FILTER (WHERE l.id IS NOT NULL), '[]'::json) as labels`
        ),
        db.raw(
          `COALESCE(json_agg(DISTINCT jsonb_build_object('id', u.id, 'email', u.email, 'name', u.name, 'avatar_url', u.avatar_url)) FILTER (WHERE u.id IS NOT NULL), '[]'::json) as members`
        ),
        db.raw('MAX(CAST(COALESCE(cc.comment_count, 0) AS INTEGER)) AS comment_count'),
        db.raw('MAX(CAST(COALESCE(ac.attachment_count, 0) AS INTEGER)) AS attachment_count'),
        db.raw('MAX(CAST(COALESCE(ac.linked_card_count, 0) AS INTEGER)) AS linked_card_count'),
        db.raw('MAX(CAST(COALESCE(kc.checklist_total, 0) AS INTEGER)) AS checklist_total'),
        db.raw('MAX(CAST(COALESCE(kc.checklist_done, 0) AS INTEGER)) AS checklist_done'),
      )
      .leftJoin('card_labels as cl', 'cl.card_id', 'c.id')
      .leftJoin('labels as l', 'l.id', 'cl.label_id')
      .leftJoin('card_members as cm', 'cm.card_id', 'c.id')
      .leftJoin('users as u', 'u.id', 'cm.user_id')
      .leftJoin(commentCountsQuery, 'cc.card_id', 'c.id')
      .leftJoin(attachmentCountsQuery, 'ac.card_id', 'c.id')
      .leftJoin(checklistCountsQuery, 'kc.card_id', 'c.id')
      .groupBy('c.id');

    if (cardIds && cardIds.length > 0) {
      cardsQuery.whereIn('c.id', cardIds);
    }

    return cardsQuery;
  }

  const cardHydration: Record<string, { loaded: number; total: number; hasMore: boolean; nextOffset: number | null }> = {};

  const cards = await (async () => {
    if (listIds.length === 0) return [];
    if (!initialCardsPerList) {
      return loadCards();
    }

    const totalRows = await db('cards')
      .whereIn('list_id', listIds)
      .where({ archived: false })
      .select('list_id')
      .count<{ list_id: string; count: string }[]>('* as count')
      .groupBy('list_id');

    const totalsByList = Object.fromEntries(
      totalRows.map((row) => [row.list_id, Number(row.count ?? 0)]),
    ) as Record<string, number>;

    const rankedCardRows = await db
      .from(
        db('cards as c')
          .whereIn('c.list_id', listIds)
          .where({ 'c.archived': false })
          .select(
            'c.id',
            'c.list_id',
            db.raw('ROW_NUMBER() OVER (PARTITION BY c.list_id ORDER BY c.position ASC) as rn'),
          )
          .as('ranked_cards'),
      )
      .where('rn', '<=', initialCardsPerList)
      .select('id', 'list_id')
      .orderBy('list_id', 'asc')
      .orderBy('rn', 'asc');

    const initialCardIds = rankedCardRows.map((row: { id: string }) => row.id);
    const loadedByList = rankedCardRows.reduce<Record<string, number>>((acc, row: { list_id: string }) => {
      acc[row.list_id] = (acc[row.list_id] ?? 0) + 1;
      return acc;
    }, {});

    listIds.forEach((listId) => {
      const loaded = loadedByList[listId] ?? 0;
      const total = totalsByList[listId] ?? 0;
      const hasMore = loaded < total;
      cardHydration[listId] = {
        loaded,
        total,
        hasMore,
        nextOffset: hasMore ? loaded : null,
      };
    });

    if (initialCardIds.length === 0) return [];

    return loadCards(initialCardIds);
  })();

  const cardsWithResolvedMembers = await Promise.all(
    cards.map(async (card) => ({
      ...card,
      members: buildAvatarProxyUrlsInCollection(
        Array.isArray(card.members)
          ? (card.members as Array<{ avatar_url?: string | null } & Record<string, unknown>>)
          : []
      ),
    }))
  );

  const cardsWithResolvedCovers = await resolveCoverImageUrls(
    cardsWithResolvedMembers as unknown as Array<{ id: string; cover_attachment_id?: string | null } & Record<string, unknown>>,
  );

  const includes = url.searchParams.get('include')?.split(',') ?? [];

  let activities: unknown[] = [];
  if (includes.includes('activities') && listIds.length > 0) {
    const cardIds = cards
      .map((c) => (typeof c.id === 'string' ? c.id : null))
      .filter((id): id is string => id !== null);
    if (cardIds.length > 0) {
      activities = await db('activities')
        .whereIn('entity_id', cardIds)
        .whereIn('action', VISIBLE_EVENT_TYPES)
        .orderBy('created_at', 'asc');
    }
  }

  // [why] Expose the caller's guest sub-type so the client can conditionally
  // render write-action controls without a second round-trip.
  const callerGuestType = (scopedReq.guestType as string | undefined) ?? null;

  // [why] Include isStarred so the board header can show the correct star state on load.
  const currentUserId = (scopedReq.currentUser as { id?: string } | undefined)?.id ?? null;
  let isStarred = false;
  if (currentUserId) {
    const star = await db('board_stars')
      .where({ board_id: resolvedBoardId, user_id: currentUserId })
      .first();
    isStarred = !!star;
  }

  const backgroundUrl = resolveBackgroundUrl({ boardId: resolvedBoardId, backgroundUrl: board.background });

  const includesResponse: {
    lists: unknown[];
    cards: unknown[];
    card_hydration?: Record<string, { loaded: number; total: number; hasMore: boolean; nextOffset: number | null }>;
    activities?: unknown[];
  } = {
    lists,
    cards: cardsWithResolvedCovers,
    ...(initialCardsPerList ? { card_hydration: cardHydration } : {}),
    ...(includes.includes('activities') ? { activities } : {}),
  };

  return Response.json({
    data: { ...board, background: backgroundUrl, callerGuestType, isStarred },
    includes: includesResponse,
  });
}
