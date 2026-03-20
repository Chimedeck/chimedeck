// boardPreferenceGuard — checks board_notification_preferences for a user/board pair.
// Missing row means notifications are enabled (opt-out model per Sprint 95).
import { db } from '../../../common/db';

export async function boardPreferenceGuard({
  userId,
  boardId,
}: {
  userId: string;
  boardId: string;
}): Promise<boolean> {
  const row = await db('board_notification_preferences')
    .where({ user_id: userId, board_id: boardId })
    .select('notifications_enabled')
    .first();

  // Missing row → opt-out model: notifications are enabled by default.
  return row ? row.notifications_enabled : true;
}
