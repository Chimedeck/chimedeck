// Notification preference types — mirrors the server-side NOTIFICATION_TYPES and DB schema.
// Opt-out model: missing rows default to both channels enabled.

export const NOTIFICATION_TYPES = [
  'mention',
  'card_created',
  'card_moved',
  'card_commented',
  'comment_reaction',
  'card_member_assigned',
  'card_member_unassigned',
  'checklist_item_assigned',
  'checklist_item_unassigned',
  'checklist_item_due_date_updated',
  'card_updated',
  'card_deleted',
  'card_archived',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  mention: '@Mentions',
  card_created: 'Card created',
  card_moved: 'Card moved',
  card_commented: 'Card commented',
  comment_reaction: 'Comment reaction',
  card_member_assigned: 'Member assigned',
  card_member_unassigned: 'Member removed',
  checklist_item_assigned: 'Checklist item assigned',
  checklist_item_unassigned: 'Checklist item unassigned',
  checklist_item_due_date_updated: 'Checklist due date updated',
  card_updated: 'Card updated',
  card_deleted: 'Card deleted',
  card_archived: 'Card archived',
};

export interface NotificationPreference {
  type: NotificationType;
  in_app_enabled: boolean;
  email_enabled: boolean;
  updated_at: string | null;
}

export interface UpdatePreferencesBody {
  type: NotificationType;
  in_app_enabled?: boolean;
  email_enabled?: boolean;
}
