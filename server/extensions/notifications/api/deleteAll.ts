// DELETE /api/v1/notifications — delete all notifications for the current user.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleDeleteAllNotifications(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  await db('notifications').where({ user_id: userId }).delete();

  return new Response(null, { status: 204 });
}
