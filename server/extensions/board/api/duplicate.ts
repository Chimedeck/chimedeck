// POST /api/v1/boards/:id/duplicate — deep-copy a board; min role: MEMBER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { writeEvent } from '../../../mods/events/write';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { duplicateBoard } from '../mods/duplicate/index';

export async function handleDuplicateBoard(req: Request, boardId: string): Promise<Response> {
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

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  const result = await duplicateBoard({
    originalBoardId: boardId,
    workspaceId: board.workspace_id,
    originalTitle: board.title,
  });

  if (result.status !== 201) {
    return Response.json(
      { name: result.name ?? 'board-duplicate-failed', data: { message: 'Duplication failed' } },
      { status: result.status },
    );
  }

  // Stub event emission.
  const newBoardId = result.data?.id as string; await writeEvent({ type: 'board_created', boardId: newBoardId, entityId: newBoardId, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { originalBoardId: boardId } });

  return Response.json({ data: result.data }, { status: 201 });
}
