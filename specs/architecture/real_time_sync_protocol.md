# Real-Time Sync Protocol — Kanban App

## Transport
- WebSocket (wss://)

---

## Message Types
- card_created
- card_updated
- card_moved
- list_reordered
- member_joined
- presence_update

---

## Message Structure
```
{
  type: string,
  entity_id: string,
  payload: object,
  actor_id: string,
  timestamp: string
}
```

---

## Client Behavior
- Subscribe to board/list/card events
- Apply events in deterministic order
- Optimistic UI updates, rollback on error
- Presence indicators for active users

---

## Conflict Resolution
- Last-write-wins for card moves
- Server broadcasts resolved order
- No silent overwrites

---

## Edge Cases
- Network disconnect: queue changes, sync on reconnect
- Concurrent edits: server resolves, clients update
