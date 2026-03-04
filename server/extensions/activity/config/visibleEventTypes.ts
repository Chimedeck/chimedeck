// Allowlist of activity action types that are visible in the activity feed.
// Only rows with action in this list (or null) will be returned by the API.
// Add new event types here to make them appear in the feed.
export const VISIBLE_EVENT_TYPES: string[] = [
  'comment_added',
  'comment_edited',
  'comment_deleted',
  // System events (sprint 29+)
  'card.member.added',
  'card.member.removed',
  'card.due_date.set',
  'card.due_date.cleared',
  'card.money.updated',
];
