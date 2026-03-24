// globalPreferenceGuard — checks user_notification_settings for a user's global toggle.
// Missing row means notifications are enabled (opt-out model per Sprint 95).
import { db } from '../../../common/db';

export async function globalPreferenceGuard({ userId }: { userId: string }): Promise<boolean> {
  const row = await db('user_notification_settings')
    .where({ user_id: userId })
    .select('global_notifications_enabled')
    .first();

  // Missing row → opt-out model: global notifications are enabled by default.
  return row ? row.global_notifications_enabled : true;
}
