// PATCH /api/v1/user/notification-settings
// Upserts the global notification setting for the authenticated user.
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';

interface PatchBody {
  global_notifications_enabled?: unknown;
}

export async function handleUpdateGlobalNotificationSetting(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { name: 'invalid-request-body', data: { message: 'Invalid JSON body' } } },
      { status: 400 },
    );
  }

  const { global_notifications_enabled } = body;

  if (typeof global_notifications_enabled !== 'boolean') {
    return Response.json(
      {
        error: {
          name: 'invalid-global-notifications-enabled',
          data: { message: 'global_notifications_enabled must be a boolean' },
        },
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const existing = await db('user_notification_settings').where({ user_id: userId }).first();

  let row: Record<string, unknown>;

  if (existing) {
    const [updated] = await db('user_notification_settings')
      .where({ user_id: userId })
      .update({ global_notifications_enabled, updated_at: now }, [
        'global_notifications_enabled',
        'updated_at',
      ]);
    row = updated;
  } else {
    const [inserted] = await db('user_notification_settings').insert(
      { user_id: userId, global_notifications_enabled, updated_at: now },
      ['global_notifications_enabled', 'updated_at'],
    );
    row = inserted;
  }

  return Response.json({
    data: {
      global_notifications_enabled: row.global_notifications_enabled,
      updated_at: row.updated_at,
    },
  });
}
