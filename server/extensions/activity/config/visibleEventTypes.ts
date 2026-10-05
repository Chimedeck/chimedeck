// Allowlist of activity action types that are visible in the activity feed.
// Only rows with action in this list (or null) will be returned by the API.
// Add new event types here to make them appear in the feed.
export const VISIBLE_EVENT_TYPES: string[] = [
  'comment_added',
  'comment_edited',
  'comment_deleted',
  'comment_reaction_added',
  'comment_reaction_removed',
  // Card lifecycle events (sprint 88+)
  'card_created',
  'card_moved',
  'card_move_blocked',
  'card_member_assigned',
  'card_member_unassigned',
  // System events (sprint 29+)
  'card.member.added',
  'card.member.removed',
  'card.due_date.set',
  'card.due_date.changed',
  'card.due_date.cleared',
  'card.description.updated',
  'card.money.updated',
  'card.custom_field.updated',
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
  'checklist_item_assigned',
  'checklist_item_unassigned',
  'checklist_item_due_date_updated',
  'board_github_project_url_updated',
  // Sprint 176 — sprint generation lifecycle events
  'sprint_generation_started',
  'sprint_generation_artifact_created',
  'sprint_generation_card_created',
  'sprint_generation_quota_exceeded',
  'sprint_generation_completed',
  'sprint_generation_failed',
  // Sprint 176 — as-built sync lifecycle events
  'as_built_sync_started',
  'as_built_sync_evidence_collected',
  'as_built_sync_docs_updated',
  'as_built_sync_committed',
  'as_built_sync_completed',
  'as_built_sync_failed',
];
