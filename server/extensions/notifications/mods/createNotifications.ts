// server/extensions/notifications/mods/createNotifications.ts
// Creates notification rows for each newly-mentioned user and broadcasts
// a real-time event to their personal WS channel.
import { db } from '../../../common/db';
import { publishToUser } from '../../realtime/userChannel';
import type { Knex } from 'knex';

interface CreateNotificationsParams {
  trx: Knex.Transaction;
  addedUserIds: string[];
  actorId: string;
  sourceType: 'card_description' | 'comment';
  sourceId: string;
  cardId: string | null;
  boardId: string;
}

export async function createNotificationsForMentions({
  trx,
  addedUserIds,
  actorId,
  sourceType,
  sourceId,
  cardId,
  boardId,
}: CreateNotificationsParams): Promise<void> {
  if (addedUserIds.length === 0) return;

  // Don't notify the actor about their own mentions
  const recipients = addedUserIds.filter((id) => id !== actorId);
  if (recipients.length === 0) return;

  const now = new Date().toISOString();
  const rows = recipients.map((userId) => ({
    user_id: userId,
    type: 'mention',
    source_type: sourceType,
    source_id: sourceId,
    card_id: cardId,
    board_id: boardId,
    actor_id: actorId,
    read: false,
    created_at: now,
  }));

  const inserted = await trx('notifications').insert(rows, ['*']);

  // Fetch actor details for the WS payload (outside transaction is fine — read-only)
  const actor = await db('users')
    .where({ id: actorId })
    .select('id', 'nickname', db.raw("COALESCE(name, email) as name"), 'avatar_url')
    .first();

  for (const notification of inserted) {
    publishToUser(notification.user_id, {
      type: 'notification_created',
      payload: {
        notification: {
          ...notification,
          actor: actor ?? { id: actorId, nickname: null, name: null, avatar_url: null },
        },
      },
    });
  }
}
