// boardActivityDispatch.ts — Fire-and-forget notification dispatch for board-level events.
// Handles both email and in-app channels for card_created, card_moved events (events pipeline).
// card_commented and direct card mutations are dispatched via dispatchDirectCardNotification.
// Called from the events pipeline after event persistence. Fetches board participants
// (joined members + board guests) and filters out users who opted out at the board or global level.
// Failures are logged and never propagate — this must not block mutations.
import { db } from '../../../common/db';
import { dispatchNotificationEmail } from './emailDispatch';
import { boardPreferenceGuard, resolveNotificationChannels } from './boardPreferenceGuard';
import { globalPreferenceGuard } from './globalPreferenceGuard';
import { publishToUser } from '../../realtime/userChannel';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';
import { env } from '../../../config/env';
import type { WrittenEvent } from '../../../mods/events/index';

type SupportedEventType = 'card.created' | 'card.moved';

// Direct-dispatch payload union for card mutation and comment events.
// These are fired from card/comment endpoints directly rather than via the events pipeline.
// card_commented stores commentId in source_id so recipients can navigate to the exact comment.
export type DirectCardNotificationPayload =
  | { type: 'card_updated'; cardTitle: string; changedFields: string[] }
  | { type: 'card_deleted'; cardTitle: string }
  | { type: 'card_archived'; cardTitle: string; archived: boolean }
  | { type: 'card_commented'; cardTitle: string; commentPreview: string; commentId: string };

