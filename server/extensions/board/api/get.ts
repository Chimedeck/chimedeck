// GET /api/v1/boards/:id — get a single board with shallow lists and cards; min role: VIEWER.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';

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
    ? await db('cards').whereIn('list_id', listIds).where({ archived: false }).orderBy('position', 'asc')
    : [];

  return Response.json({
    data: board,
    includes: { lists, cards },
  });
}
