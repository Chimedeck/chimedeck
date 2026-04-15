// [why] single source of truth shared by DB constraint validation and API input guards.
// All WEBHOOK_EVENT_TYPES entries must be kept in sync with the sprint-135 spec event table.
export const WEBHOOK_EVENT_TYPES = [
  'card.created',
  'card.updated',
  'card.deleted',
  'card.archived',
  'card.description_edited',
  'card.attachment_added',
  'card.member_assigned',
  'card.member_removed',
  'card.commented',
  'card.moved',
  'mention',
  // [why] board.created is dispatched only to subscribers who already have access
  // to the new board — prevents leaking private board existence
  'board.created',
  // [why] board.member_added is dispatched only to the newly added member
  'board.member_added',
  // [why] aliases retained for parity with the notification system
  'card_created',
  'card_moved',
  'card_commented',
  'card_member_assigned',
  'card_member_unassigned',
  'card_updated',
  'card_deleted',
  'card_archived',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
