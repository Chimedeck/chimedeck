// List API router — mounts all list routes.
import { handleCreateList } from './create';
import { handleListLists } from './list';
import { handleUpdateList } from './update';
import { handleArchiveList } from './archive';
import { handleDeleteList } from './delete';
import { handleReorderLists } from './reorder';

// Returns a Response if the path matches a list route, otherwise null.
export async function listRouter(req: Request, pathname: string): Promise<Response | null> {
  // Board-scoped list routes: /api/v1/boards/:boardId/lists[/reorder]
  const boardListsMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/lists(\/.*)?$/);
  if (boardListsMatch) {
    const boardId = boardListsMatch[1] as string;
    const sub = boardListsMatch[2] ?? '';

    // POST /api/v1/boards/:boardId/lists
    if (sub === '' && req.method === 'POST') return handleCreateList(req, boardId);

    // GET /api/v1/boards/:boardId/lists
    if (sub === '' && req.method === 'GET') return handleListLists(req, boardId);

    // POST /api/v1/boards/:boardId/lists/reorder
    if (sub === '/reorder' && req.method === 'POST') return handleReorderLists(req, boardId);
  }

  // List-scoped routes: /api/v1/lists/:id[/archive]
  const listMatch = pathname.match(/^\/api\/v1\/lists\/([^/]+)(\/.*)?$/);
  if (listMatch) {
    const listId = listMatch[1] as string;
    const sub = listMatch[2] ?? '';

    // PATCH /api/v1/lists/:id
    if (sub === '' && req.method === 'PATCH') return handleUpdateList(req, listId);

    // DELETE /api/v1/lists/:id
    if (sub === '' && req.method === 'DELETE') return handleDeleteList(req, listId);

    // PATCH /api/v1/lists/:id/archive
    if (sub === '/archive' && req.method === 'PATCH') return handleArchiveList(req, listId);
  }

  return null;
}
