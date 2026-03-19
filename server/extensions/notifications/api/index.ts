// Notification API router.
import { handleListNotifications } from './list';
import { handleMarkRead } from './markRead';
import { handleMarkAllRead } from './markAllRead';
import { handleDeleteNotification } from './delete';
import { preferencesRouter } from './preferences';

export async function notificationsRouter(req: Request, pathname: string): Promise<Response | null> {
  // /api/v1/notifications/preferences — GET and PATCH
  const preferencesResponse = await preferencesRouter(req, pathname);
  if (preferencesResponse !== null) return preferencesResponse;

  // GET /api/v1/notifications
  if (pathname === '/api/v1/notifications' && req.method === 'GET') {
    return handleListNotifications(req);
  }

  // PATCH /api/v1/notifications/read-all — must come before /:id/read
  if (pathname === '/api/v1/notifications/read-all' && req.method === 'PATCH') {
    return handleMarkAllRead(req);
  }

  // PATCH /api/v1/notifications/:id/read
  const markReadMatch = pathname.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/);
  if (markReadMatch && req.method === 'PATCH') {
    return handleMarkRead(req, markReadMatch[1] as string);
  }

  // DELETE /api/v1/notifications/:id
  const deleteMatch = pathname.match(/^\/api\/v1\/notifications\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    return handleDeleteNotification(req, deleteMatch[1] as string);
  }

  return null;
}
