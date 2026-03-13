// preferenceGuard — looks up a user's notification preference for a given type
// and falls back to both channels enabled when no row exists (opt-out model).
import { db } from '../../../common/db';

export const NOTIFICATION_TYPES = ['mention', 'card_created', 'card_moved', 'card_commented'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationPreference {
  in_app_enabled: boolean;
  email_enabled: boolean;
}

// When NOTIFICATION_PREFERENCES_ENABLED flag is off callers should skip the guard entirely
// and treat all channels as enabled. This helper is used when the flag is on.
export async function preferenceGuard({
  userId,
  type,
}: {
  userId: string;
  type: NotificationType;
}): Promise<NotificationPreference> {
  const row = await db('notification_preferences')
    .where({ user_id: userId, type })
    .select('in_app_enabled', 'email_enabled')
    .first();

  // Missing row → opt-out model defaults to both channels enabled.
  return {
    in_app_enabled: row ? row.in_app_enabled : true,
    email_enabled: row ? row.email_enabled : true,
  };
}
