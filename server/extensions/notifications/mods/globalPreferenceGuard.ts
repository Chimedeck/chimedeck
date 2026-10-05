// globalPreferenceGuard — checks user_notification_settings for a user's global toggle.
// Missing row means notifications are enabled (opt-out model per Sprint 95).
import { db } from '../../../common/db';

// Migration 0087: primary user key and non-null boolean toggle.
interface GlobalPreferenceRow {
  user_id: string;
  global_notifications_enabled: boolean;
}

export async function globalPreferenceGuard({ userId }: { userId: string }): Promise<boolean> {
  const row = await db<GlobalPreferenceRow>('user_notification_settings')
    .where({ user_id: userId })
    .select('global_notifications_enabled')
    .first();

  // Missing row → opt-out model: global notifications are enabled by default.
  return row ? row.global_notifications_enabled : true;
}
