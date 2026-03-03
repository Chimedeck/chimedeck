// Board API router — mounts all board routes.
import { handleCreateBoard } from './create';
import { handleListBoards } from './list';
import { handleGetBoard } from './get';
import { handleUpdateBoard } from './update';
import { handleArchiveBoard } from './archive';
import { handleDeleteBoard } from './delete';
import { handleDuplicateBoard } from './duplicate';
import { handleGetBoardEvents } from '../../realtime/api/events';
import { handleGetPresence } from '../../realtime/api/presence';
import { handleGetBoardLabels, handleCreateBoardLabel } from './labels';
import { handleGetBoardMembers } from './members';
import { handleGetMemberSuggestions } from './members/suggestions';

// Returns a Response if the path matches a board route, otherwise null.
export async function boardRouter(req: Request, pathname: string): Promise<Response | null> {
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

    // PATCH /api/v1/boards/:id
    if (sub === '' && req.method === 'PATCH') return handleUpdateBoard(req, boardId);

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
  }

  return null;
}
