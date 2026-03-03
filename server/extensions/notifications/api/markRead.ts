// PATCH /api/v1/notifications/:id/read — mark one notification as read.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleMarkRead(req: Request, notificationId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const notification = await db('notifications').where({ id: notificationId }).first();
  if (!notification) {
    return Response.json(
      { name: 'notification-not-found', data: { message: 'Notification not found' } },
      { status: 404 },
    );
  }

  if (notification.user_id !== userId) {
    return Response.json(
      { name: 'forbidden', data: { message: 'Not your notification' } },
      { status: 403 },
    );
  }

  await db('notifications').where({ id: notificationId }).update({ read: true });

  return Response.json({ data: { id: notificationId, read: true } });
}