const SUPPORTED_EVENTS = new Set<string>(['card.created', 'card.moved']);

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

    // Fetch all board participants (joined members + explicit board guests), excluding actor.
    const [members, guests] = await Promise.all([
      db('board_members')
        .where({ board_id: boardId })
        .whereNot({ user_id: actorId })
        .select('user_id'),
      db('board_guest_access')
        .where({ board_id: boardId })
        .whereNot({ user_id: actorId })
        .select('user_id'),
    ]);

    const recipientIds = Array.from(
      new Set([
        ...members.map((m: { user_id: string }) => m.user_id),
        ...guests.map((g: { user_id: string }) => g.user_id),
      ]),
    );

    if (recipientIds.length === 0) return;

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
      ? buildAvatarProxyUrl({ userId: actorId, avatarUrl: actor.avatar_url })
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
      // --- Board-scoped and global opt-out guards (Sprint 95) ---
      // Both checks use opt-out model: missing row = enabled.
      try {
        const [globalEnabled, boardEnabled] = await Promise.all([
          globalPreferenceGuard({ userId: recipientId }),
          boardPreferenceGuard({ userId: recipientId, boardId }),
        ]);
        if (!globalEnabled || !boardEnabled) continue;
      } catch {
        // Fail open: if guard lookup fails, proceed with notification
      }

      // --- In-app and email channel resolution (Sprint 100: board-type cascade) ---
      let inAppEnabled = true;
      let emailEnabled = true;
      if (env.NOTIFICATION_PREFERENCES_ENABLED) {
        try {
          const channels = await resolveNotificationChannels({
            userId: recipientId,
            boardId,
            type: notificationType,
          });
          inAppEnabled = channels.inApp;
          emailEnabled = channels.email;
        } catch {
          // Fail open
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
              return publishToUser(recipientId, {
                type: 'notification_created',
                payload: {
                  notification: {
                    ...inserted,
                    card_title: templateData.cardTitle ?? null,
                    board_title: board.title,
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
        emailEnabled,
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
    const list = await db('lists').where({ id: card.list_id }).select('title').first();
    const cardUrl = `/boards/${event.board_id}/cards/${card.id}`;
    return {
      cardTitle: card.title,
      boardName,
      listName: list?.title ?? '',
      cardUrl,
    };
  }

  if (eventType === 'card.moved') {
    const card = payload.card as { id: string; title: string; list_id: string } | undefined;
    if (!card) return null;
    const fromListId = payload.fromListId as string | undefined;
    const [toList, fromList] = await Promise.all([
      db('lists').where({ id: card.list_id }).select('title').first(),
      fromListId ? db('lists').where({ id: fromListId }).select('title').first() : Promise.resolve(null),
    ]);
    const cardUrl = `/boards/${event.board_id}/cards/${card.id}`;
    return {
      cardTitle: card.title,
      boardName,
      fromList: fromList?.title ?? '',
      toList: toList?.title ?? '',
      cardUrl,
    };
  }

  return null;
}

// Dispatches in-app notifications to all board members (except actor) for direct card mutations.
// Also dispatches email for card_commented.
// Fire-and-forget — callers must not await this; failures are swallowed internally.
export async function dispatchDirectCardNotification({
  payload,
  boardId,
  cardId,
  actorId,
  excludedUserIds = [],
}: {
  payload: DirectCardNotificationPayload;
  boardId: string;
  cardId: string;
  actorId: string;
  // [why] Allows callers to suppress board-activity fanout for recipients who
  // already got a more specific notification (e.g. @mention on comment create).
  excludedUserIds?: string[];
}): Promise<void> {
  try {
    const [members, guests] = await Promise.all([
      db('board_members')
        .where({ board_id: boardId })
        .whereNot({ user_id: actorId })
        .select('user_id'),
      db('board_guest_access')
        .where({ board_id: boardId })
        .whereNot({ user_id: actorId })
        .select('user_id'),
    ]);

    const excludedRecipientIds = new Set(
      excludedUserIds.filter((id) => id !== actorId),
    );

    const recipients = Array.from(
      new Set([
        ...members.map((m: { user_id: string }) => m.user_id),
        ...guests.map((g: { user_id: string }) => g.user_id),
      ]),
    ).filter((recipientId) => !excludedRecipientIds.has(recipientId));

    if (recipients.length === 0) return;

    const actor = await db('users')
      .where({ id: actorId })
      .select('id', 'nickname', db.raw("COALESCE(name, email) as name"), 'avatar_url')
      .first();
    const actorAvatarUrl = actor?.avatar_url
      ? buildAvatarProxyUrl({ userId: actorId, avatarUrl: actor.avatar_url })
      : null;
    const actorPayloadData = {
      id: actorId,
      nickname: actor?.nickname ?? null,
      name: actor?.name ?? null,
      avatar_url: actorAvatarUrl,
    };

    const notificationType = payload.type;
    const now = new Date().toISOString();
    const cardTitle = payload.cardTitle;

    // For direct card events, source_id must always be non-null (notifications schema).
    // Use an event-unique source id for non-comment events so board_activity dedupe
    // does not collapse repeated actions on the same card over time.
    // Comment notifications keep commentId for deep-linking.
    let emailTemplateData: Record<string, string> | null = null;
    let sourceId = `${cardId}:${now}`;

    if (payload.type === 'card_commented') {
      sourceId = payload.commentId;
      const board = await db('boards').where({ id: boardId }).select('title').first();
      emailTemplateData = {
        actorName: actor?.name ?? 'Someone',
        cardTitle: payload.cardTitle,
        boardName: board?.title ?? '',
        commentPreview: payload.commentPreview,
        cardUrl: `/boards/${boardId}/cards/${cardId}`,
      };
    } else if (payload.type === 'card_updated') {
      const board = await db('boards').where({ id: boardId }).select('title').first();
      emailTemplateData = {
        actorName: actor?.name ?? 'Someone',
        cardTitle: payload.cardTitle,
        boardName: board?.title ?? '',
        // Serialise changedFields as JSON so emailDispatch can parse the array
        changedFields: JSON.stringify(payload.changedFields),
        cardUrl: `/boards/${boardId}/cards/${cardId}`,
      };
    } else if (payload.type === 'card_deleted') {
      const board = await db('boards').where({ id: boardId }).select('title').first();
      emailTemplateData = {
        actorName: actor?.name ?? 'Someone',
        cardTitle: payload.cardTitle,
        boardName: board?.title ?? '',
        boardUrl: `/boards/${boardId}`,
      };
    } else if (payload.type === 'card_archived') {
      const board = await db('boards').where({ id: boardId }).select('title').first();
      emailTemplateData = {
        actorName: actor?.name ?? 'Someone',
        cardTitle: payload.cardTitle,
        boardName: board?.title ?? '',
        // Serialise boolean as string; emailDispatch uses !== 'false' to parse
        archived: String(payload.archived),
        cardUrl: `/boards/${boardId}/cards/${cardId}`,
      };
    }

    for (const recipientId of recipients) {
      try {
        const [globalEnabled, boardEnabled] = await Promise.all([
          globalPreferenceGuard({ userId: recipientId }),
          boardPreferenceGuard({ userId: recipientId, boardId }),
        ]);
        if (!globalEnabled || !boardEnabled) continue;
      } catch {
        // Fail open
      }

      let inAppEnabled = true;
      let emailEnabled = true;
      if (env.NOTIFICATION_PREFERENCES_ENABLED) {
        try {
          const channels = await resolveNotificationChannels({
            userId: recipientId,
            boardId,
            type: notificationType,
          });
          inAppEnabled = channels.inApp;
          emailEnabled = channels.email;
        } catch {
          // Fail open
        }
      }

      if (inAppEnabled) {
        db('notifications')
          .insert({
            user_id: recipientId,
            type: notificationType,
            source_type: 'board_activity',
            source_id: sourceId,
            card_id: cardId,
            board_id: boardId,
            actor_id: actorId,
            read: false,
            created_at: now,
          }, ['*'])
          .then(([inserted]) => {
            if (inserted) {
              return publishToUser(recipientId, {
                type: 'notification_created',
                payload: {
                  notification: {
                    ...inserted,
                    card_title: cardTitle,
                    board_title: emailTemplateData?.boardName ?? null,
                    list_title: null,
                    actor: actorPayloadData,
                  },
                },
              });
            }
          })
          .catch(() => {});
      }

      // Dispatch email for card_commented
      if (emailTemplateData) {
        dispatchNotificationEmail({
          recipientId,
          type: notificationType,
          templateData: emailTemplateData,
          emailEnabled,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[boardActivityDispatch] dispatchDirectCardNotification failed:', err);
  }
}
