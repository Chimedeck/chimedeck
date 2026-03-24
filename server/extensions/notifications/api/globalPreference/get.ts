// GET /api/v1/user/notification-settings
// Returns the global notification setting for the authenticated user.
// Missing row defaults to global_notifications_enabled: true (opt-out model).
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';

export async function handleGetGlobalNotificationSetting(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const row = await db('user_notification_settings')
    .where({ user_id: userId })
    .select('global_notifications_enabled', 'updated_at')
    .first();

  return Response.json({
    data: {
      global_notifications_enabled: row ? row.global_notifications_enabled : true,
      updated_at: row ? row.updated_at : null,
    },
  });
}
