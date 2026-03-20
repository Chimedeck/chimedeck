// Router for GET and PATCH /api/v1/boards/:boardId/notification-preference
import { handleGetBoardNotificationPreference } from './get';
import { handleUpdateBoardNotificationPreference } from './update';

export async function boardPreferenceRouter(
  req: Request,
  pathname: string,
): Promise<Response | null> {
  const match = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/notification-preference$/);
  if (!match) return null;

  const boardId = match[1] as string;

  if (req.method === 'GET') return handleGetBoardNotificationPreference(req, boardId);
  if (req.method === 'PATCH') return handleUpdateBoardNotificationPreference(req, boardId);

  return null;
}
