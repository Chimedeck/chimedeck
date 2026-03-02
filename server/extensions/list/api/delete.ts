// DELETE /api/v1/lists/:id — hard-delete a list (cascades cards); min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';

export async function handleDeleteList(req: Request, listId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const list = await db('lists').where({ id: listId }).first();
  if (!list) {
    return Response.json(
      { name: 'list-not-found', data: { message: 'List not found' } },
      { status: 404 },
    );
  }

  const boardReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardReq, list.board_id);
  if (writableError) return writableError;

  const board = boardReq.board!;

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  await db('lists').where({ id: listId }).del();

  // Stub event emission.
  console.log('[event] list_deleted', { listId, boardId: list.board_id });

  return new Response(null, { status: 204 });
}
