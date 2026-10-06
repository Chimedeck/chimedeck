// GET /api/v1/boards/:boardId/workspace/boards
// Returns all ACTIVE boards in the same workspace as :boardId, accessible to the current user.
// Used by the automation action config UI to populate the "Copy card to another board" target picker.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

type AuthenticatedUserRequest = AuthenticatedRequest & { currentUser: { id: string } };
type BoardRow = { id: string; workspace_id: string };
type MembershipRow = { user_id: string; workspace_id: string };
type WorkspaceBoardRow = { id: string; title: string; workspace_id: string; state: string };

export async function handleGetWorkspaceBoards(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;
  const currentUser = (req as AuthenticatedUserRequest).currentUser;

  const board = await db<BoardRow>('boards').where({ id: boardId }).first<BoardRow | undefined>();
  if (!board) {
    return Response.json({ error: { name: 'board-not-found' } }, { status: 404 });
  }

  // Caller must be a workspace member to enumerate boards.
  const membership = await db<MembershipRow>('memberships')
    .where({ user_id: currentUser.id, workspace_id: board.workspace_id })
    .first<MembershipRow | undefined>();
  if (!membership) {
    return Response.json({ error: { name: 'not-a-workspace-member' } }, { status: 403 });
  }

  const boards = (await db<WorkspaceBoardRow>('boards')
    .where({ workspace_id: board.workspace_id, state: 'ACTIVE' })
    .orderBy('created_at', 'asc')
    .select('id', 'title')) as WorkspaceBoardRow[];

  return Response.json({ data: boards });
}
