// PATCH /api/v1/boards/:id/archive — toggle ACTIVE ↔ ARCHIVED; min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { writeEvent } from '../../../mods/events/write';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { guestGuard } from '../../../middlewares/guestGuard';

export async function handleArchiveBoard(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const guestError = guestGuard(scopedReq);
  if (guestError) return guestError;

  const roleError = requireRole(scopedReq, 'ADMIN');
  if (roleError) return roleError;

  const newState = board.state === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
  const updated = await db('boards')
    .where({ id: boardId })
    .update({ state: newState }, ['*']);

  // Stub event emission.
  await writeEvent({ type: 'board_archived', boardId, entityId: boardId, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { state: newState } });

  return Response.json({ data: updated[0] });
}
