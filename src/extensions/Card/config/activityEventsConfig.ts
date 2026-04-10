// Client-side allowlist of system event types shown in the activity feed.
// Must stay in sync with server/extensions/activity/config/visibleEventTypes.ts.
// Comment events (comment_added etc.) are handled by the comment system, not listed here.
export const VISIBLE_ACTIVITY_EVENT_TYPES: string[] = [
  // Sprint 88 — card lifecycle events
  'card_created',
  'card_moved',
  'card_member_assigned',
  'card_member_unassigned',
  // Legacy event types
  'card.member.added',
  'card.member.removed',
  'card.due_date.set',
  'card.due_date.cleared',
  'card.description.updated',
  'card.money.updated',
  'attachment_added',
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
