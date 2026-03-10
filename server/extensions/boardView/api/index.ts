// Board view preference router.
import { handleGetViewPreference } from './get';
import { handlePutViewPreference } from './put';

export async function boardViewRouter(req: Request, pathname: string): Promise<Response | null> {
  // /api/v1/boards/:id/view-preference
  const match = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/view-preference$/);
  if (!match) return null;

  const boardId = match[1] as string;

  if (req.method === 'GET') return handleGetViewPreference(req, boardId);
  if (req.method === 'PUT') return handlePutViewPreference(req, boardId);

  return null;
}
