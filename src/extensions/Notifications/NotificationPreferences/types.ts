// Notification preference types — mirrors the server-side NOTIFICATION_TYPES and DB schema.
// Opt-out model: missing rows default to both channels enabled.

export const NOTIFICATION_TYPES = [
  'mention',
  'card_created',
  'card_moved',
  'card_commented',
  'card_member_assigned',
  'card_member_unassigned',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  mention: '@Mentions',
  card_created: 'Card created',
  card_moved: 'Card moved',
  card_commented: 'Card commented',
  card_member_assigned: 'Member assigned',
  card_member_unassigned: 'Member removed',
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
