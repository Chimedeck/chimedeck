// Maps card activity events to notification fan-out for board participants.
// Called after each activity write so recipients are notified according to
// their preferences without blocking the originating mutation.
//
// Activity → notification type mapping:
//   card_created           → card_created  (board participants, excluding actor)
//   card_moved             → card_moved    (board participants, excluding actor)
//   card_member_assigned   → card_member_assigned (assigned user + board participants, excl. actor)
//   card_member_unassigned → card_member_unassigned (unassigned user, excl. actor)
import { db } from '../../../common/db';
import { preferenceGuard } from '../../notifications/mods/preferenceGuard';
import { resolveBoardNotificationPreference } from '../../notifications/mods/boardPreferenceGuard';
import { globalPreferenceGuard } from '../../notifications/mods/globalPreferenceGuard';
import { publishToUser } from '../../realtime/userChannel';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';
import { dispatchNotificationEmail } from '../../notifications/mods/emailDispatch';
import { env } from '../../../config/env';
import { getCardRelatedUserIds, isRecipientRelatedCardNotification } from '../../notifications/mods/relatedCardRecipients';
import type { WrittenActivity } from './write';
import type { NotificationType } from '../../notifications/mods/preferenceGuard';

type ActivityAction =
  | 'card_created'
  | 'card_moved'
  | 'card_member_assigned'
  | 'card_member_unassigned'
  | 'checklist_item_assigned'
  | 'checklist_item_unassigned'
  | 'checklist_item_due_date_updated';

const ACTIVITY_TO_NOTIFICATION: Record<ActivityAction, NotificationType> = {
  card_created: 'card_created',
  card_moved: 'card_moved',
  card_member_assigned: 'card_member_assigned',
  card_member_unassigned: 'card_member_unassigned',
  checklist_item_assigned: 'checklist_item_assigned',
  checklist_item_unassigned: 'checklist_item_unassigned',
  checklist_item_due_date_updated: 'checklist_item_due_date_updated',
};

const CHECKLIST_NOTIFICATION_TYPES = new Set<NotificationType>([
  'checklist_item_assigned',
  'checklist_item_unassigned',
  'checklist_item_due_date_updated',
]);

const SUPPORTED_ACTIONS = new Set<string>(Object.keys(ACTIVITY_TO_NOTIFICATION));

export interface MapActivityToNotificationInput {
  activity: WrittenActivity;
  boardId: string;
}

