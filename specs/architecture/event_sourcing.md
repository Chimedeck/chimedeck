# Event Sourcing — Trello Kanban App

## Principles
- All state changes are events
- Events are immutable, append-only
- Projections (board, list, card) rebuilt from event stream

---

## Event Types
- workspace_created
- board_created
- board_renamed
- board_archived
- board_deleted
- list_created
- list_renamed
- list_reordered
- list_archived
- card_created
- card_moved
- card_edited
- card_archived
- card_duplicated
- comment_added
- comment_edited
- comment_deleted
- attachment_added
- attachment_removed
- member_invited
- member_joined
- member_removed

---

## Event Structure
```
Event {
  id: UUID
  type: string
  entity_id: UUID
  actor_id: UUID
  payload: JSON
  timestamp: timestamp
}
```

---

## Projections
- Board state, list order, card order, activity feed
- Rebuilt by replaying events

---

## Benefits
- Auditability
- Deterministic concurrency
- Extensible for new features
