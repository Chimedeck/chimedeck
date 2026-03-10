// DELETE /api/v1/notifications/:id — delete one notification owned by the current user.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleDeleteNotification(
  req: Request,
  notificationId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const notification = await db('notifications').where({ id: notificationId }).first();
  if (!notification) {
    return Response.json(
      { error: { code: 'notification-not-found', message: 'Notification not found' } },
      { status: 404 },
    );
  }

  if (notification.user_id !== userId) {
    return Response.json(
      { error: { code: 'forbidden', message: 'Not your notification' } },
      { status: 403 },
    );
  }

  await db('notifications').where({ id: notificationId }).delete();

  return new Response(null, { status: 204 });
}
