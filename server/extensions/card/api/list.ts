// GET /api/v1/lists/:listId/cards — list active cards in a list; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

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

  // WHY: aggregate labels and members in a single query so card tiles have
  // all data needed for Sprint 27 (label chips) and Sprint 28 (member avatars).
  const rows = await db('cards as c')
    .where({ 'c.list_id': listId, 'c.archived': false })
    .orderBy('c.position', 'asc')
    .select(
      'c.id',
      'c.list_id',
      'c.title',
      'c.description',
      'c.position',
      'c.archived',
      'c.due_date',
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

  return Response.json({ data: rows });
}
