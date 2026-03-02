// Activity API router.
import { handleCardActivity } from './cardActivity';
import { handleBoardActivity } from './boardActivity';

export async function activityRouter(req: Request, pathname: string): Promise<Response | null> {
  // GET /api/v1/cards/:id/activity
  const cardActivityMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/activity$/);
  if (cardActivityMatch && req.method === 'GET') {
    return handleCardActivity(req, cardActivityMatch[1] as string);
  }

  // GET /api/v1/boards/:id/activity
  const boardActivityMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/activity$/);
  if (boardActivityMatch && req.method === 'GET') {
    return handleBoardActivity(req, boardActivityMatch[1] as string);
  }

  return null;
}
