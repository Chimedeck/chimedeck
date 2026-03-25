// Maps card activity events to notification fan-out for workspace members.
// Called after each activity write so recipients are notified according to
// their preferences without blocking the originating mutation.
//
// Activity → notification type mapping:
//   card_created           → card_created  (workspace members, excluding actor)
//   card_moved             → card_moved    (workspace members, excluding actor)
//   card_member_assigned   → card_member_assigned (assigned user + workspace members, excl. actor)
//   card_member_unassigned → card_member_unassigned (unassigned user, excl. actor)
import { db } from '../../../common/db';
import { preferenceGuard } from '../../notifications/mods/preferenceGuard';
import { boardPreferenceGuard } from '../../notifications/mods/boardPreferenceGuard';
import { globalPreferenceGuard } from '../../notifications/mods/globalPreferenceGuard';
import { publishToUser } from '../../realtime/userChannel';
import { buildAvatarProxyUrl } from '../../../common/avatar/resolveAvatarUrl';
import { dispatchNotificationEmail } from '../../notifications/mods/emailDispatch';
import { env } from '../../../config/env';
import type { WrittenActivity } from './write';
import type { NotificationType } from '../../notifications/mods/preferenceGuard';

type ActivityAction =
  | 'card_created'
  | 'card_moved'
  | 'card_member_assigned'
  | 'card_member_unassigned';

const ACTIVITY_TO_NOTIFICATION: Record<ActivityAction, NotificationType> = {
  card_created: 'card_created',
  card_moved: 'card_moved',
  card_member_assigned: 'card_member_assigned',
  card_member_unassigned: 'card_member_unassigned',
};

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
    const payload = activity.payload as Record<string, unknown>;

    const board = await db('boards')
      .where({ id: boardId })
      .select('id', 'title', 'workspace_id')
      .first();
    if (!board) return;

    // Determine recipients based on action type.
    // card_member_assigned/unassigned — notify the affected user plus workspace members.
    // All other events — notify all workspace members.
    const workspaceMembers = await db('memberships')
      .where({ workspace_id: board.workspace_id })
      .whereNot({ user_id: activity.actor_id })
      .select('user_id');

    const workspaceMemberIds: string[] = workspaceMembers.map(
      (m: { user_id: string }) => m.user_id,
    );

    let recipientIds = workspaceMemberIds;

    // For assignment events, also include the affected user if they are not already in the list.
    if (
      activity.action === 'card_member_assigned' ||
      activity.action === 'card_member_unassigned'
    ) {
      const affectedUserId = payload.userId as string | undefined;
      if (affectedUserId && affectedUserId !== activity.actor_id) {
        if (!recipientIds.includes(affectedUserId)) {
          recipientIds = [...recipientIds, affectedUserId];
        }
      }
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
        const [globalEnabled, boardEnabled] = await Promise.all([
          globalPreferenceGuard({ userId: recipientId }),
          boardPreferenceGuard({ userId: recipientId, boardId }),
        ]);
        if (!globalEnabled || !boardEnabled) continue;
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
              publishToUser(recipientId, {
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

    default:
      return null;
  }
}
