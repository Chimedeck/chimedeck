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

  searchLog.boardAccessChecked({
    boardId,
    userId: (scopedReq.currentUser as { id?: string } | undefined)?.id,
    visibility: board.visibility,
    callerRole: scopedReq.callerRole,
    result: 'allowed',
    statusCode: 200,
  });

  // Load active lists now that the lists table exists (sprint 06)
  const lists = await db('lists')
    .where({ board_id: boardId, archived: false })
    .orderBy('position', 'asc');

  const listIds = lists.map((l: { id: string }) => l.id);
  const cards =
    listIds.length > 0
      ? await db('cards as c')
          .whereIn('c.list_id', listIds)
          .where({ 'c.archived': false })
          .orderBy('c.position', 'asc')
          .select(
            'c.id',
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
            // [why] Inline sub-counts avoid N+1 queries on subsequent per-card fetches.
            db.raw(`(SELECT COUNT(*) FROM comments WHERE card_id = c.id AND deleted = false)::int AS comment_count`),
            db.raw(`(SELECT COUNT(*) FROM attachments WHERE card_id = c.id AND status = 'READY')::int AS attachment_count`),
            db.raw(`(SELECT COUNT(*) FROM checklist_items ci JOIN checklists ch ON ci.checklist_id = ch.id WHERE ch.card_id = c.id)::int AS checklist_total`),
            db.raw(`(SELECT COUNT(*) FROM checklist_items ci JOIN checklists ch ON ci.checklist_id = ch.id WHERE ch.card_id = c.id AND ci.checked = true)::int AS checklist_done`),
          )
          .leftJoin('card_labels as cl', 'cl.card_id', 'c.id')
          .leftJoin('labels as l', 'l.id', 'cl.label_id')
          .leftJoin('card_members as cm', 'cm.card_id', 'c.id')
          .leftJoin('users as u', 'u.id', 'cm.user_id')
          .groupBy('c.id')
      : [];

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
    cardsWithResolvedMembers as Array<{ id: string; cover_attachment_id?: string | null } & Record<string, unknown>>,
  );

  const url = new URL(req.url);
  const includes = url.searchParams.get('include')?.split(',') ?? [];

  let activities: unknown[] = [];
  if (includes.includes('activities') && listIds.length > 0) {
    const cardIds = cards.map((c: { id: string }) => c.id);
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

  const backgroundUrl = resolveBackgroundUrl({ boardId, backgroundUrl: board.background });

  return Response.json({
    data: { ...board, background: backgroundUrl, callerGuestType },
    includes: { lists, cards: cardsWithResolvedCovers, activities },
  });
}
