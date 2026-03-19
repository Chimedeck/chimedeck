// GET /api/v1/notifications/preferences
// Returns all notification types with current preferences for the authenticated user.
// Missing rows default to both channels enabled (opt-out model).
import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { NOTIFICATION_TYPES } from '../../mods/preferenceGuard';

export async function handleGetPreferences(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const rows = await db('notification_preferences')
    .where({ user_id: userId })
    .select('type', 'in_app_enabled', 'email_enabled', 'updated_at');

  const rowByType = new Map(rows.map((r) => [r.type, r]));

  const data = NOTIFICATION_TYPES.map((type) => {
    const row = rowByType.get(type);
    return {
      type,
      in_app_enabled: row ? row.in_app_enabled : true,
      email_enabled: row ? row.email_enabled : true,
      updated_at: row ? row.updated_at : null,
    };
  });

  return Response.json({ data });
}
