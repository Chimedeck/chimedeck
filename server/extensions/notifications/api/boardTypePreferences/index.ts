// Router for GET, PATCH, and DELETE /api/v1/boards/:boardId/notification-preferences/types
import { handleGetBoardTypePreferences } from './get';
import { handleUpdateBoardTypePreference } from './update';
import { handleResetBoardTypePreferences } from './reset';

export async function boardTypePreferencesRouter(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  const match = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/notification-preferences\/types$/);
  if (!match) return null;

  const boardId = match[1] as string;

  if (req.method === 'GET') return handleGetBoardTypePreferences(req, boardId);
  if (req.method === 'PATCH') return handleUpdateBoardTypePreference(req, boardId);
  if (req.method === 'DELETE') return handleResetBoardTypePreferences(req, boardId);

  return null;
}
