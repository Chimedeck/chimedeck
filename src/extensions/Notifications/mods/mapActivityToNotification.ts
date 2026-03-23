// Client-side utility that converts a card activity event payload into a
// human-readable notification display object.
//
// WHY: activity events and notification objects share overlapping data but
// different shapes. This mapper produces a consistent display record that can
// be rendered by NotificationItem without the component needing to understand
// raw activity payloads.
//
// Respects user preferences by accepting the caller's resolved preference map.
// When in_app_enabled is false for the matching type, the function returns null
// so the caller can skip rendering or storage.

import type { NotificationType } from '~/extensions/Notification/api';

export type ActivityAction =
  | 'card_created'
  | 'card_moved'
  | 'card_commented'
  | 'card_member_assigned'
  | 'card_member_unassigned'
  | 'card_updated'
  | 'card_deleted'
  | 'card_archived';

// Map activity actions to notification types. Preference lookups use this key.
const ACTION_TO_NOTIFICATION_TYPE: Record<ActivityAction, NotificationType | string> = {
  card_created: 'card_created',
  card_moved: 'card_moved',
  card_commented: 'card_commented',
  card_member_assigned: 'card_member_assigned',
  card_member_unassigned: 'card_member_unassigned',
  card_updated: 'card_updated',
  card_deleted: 'card_deleted',
  card_archived: 'card_archived',
};

export interface ActivityPayload {
  cardId?: string | null;
  cardTitle?: string | null;
  boardId?: string | null;
  listId?: string | null;
  listName?: string | null;
  fromListId?: string | null;
  fromListName?: string | null;
  toListId?: string | null;
  toListName?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
  changedFields?: string[] | null;
  archived?: boolean | null;
  commentPreview?: string | null;
  commentId?: string | null;
}

export interface ActivityNotificationDisplay {
  /** The mapped notification type key (matches the preferences system). */
  type: NotificationType | string;
  /** Human-readable one-line summary suitable for a notification panel row. */
  copy: string;
  /** Destination list name (populated only for card_moved). */
  listTitle: string | null;
  cardId: string | null;
  boardId: string | null;
}

interface MapOptions {
  actorName: string;
  action: ActivityAction;
  payload: ActivityPayload;
  /** Preference map keyed by notification type. When omitted all types are treated as enabled. */
  preferences?: Partial<Record<string, { in_app_enabled: boolean }>>;
}

/**
 * Maps a card activity event to a notification display object.
 * Returns null when the user has opted out of in-app notifications for this type.
 */
export function mapActivityToNotification({
  actorName,
  action,
  payload,
  preferences,
}: MapOptions): ActivityNotificationDisplay | null {
  const notificationType = ACTION_TO_NOTIFICATION_TYPE[action];

  // Respect preference opt-out — treat missing row as enabled (opt-out model).
  const pref = preferences?.[notificationType];
  if (pref && pref.in_app_enabled === false) return null;

  const copy = buildCopy({ actorName, action, payload });

  return {
    type: notificationType,
    copy,
    listTitle:
      action === 'card_moved' ? ((payload.toListName as string | undefined) ?? null) : null,
    cardId: payload.cardId ?? null,
    boardId: payload.boardId ?? null,
  };
}

function buildCopy({
  actorName,
  action,
  payload,
}: {
  actorName: string;
  action: ActivityAction;
  payload: ActivityPayload;
}): string {
  const card = payload.cardTitle ? `"${payload.cardTitle}"` : 'a card';

  switch (action) {
    case 'card_created':
      return payload.listName
        ? `${actorName} created ${card} in ${payload.listName}`
        : `${actorName} created ${card}`;

    case 'card_commented':
      return payload.commentPreview
        ? `${actorName} commented on ${card}: "${payload.commentPreview}"`
        : `${actorName} commented on ${card}`;

    case 'card_moved':
      if (payload.fromListName && payload.toListName) {
        return `${actorName} moved ${card} from ${payload.fromListName} to ${payload.toListName}`;
      }
      return payload.toListName
        ? `${actorName} moved ${card} to ${payload.toListName}`
        : `${actorName} moved ${card}`;

    case 'card_member_assigned':
      return `${actorName} was assigned to ${card}`;

    case 'card_member_unassigned':
      return `${actorName} was removed from ${card}`;

    case 'card_updated': {
      const fields = payload.changedFields?.join(', ');
      return fields ? `${actorName} updated ${card} (${fields})` : `${actorName} updated ${card}`;
    }

    case 'card_deleted':
      return `${actorName} deleted ${card}`;

    case 'card_archived':
      return payload.archived === false
        ? `${actorName} unarchived ${card}`
        : `${actorName} archived ${card}`;
  }
}
