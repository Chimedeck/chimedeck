// GET /api/v1/boards/:boardId/workspace/boards
// Returns all ACTIVE boards in the same workspace as :boardId, accessible to the current user.
// Used by the automation action config UI to populate the "Copy card to another board" target picker.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleGetWorkspaceBoards(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;
  const currentUser = (req as AuthenticatedRequest).currentUser!;

  const board = await db('boards').where({ id: boardId }).first();
  if (!board) {
    return Response.json({ error: { name: 'board-not-found' } }, { status: 404 });
  }

  // Caller must be a workspace member to enumerate boards.
  const membership = await db('memberships')
    .where({ user_id: currentUser.id, workspace_id: board.workspace_id })
    .first();
  if (!membership) {
    return Response.json({ error: { name: 'not-a-workspace-member' } }, { status: 403 });
  }

  const boards = await db('boards')
    .where({ workspace_id: board.workspace_id, state: 'ACTIVE' })
    .orderBy('created_at', 'asc')
    .select('id', 'title');

  return Response.json({ data: boards });
}
