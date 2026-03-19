// boardActivityDispatch.ts — Fire-and-forget notification dispatch for board-level events.
// Handles both email and in-app channels for card_created, card_moved, card_commented events.
// Called from the events pipeline after event persistence. Fetches board members
// and dispatches notifications via emailDispatch and direct DB insert + WS publish.
// Failures are logged and never propagate — this must not block mutations.
import { db } from '../../../common/db';
import { dispatchNotificationEmail } from './emailDispatch';
import { preferenceGuard } from './preferenceGuard';
import { publishToUser } from '../../realtime/userChannel';
import { resolveAvatarUrl } from '../../../common/avatar/resolveAvatarUrl';
import { env } from '../../../config/env';
import type { WrittenEvent } from '../../../mods/events/index';

type SupportedEventType = 'card.created' | 'card.moved' | 'comment_added';

const SUPPORTED_EVENTS = new Set<string>(['card.created', 'card.moved', 'comment_added']);

export async function handleBoardActivityNotification({
  event,
  boardId,
  actorId,
}: {
  event: WrittenEvent;
  boardId: string;
  actorId: string;
}): Promise<void> {
  if (!SUPPORTED_EVENTS.has(event.type)) return;

  try {
    const board = await db('boards').where({ id: boardId }).select('id', 'title', 'workspace_id').first();
    if (!board) return;

    // Fetch all workspace members excluding the actor (board access is workspace-scoped)
    const members = await db('memberships')
      .where({ workspace_id: board.workspace_id })
      .whereNot({ user_id: actorId })
      .select('user_id');

    if (members.length === 0) return;

    const recipientIds = members.map((m: { user_id: string }) => m.user_id);

    const templateData = await buildTemplateData({
      eventType: event.type as SupportedEventType,
      event,
      boardName: board.title,
      actorId,
    });
    if (!templateData) return;

    const notificationType = eventTypeToNotificationType(event.type as SupportedEventType);

    // Fetch actor details once for the WS payload
    const actor = await db('users')
      .where({ id: actorId })
      .select('id', 'nickname', db.raw("COALESCE(name, email) as name"), 'avatar_url')
      .first();
    const actorAvatarUrl = actor?.avatar_url
      ? await resolveAvatarUrl({ avatarUrl: actor.avatar_url })
      : null;
    const actorPayload = {
      id: actorId,
      nickname: actor?.nickname ?? null,
      name: actor?.name ?? null,
      avatar_url: actorAvatarUrl,
    };

    const now = new Date().toISOString();

    // Derive card_id and board_id for the notification row from event payload
    const payload = event.payload as Record<string, unknown>;
    const cardId = (
      (payload.card as { id?: string } | undefined)?.id ??
      (payload.cardId as string | undefined) ??
      null
    );

    // For card_moved, include the destination list name in the WS payload
    // so the client can render "{actorName} moved {cardTitle} to {listName}" without an extra fetch.
    const listTitle = notificationType === 'card_moved' ? (templateData?.toList ?? null) : null;

    // Fire-and-forget per recipient — failures never block the mutation path
    for (const recipientId of recipientIds) {
      // --- In-app channel ---
      let inAppEnabled = true;
      if (env.NOTIFICATION_PREFERENCES_ENABLED) {
        try {
          const pref = await preferenceGuard({ userId: recipientId, type: notificationType });
          inAppEnabled = pref.in_app_enabled;
        } catch {
          inAppEnabled = true; // fail open
        }
      }

      if (inAppEnabled) {
        db('notifications')
          .insert({
            user_id: recipientId,
            type: notificationType,
            source_type: 'board_activity',
            source_id: event.id,
            card_id: cardId,
            board_id: boardId,
            actor_id: actorId,
            read: false,
            created_at: now,
          }, ['*'])
          .then(([inserted]) => {
            if (inserted) {
              publishToUser(recipientId, {
                type: 'notification_created',
                payload: {
                  notification: {
                    ...inserted,
                    list_title: listTitle,
                    actor: actorPayload,
                  },
                },
              });
            }
          })
          .catch(() => {
            // Per-recipient in-app failures are silently swallowed
          });
      }

      // --- Email channel ---
      dispatchNotificationEmail({
        recipientId,
        type: notificationType,
        templateData,
      }).catch(() => {
        // Per-recipient email failures are silently swallowed
      });
    }
  } catch (err) {
    console.warn('[boardActivityDispatch] Failed to dispatch board activity notifications:', err);
  }
}

function eventTypeToNotificationType(eventType: SupportedEventType) {
  switch (eventType) {
    case 'card.created': return 'card_created' as const;
    case 'card.moved': return 'card_moved' as const;
    case 'comment_added': return 'card_commented' as const;
  }
}

async function buildTemplateData({
  eventType,
  event,
  boardName,
  actorId,
}: {
  eventType: SupportedEventType;
  event: WrittenEvent;
  boardName: string;
  actorId: string;
}): Promise<Record<string, string> | null> {
  const payload = event.payload as Record<string, unknown>;

  if (eventType === 'card.created') {
    const card = payload.card as { id: string; title: string; list_id: string } | undefined;
    if (!card) return null;
    const list = await db('lists').where({ id: card.list_id }).select('name').first();
    const cardUrl = `/boards/${event.board_id}/cards/${card.id}`;
    return {
      cardTitle: card.title,
      boardName,
      listName: list?.name ?? '',
      cardUrl,
    };
  }

  if (eventType === 'card.moved') {
    const card = payload.card as { id: string; title: string; list_id: string } | undefined;
    if (!card) return null;
    const fromListId = payload.fromListId as string | undefined;
    const [toList, fromList] = await Promise.all([
      db('lists').where({ id: card.list_id }).select('name').first(),
      fromListId ? db('lists').where({ id: fromListId }).select('name').first() : Promise.resolve(null),
    ]);
    const cardUrl = `/boards/${event.board_id}/cards/${card.id}`;
    return {
      cardTitle: card.title,
      boardName,
      fromList: fromList?.name ?? '',
      toList: toList?.name ?? '',
      cardUrl,
    };
  }

  if (eventType === 'comment_added') {
    const cardId = payload.cardId as string | undefined;
    const cardTitle = payload.cardTitle as string | undefined;
    if (!cardId) return null;

    const actor = await db('users')
      .where({ id: actorId })
      .select(db.raw("COALESCE(name, email) as name"))
      .first();

    const comment = await db('comments')
      .where({ card_id: cardId })
      .orderBy('created_at', 'desc')
      .select('content')
      .first();

    const cardUrl = `/boards/${event.board_id}/cards/${cardId}`;
    // Provide a short preview of the comment (strip HTML tags, max 120 chars)
    const commentText = (comment?.content ?? '').replace(/<[^>]+>/g, '');
    const commentPreview = commentText.length > 120 ? commentText.slice(0, 117) + '…' : commentText;

    return {
      actorName: actor?.name ?? 'Someone',
      cardTitle: cardTitle ?? '',
      boardName,
      commentPreview,
      cardUrl,
    };
  }

  return null;
}
