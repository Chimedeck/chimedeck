// GET /api/v1/lists/:listId/cards — list active cards in a list; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { buildAvatarProxyUrlsInCollection } from '../../../common/avatar/resolveAvatarUrl';
import { resolveCoverImageUrls } from '../../../common/cards/cover';

export async function handleListCards(req: Request, listId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const list = await db('lists').where({ id: listId }).first();
  if (!list) {
    return Response.json(
      { error: { code: 'list-not-found', message: 'List not found' } },
      { status: 404 },
    );
  }

  const board = await db('boards').where({ id: list.board_id }).first();
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const url = new URL(req.url);
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '0', 10);
  const rawOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
  const hasPagination = Number.isFinite(rawLimit) && rawLimit > 0;
  const limit = hasPagination ? Math.min(rawLimit, 100) : null;
  const offset = hasPagination && Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  const totalRow = await db('cards')
    .where({ list_id: listId, archived: false })
    .count<{ count: string }[]>('* as count')
    .first();
  const total = Number(totalRow?.count ?? 0);

  // WHY: aggregate labels and members in a single query so card tiles have
  // all data needed for Sprint 27 (label chips) and Sprint 28 (member avatars).
  const cardsBaseQuery = db('cards as c')
    .where({ 'c.list_id': listId, 'c.archived': false })
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
      db.raw(`
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color))
          FILTER (WHERE l.id IS NOT NULL),
          '[]'::json
        ) as labels
      `),
      db.raw(`
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', u.id, 'email', u.email, 'name', u.name, 'avatar_url', u.avatar_url))
          FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) as members
      `),
    )
    .leftJoin('card_labels as cl', 'cl.card_id', 'c.id')
    .leftJoin('labels as l', 'l.id', 'cl.label_id')
    .leftJoin('card_members as cm', 'cm.card_id', 'c.id')
    .leftJoin('users as u', 'u.id', 'cm.user_id')
    .groupBy('c.id');

  if (hasPagination && limit !== null) {
    cardsBaseQuery.limit(limit).offset(offset);
  }

  const rows = await cardsBaseQuery;

  const data = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      members: buildAvatarProxyUrlsInCollection(
          Array.isArray(row.members)
            ? (row.members as Array<{ avatar_url?: string | null } & Record<string, unknown>>)
            : [],
        ),
    })),
  );

  const cardsWithCovers = await resolveCoverImageUrls(
    data as Array<{ id: string; cover_attachment_id?: string | null } & Record<string, unknown>>,
  );

  if (!hasPagination || limit === null) {
    return Response.json({ data: cardsWithCovers });
  }

  const loaded = offset + cardsWithCovers.length;
  const hasMore = loaded < total;

  return Response.json({
    data: cardsWithCovers,
    metadata: {
      total,
      limit,
      offset,
      nextOffset: hasMore ? loaded : null,
      hasMore,
    },
  });
}
