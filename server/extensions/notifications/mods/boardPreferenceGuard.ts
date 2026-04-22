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

  if (row) return row.notifications_enabled;

  // [why] No preference row means the user has never explicitly opted in or out.
  // Default ON for board participants (joined members OR board guests), but keep
  // default OFF for workspace/admin users who can view a board without joining it.
  const [isMember, hasGuestAccess] = await Promise.all([
    db('board_members').where({ user_id: userId, board_id: boardId }).first(),
    db('board_guest_access').where({ user_id: userId, board_id: boardId }).first(),
  ]);

  return !!isMember || !!hasGuestAccess;
}

/**
 * Pure cascade logic: given nullable board-level and user-level preference rows,
 * returns the effective channel flags. Exported for unit testing without db.
 */
export function selectChannels(
  boardRow: { in_app_enabled: boolean; email_enabled: boolean } | null | undefined,
  userRow: { in_app_enabled: boolean; email_enabled: boolean } | null | undefined,
): { inApp: boolean; email: boolean } {
  if (boardRow) return { inApp: boardRow.in_app_enabled, email: boardRow.email_enabled };
  if (userRow) return { inApp: userRow.in_app_enabled, email: userRow.email_enabled };
  return { inApp: true, email: true };
}

/**
 * Returns the effective in_app_enabled / email_enabled for a given
 * (userId, boardId, type) triple, applying the override cascade:
 *   board-type-pref → user-type-pref → default (true)
 *
 * Global and board-level toggles (Sprint 95) are NOT checked here — they
 * must be applied by the caller before invoking this function.
 */
export async function resolveNotificationChannels({
  userId,
  boardId,
  type,
}: {
  userId: string;
  boardId: string;
  type: string;
}): Promise<{ inApp: boolean; email: boolean }> {
  // 1. Board-type-pref takes highest precedence.
  const boardRow = await db('board_notification_type_preferences')
    .where({ user_id: userId, board_id: boardId, type })
    .select('in_app_enabled', 'email_enabled')
    .first();

  // 2. User-level preference is the next fallback.
  const userRow = boardRow
    ? null
    : await db('notification_preferences')
        .where({ user_id: userId, type })
        .select('in_app_enabled', 'email_enabled')
        .first();

  return selectChannels(boardRow, userRow);
}
