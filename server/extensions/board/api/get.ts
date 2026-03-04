// GET /api/v1/boards/:id — get a single board with shallow lists and cards; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { VISIBLE_EVENT_TYPES } from '../../activity/config/visibleEventTypes';

export async function handleGetBoard(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { name: 'board-not-found', data: { message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'VIEWER');
  if (roleError) return roleError;

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
          'c.archived', 'c.due_date', 'c.created_at', 'c.updated_at',
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
