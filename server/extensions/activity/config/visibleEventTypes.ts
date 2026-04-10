// Allowlist of activity action types that are visible in the activity feed.
// Only rows with action in this list (or null) will be returned by the API.
// Add new event types here to make them appear in the feed.
export const VISIBLE_EVENT_TYPES: string[] = [
  'comment_added',
  'comment_edited',
  'comment_deleted',
  // Card lifecycle events (sprint 88+)
  'card_created',
  'card_moved',
  'card_member_assigned',
  'card_member_unassigned',
  // System events (sprint 29+)
  'card.member.added',
  'card.member.removed',
  'card.due_date.set',
  'card.due_date.cleared',
  'card.description.updated',
  'card.money.updated',
  'attachment_added',
  'card_link_attached',
  'attachment_removed',
  // Card archive / delete lifecycle
  'card_archived',
  'card_unarchived',
  'card_deleted',
  // Checklist events
  'checklist_created',
  'checklist_deleted',
  'checklist_item_checked',
  'checklist_item_unchecked',
];
