// PATCH /api/v1/notifications/read-all — mark all notifications as read for current user.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

type AuthenticatedUserRequest = AuthenticatedRequest & {
  currentUser: NonNullable<AuthenticatedRequest['currentUser']>;
};

export async function handleMarkAllRead(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedUserRequest).currentUser.id;

  const updated = await db('notifications')
    .where({ user_id: userId, read: false })
    .update({ read: true });

  return Response.json({ data: { updated } });
}
