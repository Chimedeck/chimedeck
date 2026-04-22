// List API router — mounts all list routes.
import { applyBoardVisibility, applyBoardVisibilityFromList } from '../../../middlewares/boardVisibility';
import { handleCreateList } from './create';
import { handleListLists } from './list';
import { handleUpdateList } from './update';
import { handleArchiveList } from './archive';
import { handleDeleteList } from './delete';
import { handleReorderLists } from './reorder';
import { handleSortListCards } from './sort';
import { handleUpdateListColor } from './color';
import { resolveBoardId, resolveListId } from '../../../common/ids/resolveEntityId';

// Returns a Response if the path matches a list route, otherwise null.
export async function listRouter(req: Request, pathname: string): Promise<Response | null> {
  // Board-scoped list routes: /api/v1/boards/:boardId/lists[/reorder]
  const boardListsMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/lists(\/.*)?$/);
  if (boardListsMatch) {
    const boardIdentifier = boardListsMatch[1] as string;
    const boardId = await resolveBoardId(boardIdentifier);
    if (!boardId) {
      return Response.json(
        { error: { code: 'board-not-found', message: 'Board not found' } },
        { status: 404 },
      );
    }
    const sub = boardListsMatch[2] ?? '';

    // Enforce board visibility before dispatching to any board-scoped list handler.
    const visibilityError = await applyBoardVisibility(req, boardId);
    if (visibilityError) return visibilityError;

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
    const listIdentifier = listMatch[1] as string;
    const listId = await resolveListId(listIdentifier);
    if (!listId) {
      return Response.json(
        { error: { code: 'list-not-found', message: 'List not found' } },
        { status: 404 },
      );
    }
    const sub = listMatch[2] ?? '';

    // Enforce board visibility by resolving the board from the list.
    const visibilityError = await applyBoardVisibilityFromList(req, listId);
    if (visibilityError) return visibilityError;

    // PATCH /api/v1/lists/:id
    if (sub === '' && req.method === 'PATCH') return handleUpdateList(req, listId);

    // PATCH /api/v1/lists/:id/sort
    if (sub === '/sort' && req.method === 'PATCH') return handleSortListCards(req, listId);

    // PATCH /api/v1/lists/:id/color
    if (sub === '/color' && req.method === 'PATCH') return handleUpdateListColor(req, listId);

    // DELETE /api/v1/lists/:id
    if (sub === '' && req.method === 'DELETE') return handleDeleteList(req, listId);

    // PATCH /api/v1/lists/:id/archive
    if (sub === '/archive' && req.method === 'PATCH') return handleArchiveList(req, listId);
  }

  return null;
}
