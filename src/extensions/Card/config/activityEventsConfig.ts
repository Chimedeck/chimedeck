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
  'card.due_date.changed',
  'card.due_date.cleared',
  'card.description.updated',
  'card.money.updated',
  'card.custom_field.updated',
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
  'checklist_item_assigned',
  'checklist_item_unassigned',
  'checklist_item_due_date_updated',
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
