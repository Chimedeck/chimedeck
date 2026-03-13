// DELETE /api/v1/boards/:id/members/:userId — remove a member from the board.
// Requires workspace ADMIN+.
// Invariant: the last ADMIN on the board cannot be removed.
import { db } from '../../../../common/db';
import type { AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import type { BoardVisibilityScopedRequest } from '../../../../middlewares/boardVisibility';
import {
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { writeEvent } from '../../../../mods/events/index';

export async function handleRemoveBoardMember(
  req: Request,
  boardId: string,
  userId: string,
): Promise<Response> {
  const scopedReq = req as BoardVisibilityScopedRequest;

  const roleError = requireRole(scopedReq as WorkspaceScopedRequest, 'ADMIN');
  if (roleError) return roleError;

  const existing = await db('board_members').where({ board_id: boardId, user_id: userId }).first();
  if (!existing) {
    return Response.json(
      { name: 'board-member-not-found', data: { message: 'This user is not a member of the board' } },
      { status: 404 },
    );
  }

  // [deny-first] Prevent removing the last ADMIN — board must always have at least one.
  if (existing.role === 'ADMIN') {
    const adminCount = await db('board_members')
      .where({ board_id: boardId, role: 'ADMIN' })
      .count('id as count')
      .first();

    const count = Number((adminCount as { count: string | number } | undefined)?.count ?? 0);
    if (count <= 1) {
      return Response.json(
        { name: 'last-board-admin', data: { message: 'Cannot remove the last board admin. Promote another member to ADMIN first.' } },
        { status: 409 },
      );
    }
  }

  await db('board_members').where({ board_id: boardId, user_id: userId }).delete();

  writeEvent({
    type: 'board_member_removed',
    boardId,
    entityId: boardId,
    actorId: (req as AuthenticatedRequest).currentUser!.id,
    payload: { userId },
  }).catch(() => {});

  return Response.json({ data: { boardId, userId, removed: true } });
}
