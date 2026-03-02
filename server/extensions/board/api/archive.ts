// PATCH /api/v1/boards/:id/archive — toggle ACTIVE ↔ ARCHIVED; min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

export async function handleArchiveBoard(req: Request, boardId: string): Promise<Response> {
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

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  const newState = board.state === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
  const updated = await db('boards')
    .where({ id: boardId })
    .update({ state: newState }, ['*']);

  // Stub event emission.
  console.log('[event] board_archived', { boardId, state: newState });

  return Response.json({ data: updated[0] });
}
