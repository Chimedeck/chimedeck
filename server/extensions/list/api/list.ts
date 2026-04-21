// GET /api/v1/boards/:boardId/lists — list all active lists for a board; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { resolveBoardId } from '../../../common/ids/resolveEntityId';

export async function handleListLists(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const resolvedBoardId = await resolveBoardId(boardId);
  const board = resolvedBoardId ? await db('boards').where({ id: resolvedBoardId }).first() : null;
  if (!board) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const lists = await db('lists')
    .where({ board_id: board.id, archived: false })
    .orderBy('position', 'asc');

  return Response.json({ data: lists });
}
