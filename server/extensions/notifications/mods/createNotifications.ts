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
import { getActiveWebhooksForEvent } from '../../webhooks/mods/registry';
import { dispatchWebhook } from '../../webhooks/mods/dispatch';
import type { Knex } from 'knex';

// [why] extracted to keep createNotificationsForMentions within the cognitive complexity limit.
async function fireMentionWebhooks({
  boardId,
  cardId,
  sourceType,
  sourceId,
  actorId,
  recipients,
}: {
  boardId: string;
  cardId: string | null;
  sourceType: string;
  sourceId: string;
  actorId: string;
  recipients: string[];
}): Promise<void> {
  const webhooks = await getActiveWebhooksForEvent({ knex: db, eventType: 'mention' });
  for (const wh of webhooks) {
    dispatchWebhook({
      endpoint: wh.endpoint_url,
      signingSecret: wh.signing_secret,
      eventType: 'mention',
      payload: { boardId, cardId, sourceType, sourceId, actorId, mentionedUserIds: recipients },
      webhookId: wh.id,
      knex: db,
    });
  }
}

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

// [why] extracted to keep createNotificationsForMentions within the cognitive complexity limit.
async function notifyMentionedUser({
  trx,
  userId,
  boardId,
  sourceType,
  sourceId,
  cardId,
  actorId,
  actorPayload,
  cardTitle,
  boardName,
  now,
}: {
  trx: Knex.Transaction;
  userId: string;
  boardId: string;
  sourceType: 'card_description' | 'comment';
  sourceId: string;
  cardId: string | null;
  actorId: string;
  actorPayload: Record<string, unknown>;
  cardTitle: string;
  boardName: string;
  now: string;
}): Promise<void> {
  try {
    const [globalEnabled, boardEnabled] = await Promise.all([
      globalPreferenceGuard({ userId }),
      boardPreferenceGuard({ userId, boardId }),
    ]);
    if (!globalEnabled || !boardEnabled) return;
  } catch {
    // Fail open: if guard lookup fails, proceed with notification
  }

  let inAppEnabled = true;
  if (env.NOTIFICATION_PREFERENCES_ENABLED) {
    try {
      const pref = await preferenceGuard({ userId, type: 'mention' });
      inAppEnabled = pref.in_app_enabled;
    } catch {
      inAppEnabled = true;
    }
  }
  if (!inAppEnabled) return;

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
        card_title: cardTitle,
        board_title: boardName,
        list_title: null,
        actor: actorPayload,
      },
    },
  });

  if (cardId) {
    const cardUrl = `/boards/${boardId}/cards/${cardId}`;
    dispatchNotificationEmail({
      recipientId: userId,
      type: 'mention',
      templateData: {
        actorName: (actorPayload.name as string | null) ?? 'Someone',
        cardTitle,
        boardName,
        cardUrl,
      },
    }).catch(() => {});
  }
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
    await notifyMentionedUser({
      trx,
      userId,
      boardId,
      sourceType,
      sourceId,
      cardId,
      actorId,
      actorPayload: actorPayload as Record<string, unknown>,
      cardTitle: cardTitle ?? '',
      boardName: boardName ?? '',
      now,
    });
  }

  // Fire-and-forget mention webhook — dispatched once per mention event (not per recipient).
  // [why] webhook subscribers receive the full mention context rather than a per-user notification.
  if (env.WEBHOOKS_ENABLED) {
    fireMentionWebhooks({ boardId, cardId, sourceType, sourceId, actorId, recipients }).catch(() => {
      // Webhook errors must never propagate to the caller.
    });
  }
}
