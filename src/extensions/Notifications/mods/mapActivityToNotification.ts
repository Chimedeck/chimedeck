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
  | 'checklist_item_assigned'
  | 'checklist_item_unassigned'
  | 'checklist_item_due_date_updated'
  | 'card_updated'
  | 'card_deleted'
  | 'card_archived';

// Map activity actions to notification types. Preference lookups use this key.
const ACTION_TO_NOTIFICATION_TYPE: Record<ActivityAction, NotificationType> = {
  card_created: 'card_created',
  card_moved: 'card_moved',
  card_commented: 'card_commented',
  card_member_assigned: 'card_member_assigned',
  card_member_unassigned: 'card_member_unassigned',
  checklist_item_assigned: 'checklist_item_assigned',
  checklist_item_unassigned: 'checklist_item_unassigned',
  checklist_item_due_date_updated: 'checklist_item_due_date_updated',
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
  previousUserId?: string | null;
  assigneeName?: string | null;
  workspaceId?: string | null;
  changedFields?: string[] | null;
  archived?: boolean | null;
  commentPreview?: string | null;
  commentId?: string | null;
}

export interface ActivityNotificationDisplay {
  /** The mapped notification type key (matches the preferences system). */
  type: NotificationType;
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
  currentUserId?: string | null;
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
  currentUserId,
  preferences,
}: MapOptions): ActivityNotificationDisplay | null {
  const notificationType = ACTION_TO_NOTIFICATION_TYPE[action];

  // Respect preference opt-out — treat missing row as enabled (opt-out model).
  const pref = preferences?.[notificationType];
  if (pref && !pref.in_app_enabled) return null;

  const copy = buildCopy({ actorName, action, payload, currentUserId: currentUserId ?? null });

  return {
    type: notificationType,
    copy,
    listTitle:
      action === 'card_moved' ? ((payload.toListName as string | undefined) ?? null) : null,
    cardId: payload.cardId ?? null,
    boardId: payload.boardId ?? null,
  };
}

interface CopyContext {
  actorName: string;
  payload: ActivityPayload;
  card: string;
  currentUserId: string | null;
  targetUserName: string;
  isTargetCurrentUser: boolean;
}

function resolveUserTarget({
  payload,
  currentUserId,
}: {
  payload: ActivityPayload;
  currentUserId: string | null;
}): { targetUserName: string; isTargetCurrentUser: boolean } {
  const targetUserId = payload.userId ?? payload.previousUserId ?? null;
  const hasCurrentUserContext = currentUserId != null && currentUserId !== '';
  const isTargetCurrentUser = hasCurrentUserContext
    ? targetUserId != null && targetUserId === currentUserId
    : true;
  const targetUserName = payload.assigneeName?.trim() || 'a member';

  return { targetUserName, isTargetCurrentUser };
}

const COPY_BUILDERS: Record<ActivityAction, (ctx: CopyContext) => string> = {
  card_created: ({ actorName, payload, card }) => (payload.listName
    ? `${actorName} created ${card} in ${payload.listName}`
    : `${actorName} created ${card}`),
  card_moved: ({ actorName, payload, card }) => {
    if (payload.fromListName && payload.toListName) {
      return `${actorName} moved ${card} from ${payload.fromListName} to ${payload.toListName}`;
    }
    return payload.toListName
      ? `${actorName} moved ${card} to ${payload.toListName}`
      : `${actorName} moved ${card}`;
  },
  card_commented: ({ actorName, payload, card }) => (payload.commentPreview
    ? `${actorName} commented on ${card}: "${payload.commentPreview}"`
    : `${actorName} commented on ${card}`),
  card_member_assigned: ({ actorName, card, isTargetCurrentUser, targetUserName }) => (isTargetCurrentUser
    ? `${actorName} assigned you to ${card}`
    : `${actorName} assigned ${targetUserName} to ${card}`),
  card_member_unassigned: ({ actorName, card, isTargetCurrentUser, targetUserName }) => (isTargetCurrentUser
    ? `${actorName} removed you from ${card}`
    : `${actorName} removed ${targetUserName} from ${card}`),
  checklist_item_assigned: ({ actorName, card, isTargetCurrentUser, targetUserName }) => (isTargetCurrentUser
    ? `${actorName} assigned you to a checklist item in ${card}`
    : `${actorName} assigned ${targetUserName} to a checklist item in ${card}`),
  checklist_item_unassigned: ({ actorName, card, isTargetCurrentUser, targetUserName }) => (isTargetCurrentUser
    ? `${actorName} removed you from a checklist item in ${card}`
    : `${actorName} removed ${targetUserName} from a checklist item in ${card}`),
  checklist_item_due_date_updated: ({ actorName, card }) => `${actorName} updated a checklist due date in ${card}`,
  card_updated: ({ actorName, payload, card }) => {
    const fields = payload.changedFields?.join(', ');
    return fields ? `${actorName} updated ${card} (${fields})` : `${actorName} updated ${card}`;
  },
  card_deleted: ({ actorName, card }) => `${actorName} deleted ${card}`,
  card_archived: ({ actorName, payload, card }) => (payload.archived === false
    ? `${actorName} unarchived ${card}`
    : `${actorName} archived ${card}`),
};

function buildCopy({
  actorName,
  action,
  payload,
  currentUserId,
}: {
  actorName: string;
  action: ActivityAction;
  payload: ActivityPayload;
  currentUserId: string | null;
}): string {
  const card = payload.cardTitle ? `"${payload.cardTitle}"` : 'a card';
  const { targetUserName, isTargetCurrentUser } = resolveUserTarget({ payload, currentUserId });

  return COPY_BUILDERS[action]({
    actorName,
    payload,
    card,
    currentUserId,
    targetUserName,
    isTargetCurrentUser,
  });
}
