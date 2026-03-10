// GET /api/v1/boards/:id/archived-cards — all archived cards in a board; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleGetArchivedCards(req: Request, boardId: string): Promise<Response> {
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

  const cards = await db('cards')
    .join('lists', 'cards.list_id', 'lists.id')
    .where('lists.board_id', boardId)
    .where('cards.archived', true)
    .orderBy('cards.updated_at', 'desc')
    .select(
      'cards.id',
      'cards.list_id',
      'cards.title',
      'cards.description',
      'cards.position',
      'cards.archived',
      'cards.start_date',
      'cards.due_date',
      'cards.created_at',
      'cards.updated_at',
      'lists.title as list_title',
    );

  return Response.json({ data: cards });
}
