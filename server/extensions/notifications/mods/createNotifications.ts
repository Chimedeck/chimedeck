// server/extensions/notifications/mods/createNotifications.ts
// Creates notification rows for each newly-mentioned user and broadcasts
// a real-time event to their personal WS channel.
// Respects notification preferences — skips insertion and WS publish when
// in_app_enabled is false for the recipient (opt-out model).
// Also dispatches mention email notifications (fire-and-forget) after in-app creation.
import { db } from '../../../common/db';
import { publishToUser } from '../../realtime/userChannel';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';
import { preferenceGuard } from './preferenceGuard';
import { boardPreferenceGuard } from './boardPreferenceGuard';
import { globalPreferenceGuard } from './globalPreferenceGuard';
import { dispatchNotificationEmail } from './emailDispatch';
import { env } from '../../../config/env';
import type { Knex } from 'knex';

interface CreateNotificationsParams {
  trx: Knex.Transaction;
  addedUserIds: string[];
  actorId: string;
  sourceType: 'card_description' | 'comment';
  sourceId: string;
  cardId: string | null;
  boardId: string;
  // Optional context for mention email dispatch
  cardTitle?: string;
  boardName?: string;
}

export async function createNotificationsForMentions({
  trx,
  addedUserIds,
  actorId,
  sourceType,
  sourceId,
  cardId,
  boardId,
  cardTitle,
  boardName,
}: CreateNotificationsParams): Promise<void> {
  if (addedUserIds.length === 0) return;

  // Don't notify the actor about their own mentions
  const recipients = addedUserIds.filter((id) => id !== actorId);
  if (recipients.length === 0) return;

  // Fetch actor details once for the WS payload (read-only, outside transaction is fine)
  const actor = await db('users')
    .where({ id: actorId })
    .select('id', 'nickname', db.raw("COALESCE(name, email) as name"), 'avatar_url')
    .first();

  const actorPayload = actor
    ? {
        ...actor,
        avatar_url: buildAvatarProxyUrl({ userId: actor.id, avatarUrl: actor.avatar_url ?? null }),
      }
    : { id: actorId, nickname: null, name: null, avatar_url: null };

  const now = new Date().toISOString();

  for (const userId of recipients) {
    // Board-scoped and global opt-out guards — mirrors boardActivityDispatch.
    // Both use opt-out model: missing row = enabled.
    try {
      const [globalEnabled, boardEnabled] = await Promise.all([
        globalPreferenceGuard({ userId }),
        boardPreferenceGuard({ userId, boardId }),
      ]);
      if (!globalEnabled || !boardEnabled) continue;
    } catch {
      // Fail open: if guard lookup fails, proceed with notification
    }

    // Check preferences before inserting or publishing.
    // When the feature flag is off, treat all channels as enabled (fail-open fallback).
    let inAppEnabled = true;
    if (env.NOTIFICATION_PREFERENCES_ENABLED) {
      try {
        const pref = await preferenceGuard({ userId, type: 'mention' });
        inAppEnabled = pref.in_app_enabled;
      } catch {
        // Guard failure → fail open: deliver notification as if enabled
        inAppEnabled = true;
      }
    }

    if (!inAppEnabled) continue;

    const [inserted] = await trx('notifications').insert(
      {
        user_id: userId,
        type: 'mention',
        source_type: sourceType,
        source_id: sourceId,
        card_id: cardId,
        board_id: boardId,
        actor_id: actorId,
        read: false,
        created_at: now,
      },
      ['*'],
    );

    await publishToUser(userId, {
      type: 'notification_created',
      payload: {
        notification: {
          ...inserted,
          actor: actorPayload,
        },
      },
    });

    // Fire-and-forget mention email notification — must not block the transaction.
    if (cardId) {
      const cardUrl = `/boards/${boardId}/cards/${cardId}`;
      dispatchNotificationEmail({
        recipientId: userId,
        type: 'mention',
        templateData: {
          actorName: (actorPayload.name as string | null) ?? 'Someone',
          cardTitle: cardTitle ?? '',
          boardName: boardName ?? '',
          cardUrl,
        },
      }).catch(() => {
        // Email dispatch failures must never break the notification flow.
      });
    }
  }
}
