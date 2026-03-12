// Board API router — mounts all board routes.
import { handleCreateBoard } from './create';
import { handleListBoards } from './list';
import { handleGetBoard } from './get';
import { handleUpdateBoard } from './update';
import { handlePatchBoard } from './patch';
import { handleArchiveBoard } from './archive';
import { handleDeleteBoard } from './delete';
import { handleDuplicateBoard } from './duplicate';
import { handleGetBoardEvents } from '../../realtime/api/events';
import { handleGetPresence } from '../../realtime/api/presence';
import { handleGetBoardLabels, handleCreateBoardLabel } from './labels';
import { handleGetBoardMembers } from './members';
import { handleGetMemberSuggestions } from './members/suggestions';
import { handleStarBoard, handleUnstarBoard } from './star';
import { handleFollowBoard, handleUnfollowBoard } from './follow';
import { handleGetMeStarredBoards } from './me-starred-boards';
import { handleGetBoardActivity } from './activity';
import { handleGetBoardComments } from './comments';
import { handleGetArchivedCards } from './archived-cards';
import { handleInviteGuest, handleRevokeGuest, handleListGuests } from './guests/index';
import { handleGetWorkspaceBoards } from './workspaceBoards';

// Returns a Response if the path matches a board route, otherwise null.
export async function boardRouter(req: Request, pathname: string): Promise<Response | null> {
  // GET /api/v1/me/starred-boards — starred boards for the current user
  if (pathname === '/api/v1/me/starred-boards' && req.method === 'GET') {
    return handleGetMeStarredBoards(req);
  }

  // Workspace-scoped board routes: POST /api/v1/workspaces/:id/boards, GET /api/v1/workspaces/:id/boards
  const workspaceBoardsMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/boards$/);
  if (workspaceBoardsMatch) {
    const workspaceId = workspaceBoardsMatch[1] as string;

    if (req.method === 'POST') return handleCreateBoard(req, workspaceId);
    if (req.method === 'GET') return handleListBoards(req, workspaceId);
  }

  // Board-scoped routes: /api/v1/boards/:id[/sub]
  const boardMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)(\/.*)?$/);
  if (boardMatch) {
    const boardId = boardMatch[1] as string;
    const sub = boardMatch[2] ?? '';

    // GET /api/v1/boards/:id
    if (sub === '' && req.method === 'GET') return handleGetBoard(req, boardId);

    // PATCH /api/v1/boards/:id — supports title and monetization_type
    if (sub === '' && req.method === 'PATCH') return handlePatchBoard(req, boardId);

    // DELETE /api/v1/boards/:id
    if (sub === '' && req.method === 'DELETE') return handleDeleteBoard(req, boardId);

    // PATCH /api/v1/boards/:id/archive
    if (sub === '/archive' && req.method === 'PATCH') return handleArchiveBoard(req, boardId);

    // POST /api/v1/boards/:id/duplicate
    if (sub === '/duplicate' && req.method === 'POST') return handleDuplicateBoard(req, boardId);

    // GET /api/v1/boards/:id/events?since=
    if (sub.startsWith('/events') && req.method === 'GET') return handleGetBoardEvents(req, boardId);

    // GET /api/v1/boards/:id/presence
    if (sub === '/presence' && req.method === 'GET') return handleGetPresence(req, boardId);

    // GET /api/v1/boards/:id/labels — list workspace labels accessible from board
    if (sub === '/labels' && req.method === 'GET') return handleGetBoardLabels(req, boardId);

    // POST /api/v1/boards/:id/labels — create a label in the board's workspace
    if (sub === '/labels' && req.method === 'POST') return handleCreateBoardLabel(req, boardId);

    // GET /api/v1/boards/:id/members — list workspace members
    if (sub === '/members' && req.method === 'GET') return handleGetBoardMembers(req, boardId);

    // GET /api/v1/boards/:id/members/suggestions?q=
    if (sub === '/members/suggestions' && req.method === 'GET') return handleGetMemberSuggestions(req, boardId);

    // POST /api/v1/boards/:id/star — star a board (idempotent)
    if (sub === '/star' && req.method === 'POST') return handleStarBoard(req, boardId);

    // DELETE /api/v1/boards/:id/star — unstar a board (idempotent)
    if (sub === '/star' && req.method === 'DELETE') return handleUnstarBoard(req, boardId);

    // POST /api/v1/boards/:id/follow — follow a board (idempotent)
    if (sub === '/follow' && req.method === 'POST') return handleFollowBoard(req, boardId);

    // DELETE /api/v1/boards/:id/follow — unfollow a board (idempotent)
    if (sub === '/follow' && req.method === 'DELETE') return handleUnfollowBoard(req, boardId);

    // GET /api/v1/boards/:id/activity — paginated activity feed for the board
    if (sub === '/activity' && req.method === 'GET') return handleGetBoardActivity(req, boardId);

    // GET /api/v1/boards/:id/comments — paginated comments across all cards in the board
    if (sub === '/comments' && req.method === 'GET') return handleGetBoardComments(req, boardId);

    // GET /api/v1/boards/:id/archived-cards — all archived cards in the board
    if (sub === '/archived-cards' && req.method === 'GET') return handleGetArchivedCards(req, boardId);

    // POST /api/v1/boards/:id/guests — invite a user as a guest (ADMIN+ only)
    if (sub === '/guests' && req.method === 'POST') return handleInviteGuest(req, boardId);

    // GET /api/v1/boards/:id/guests — list current board guests
    if (sub === '/guests' && req.method === 'GET') return handleListGuests(req, boardId);

    // DELETE /api/v1/boards/:id/guests/:userId — revoke guest access
    const guestRevokeMatch = sub.match(/^\/guests\/([^/]+)$/);
    if (guestRevokeMatch && req.method === 'DELETE') {
      return handleRevokeGuest(req, boardId, guestRevokeMatch[1] as string);
    }

    // GET /api/v1/boards/:id/workspace/boards — list all ACTIVE boards in the same workspace
    if (sub === '/workspace/boards' && req.method === 'GET') return handleGetWorkspaceBoards(req, boardId);
  }

  return null;
}