export async function mapActivityToNotification({
  activity,
  boardId,
}: MapActivityToNotificationInput): Promise<void> {
  if (!SUPPORTED_ACTIONS.has(activity.action)) return;

  try {
    const notificationType = ACTIVITY_TO_NOTIFICATION[activity.action as ActivityAction];
    const payload = normalisePayload(activity.payload);

    const board = await db('boards')
      .where({ id: boardId })
      .select('id', 'title', 'workspace_id')
      .first();
    if (!board) return;

    // Resolve recipients from board-level access only.
    // [why] Guests are workspace-scoped with per-board grants; using workspace memberships
    // leaks notifications across boards for users that are guests on a different board.
    const [boardMembers, boardGuests] = await Promise.all([
      db('board_members').where({ board_id: boardId }).select('user_id'),
      db('board_guest_access').where({ board_id: boardId }).select('user_id'),
    ]);

    const recipientSet = new Set<string>();
    for (const row of boardMembers as Array<{ user_id: string }>) {
      if (row.user_id !== activity.actor_id) recipientSet.add(row.user_id);
    }
    for (const row of boardGuests as Array<{ user_id: string }>) {
      if (row.user_id !== activity.actor_id) recipientSet.add(row.user_id);
    }

    let recipientIds = Array.from(recipientSet);

    if (CHECKLIST_NOTIFICATION_TYPES.has(notificationType)) {
      const checklistRecipients = new Set<string>();
      const currentUserId = typeof payload.userId === 'string' ? payload.userId : null;
      const previousUserId = typeof payload.previousUserId === 'string' ? payload.previousUserId : null;

      if (notificationType === 'checklist_item_assigned' && currentUserId && currentUserId !== activity.actor_id) {
        checklistRecipients.add(currentUserId);
      }

      if (notificationType === 'checklist_item_unassigned' && previousUserId && previousUserId !== activity.actor_id) {
        checklistRecipients.add(previousUserId);
      }

      if (notificationType === 'checklist_item_due_date_updated') {
        if (currentUserId && currentUserId !== activity.actor_id) {
          checklistRecipients.add(currentUserId);
        }
      }

      recipientIds = Array.from(checklistRecipients);
    }

    if (recipientIds.length === 0) return;

    // Resolve actor display info once for the WS payload.
    const actor = await db('users')
      .where({ id: activity.actor_id })
      .select('id', 'nickname', db.raw("COALESCE(name, email) as name"), 'avatar_url')
      .first();
    const actorAvatarUrl = actor?.avatar_url
      ? buildAvatarProxyUrl({ userId: actor.id, avatarUrl: actor.avatar_url })
      : null;
    const actorPayload = {
      id: activity.actor_id,
      nickname: actor?.nickname ?? null,
      name: actor?.name ?? null,
      avatar_url: actorAvatarUrl,
    };

    const now = new Date().toISOString();
    const cardId = (payload.cardId as string | undefined) ?? null;
    const cardTitle = (payload.cardTitle as string | undefined) ?? null;
    const relatedUserIds = await getCardRelatedUserIds({ cardId });

    // Derive extra context fields for the WS payload depending on event type.
    const listTitle =
      notificationType === 'card_moved'
        ? ((payload.toListName as string | undefined) ?? null)
        : null;

    const emailTemplateData = buildEmailTemplateData({
      action: activity.action as ActivityAction,
      payload,
      boardName: board.title,
      actorName: actorPayload.name ?? 'Someone',
    });

    for (const recipientId of recipientIds) {
      // Board-scoped and global opt-out guards — mirrors boardActivityDispatch.
      try {
        const [globalEnabled, boardPreference] = await Promise.all([
          globalPreferenceGuard({ userId: recipientId }),
          resolveBoardNotificationPreference({ userId: recipientId, boardId }),
        ]);
        if (!globalEnabled || !boardPreference.notificationsEnabled) continue;

        if (
          boardPreference.onlyRelatedToMe
          && !isRecipientRelatedCardNotification({
            type: notificationType,
            recipientId,
            relatedUserIds,
          })
        ) {
          continue;
        }
      } catch {
        // Fail open: if guard lookup fails, proceed with notification
      }

      // Preference check — fail-open when the feature flag is off or guard throws.
      let inAppEnabled = true;
      if (env.NOTIFICATION_PREFERENCES_ENABLED) {
        try {
          const pref = await preferenceGuard({ userId: recipientId, type: notificationType });
          inAppEnabled = pref.in_app_enabled;
        } catch {
          inAppEnabled = true;
        }
      }

      if (inAppEnabled) {
        db('notifications')
          .insert(
            {
              user_id: recipientId,
              type: notificationType,
              source_type: 'board_activity',
              source_id: activity.id,
              card_id: cardId,
              board_id: boardId,
              actor_id: activity.actor_id,
              read: false,
              created_at: now,
            },
            ['*'],
          )
          .then(([inserted]) => {
            if (inserted) {
              return publishToUser(recipientId, {
                type: 'notification_created',
                payload: {
                  notification: {
                    ...inserted,
                    card_title: cardTitle,
                    board_title: board.title,
                    list_title: listTitle,
                    actor: actorPayload,
                  },
                },
              });
            }
          })
          .catch(() => {});
      }

      if (emailTemplateData) {
        dispatchNotificationEmail({
          recipientId,
          type: notificationType,
          templateData: emailTemplateData,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[mapActivityToNotification] Failed to dispatch notifications:', err);
  }
}

function normalisePayload(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function buildEmailTemplateData({
  action,
  payload,
  boardName,
  actorName,
}: {
  action: ActivityAction;
  payload: Record<string, unknown>;
  boardName: string;
  actorName: string;
}): Record<string, string> | null {
  const cardId = payload.cardId as string | undefined;
  const cardTitle = (payload.cardTitle as string | undefined) ?? '';
  const boardId = payload.boardId as string | undefined;
  const cardUrl = boardId && cardId ? `/boards/${boardId}/cards/${cardId}` : '';

  switch (action) {
    case 'card_created':
      return {
        cardTitle,
        boardName,
        listName: (payload.listName as string | undefined) ?? '',
        cardUrl,
      };

    case 'card_moved':
      return {
        cardTitle,
        boardName,
        fromList: (payload.fromListName as string | undefined) ?? '',
        toList: (payload.toListName as string | undefined) ?? '',
        cardUrl,
      };

    case 'card_member_assigned':
      return {
        actorName,
        cardTitle,
        boardName,
        cardUrl,
      };

    case 'card_member_unassigned':
      return {
        actorName,
        cardTitle,
        boardName,
        cardUrl,
      };

    case 'checklist_item_assigned':
    case 'checklist_item_unassigned':
    case 'checklist_item_due_date_updated':
      return null;

    default:
      return null;
  }
}
