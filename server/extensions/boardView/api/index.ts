// Board view preference router.
import { handleGetViewPreference } from './get';
import { handlePutViewPreference } from './put';
import { resolveBoardId } from '../../../common/ids/resolveEntityId';

export async function boardViewRouter(req: Request, pathname: string): Promise<Response | null> {
  // /api/v1/boards/:id/view-preference
  const match = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/view-preference$/);
  if (!match) return null;

  const boardIdentifier = match[1] as string;
  const boardId = await resolveBoardId(boardIdentifier);
  if (!boardId) {
    return Response.json(
      { error: { code: 'board-not-found', message: 'Board not found' } },
      { status: 404 },
    );
  }

  if (req.method === 'GET') return handleGetViewPreference(req, boardId);
  if (req.method === 'PUT') return handlePutViewPreference(req, boardId);

  return null;
}
