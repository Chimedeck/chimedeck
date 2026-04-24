// createReactionNotification — creates an in-app notification for the comment author
// when someone reacts to their comment. Skips notification when the actor IS the author.
// Respects global, board-level, and per-type opt-out preferences.
import { db } from '../../../common/db';
import { publishToUser } from '../../realtime/userChannel';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';
import { preferenceGuard } from './preferenceGuard';
import { boardPreferenceGuard } from './boardPreferenceGuard';
import { globalPreferenceGuard } from './globalPreferenceGuard';
import { env } from '../../../config/env';

export async function createReactionNotification({
  commentId,
  actorId,
  emoji,
  cardId,
  boardId,
}: {
  commentId: string;
  actorId: string;
  emoji: string;
  cardId: string;
  boardId: string;
}): Promise<void> {
  try {
    // Load comment author — we notify them about the reaction
    const comment = await db('comments')
      .where({ id: commentId })
      .select('user_id')
      .first() as { user_id: string } | undefined;
    if (!comment) return;

    const recipientId: string = comment.user_id;

    // Don't notify someone about their own reaction
    if (recipientId === actorId) return;

    // Global opt-out guard
    const globalEnabled = await globalPreferenceGuard({ userId: recipientId }).catch(() => true);
    if (!globalEnabled) return;

    // Board-level opt-out guard
    const boardEnabled = await boardPreferenceGuard({ userId: recipientId, boardId }).catch(() => true);
    if (!boardEnabled) return;

    // Per-type preference (opt-out model)
    let inAppEnabled = true;
    if (env.NOTIFICATION_PREFERENCES_ENABLED) {
      const pref = await preferenceGuard({ userId: recipientId, type: 'comment_reaction' }).catch(() => null);
      if (pref) inAppEnabled = pref.in_app_enabled;
    }
    if (!inAppEnabled) return;

    // Fetch actor details for the notification payload
    const actor = await db('users')
      .where({ id: actorId })
      .select('id', 'nickname', db.raw("COALESCE(name, email) as name"), 'avatar_url')
      .first() as { id: string; nickname: string | null; name: string | null; avatar_url: string | null } | undefined;
    const actorAvatarUrl = actor?.avatar_url
      ? buildAvatarProxyUrl({ userId: actorId, avatarUrl: actor.avatar_url })
      : null;
    const actorPayload = {
      id: actorId,
      nickname: actor?.nickname ?? null,
      name: actor?.name ?? null,
      avatar_url: actorAvatarUrl,
    };

    // Fetch card title and board title for display
    const card = await db('cards')
      .where({ id: cardId })
      .select('title')
      .first() as { title: string } | undefined;
    const board = await db('boards')
      .where({ id: boardId })
      .select('title')
      .first() as { title: string } | undefined;
    const now = new Date().toISOString();

    const [inserted] = await db('notifications').insert(
      {
        user_id: recipientId,
        type: 'comment_reaction',
        source_type: 'comment',
        source_id: commentId,
        card_id: cardId,
        board_id: boardId,
        emoji,
        actor_id: actorId,
        read: false,
        created_at: now,
      },
      ['*'],
    ) as [Record<string, unknown>];

    await publishToUser(recipientId, {
      type: 'notification_created',
      payload: {
        notification: {
          ...inserted,
          // [why] Sideload fields the client joins from other tables so it can render
          // the notification copy without extra fetches.
          card_title: card?.title ?? null,
          board_title: board?.title ?? null,
          list_title: null,
          actor: actorPayload,
          // Pass emoji in the notification payload so the copy can say "X reacted 👍"
          emoji,
        },
      },
    }).catch(() => {});
  } catch {
    // Notification failures are never fatal — swallow silently
  }
}
