// GET /api/v1/boards/:id — get a single board with shallow lists and cards.
// PUBLIC boards: no auth required. WORKSPACE/PRIVATE: min role VIEWER.
import { db } from '../../../common/db';
import {
  requireRole,
} from '../../../middlewares/permissionManager';
import {
  applyBoardVisibility,
  type BoardVisibilityScopedRequest,
} from '../../../middlewares/boardVisibility';
import { VISIBLE_EVENT_TYPES } from '../../activity/config/visibleEventTypes';

export async function handleGetBoard(req: Request, boardId: string): Promise<Response> {
  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  const scopedReq = req as BoardVisibilityScopedRequest;
  const board = scopedReq.board!;

  // Non-public boards require at least VIEWER role.
  if (board.visibility !== 'PUBLIC') {
    const roleError = requireRole(scopedReq, 'VIEWER');
    if (roleError) return roleError;
  }

  // Load active lists now that the lists table exists (sprint 06)
  const lists = await db('lists')
    .where({ board_id: boardId, archived: false })
    .orderBy('position', 'asc');

  const listIds = lists.map((l: { id: string }) => l.id);
  const cards = listIds.length > 0
    ? await db('cards as c')
        .whereIn('c.list_id', listIds)
        .where({ 'c.archived': false })
        .orderBy('c.position', 'asc')
        .select(
          'c.id', 'c.list_id', 'c.title', 'c.description', 'c.position',
          'c.archived', 'c.due_date', 'c.start_date', 'c.amount', 'c.currency', 'c.created_at', 'c.updated_at',
          db.raw(`COALESCE(json_agg(DISTINCT jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color)) FILTER (WHERE l.id IS NOT NULL), '[]'::json) as labels`),
          db.raw(`COALESCE(json_agg(DISTINCT jsonb_build_object('id', u.id, 'email', u.email, 'name', u.name, 'avatar_url', u.avatar_url)) FILTER (WHERE u.id IS NOT NULL), '[]'::json) as members`),
        )
        .leftJoin('card_labels as cl', 'cl.card_id', 'c.id')
        .leftJoin('labels as l', 'l.id', 'cl.label_id')
        .leftJoin('card_members as cm', 'cm.card_id', 'c.id')
        .leftJoin('users as u', 'u.id', 'cm.user_id')
        .groupBy('c.id')
    : [];

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

  return Response.json({
    data: board,
    includes: { lists, cards, activities },
  });
}
