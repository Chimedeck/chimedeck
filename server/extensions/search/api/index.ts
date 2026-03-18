// server/extensions/search/api/index.ts
// Search API router.
import { handleSearch } from './query';
import { handleBoardSearch } from './getBoardSearch';

export async function searchRouter(req: Request, pathname: string): Promise<Response | null> {
  // GET /api/v1/workspaces/:id/search
  const workspaceMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/search$/);
  if (workspaceMatch && req.method === 'GET') {
    return handleSearch(req, workspaceMatch[1] as string);
  }

  // GET /api/v1/boards/:boardId/search
  const boardMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/search$/);
  if (boardMatch && req.method === 'GET') {
    return handleBoardSearch(req, boardMatch[1] as string);
  }

  return null;
}
