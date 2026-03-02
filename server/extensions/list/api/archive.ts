// PATCH /api/v1/lists/:id/archive — toggle list archived state; min role: ADMIN.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { writeEvent } from '../../../mods/events/write';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../../board/middlewares/requireBoardWritable';

export async function handleArchiveList(req: Request, listId: string): Promise<Response> {
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

  // Toggle archived state
  const newArchived = !list.archived;
  const updated = await db('lists')
    .where({ id: listId })
    .update({ archived: newArchived }, ['*']);

  // Stub event emission.
  await writeEvent({ type: 'list_archived', boardId: board.id, entityId: listId, actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system', payload: { archived: newArchived } });

  return Response.json({ data: updated[0] });
}
