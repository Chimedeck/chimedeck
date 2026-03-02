# Sprint 10 — Real-Time Collaboration (Client Sync)

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **References:** [requirements §§5.6, 6, 9, 10, 11](../architecture/requirements.md), [real_time_sync_protocol.md](../architecture/real_time_sync_protocol.md), [technical-decisions.md §10](../architecture/technical-decisions.md)

---

## Goal

Wire the frontend to the WebSocket infrastructure from sprint 09. Deliver optimistic UI with deterministic rollback, a reconnection queue, and conflict-safe state reconciliation — satisfying the real-time collaboration guarantees from [requirements §§2, 5.6](../architecture/requirements.md).

---

## Scope

### 1. WebSocket Client

```
src/extensions/Realtime/
  client/
    socket.ts           # singleton WebSocket wrapper (reconnect backoff)
    messageQueue.ts     # offline mutation queue
  hooks/
    useWebSocket.ts     # React hook: connect on board mount, disconnect on unmount
    useBoardSync.ts     # subscribe to board events, dispatch Redux actions
  middleware/
    wsMiddleware.ts     # Redux middleware: intercept optimistic actions → HTTP → reconcile
```

**Connection lifecycle:**
1. Board page mounts → `socket.connect(boardId, accessToken)`
2. Server authenticates token in WS handshake (sprint 09)
3. Client sends `{ type: "subscribe", board_id }`
4. Incoming events dispatched to Redux store via `wsMiddleware`

### 2. Optimistic Update Pattern

Per [requirements §§2.6, 5.6, 10, 11](../architecture/requirements.md) + [technical-decisions.md §10](../architecture/technical-decisions.md):

```
User action
  │
  ▼
Dispatch optimistic action → Redux store (UI updates immediately)
  │
  ▼
HTTP PATCH/POST/DELETE sent
  ├─ 2xx → dispatch CONFIRM action (reconcile server response)
  └─ 4xx/5xx → dispatch ROLLBACK action → restore previous state + error toast
```

Every entity slice (`listSlice`, `cardSlice`) must implement:
- `applyOptimistic(draft, action)` — mutate in place
- `confirmOptimistic(draft, action, serverResponse)` — align with server IDs/positions
- `rollbackOptimistic(draft, action, snapshot)` — restore pre-action snapshot

### 3. Incoming Event Reconciliation

When a WS event arrives for a mutation initiated by **another user**:
- Apply event patch to Redux store directly (no optimistic needed)
- If client has a pending optimistic for the same entity: defer incoming event until pending resolves

When a WS event arrives confirming **own** mutation:
- If already confirmed via HTTP response: no-op (deduplication by `sequence`)
- If HTTP not yet returned: mark as confirmed, skip forthcoming HTTP response reconciliation

Deduplication key: `(entityId, sequence)` stored in a `Set`.

### 4. Conflict Resolution — Client Side

Per [requirements §5.6](../architecture/requirements.md) + [real_time_sync_protocol.md](../architecture/real_time_sync_protocol.md):

- **Scalar fields (title, description):** Last-write-wins — incoming server event always wins; client's pending edit is preserved in the editor but marked `[conflicted]` with a diff prompt
- **Positions (list order, card order):** Server broadcasts `list_reordered` / `card_moved` with authoritative position array; client replaces local order entirely
- **No silent overwrites:** if a conflict replaces the user's current edit, show a non-blocking "Updated by `<name>`" toast

### 5. Offline / Reconnect Queue

Per [requirements §6 Reliability](../architecture/requirements.md) + [requirements §9](../architecture/requirements.md):

```
src/extensions/Realtime/client/messageQueue.ts
```

- Mutations attempted while disconnected are enqueued (in-memory)
- On reconnect: client fetches `GET /api/v1/boards/:id/events?since=<lastSequence>` to re-sync state
- Queued mutations are replayed in order
- If any queued mutation returns 409/422 after replay: discard + notify user

Max queue size: 100 operations. Exceed → clear queue + full board reload.

### 6. Presence UI

```
src/extensions/Realtime/
  components/
    PresenceAvatars.tsx    # show active users in board header
    UserCursor.tsx         # optional: highlight card being edited by another user
```

Data from `GET /api/v1/boards/:id/presence` on board load, updated via `presence_update` WS events.

### 7. Drag Conflict Edge Case

Per [requirements §9](../architecture/requirements.md) — disconnect mid-drag:

1. Drag starts → snapshot current positions
2. WS disconnect detected mid-drag → abort drag, restore snapshot (no mutation sent)
3. Reconnect → reload board state, user re-tries drag

---

## Tests

- Unit: `wsMiddleware` optimistic → confirm → rollback cycle
- Integration: two simulated concurrent clients — verify convergence to same state
- E2E (Playwright): card drag between lists, verify persisted after reconnect

---

## Acceptance Criteria

- [ ] Optimistic card move appears instantly; confirmed within 500 ms
- [ ] Failed mutation (e.g., server 403) reverts UI and shows error toast
- [ ] Concurrent edit by another user merges without silent data loss
- [ ] Disconnect mid-drag aborts drag and restores board state
- [ ] After reconnect, queued mutations replay and board converges
- [ ] Presence avatars update within 35 s of join/leave
- [ ] WS event deduplication: duplicate events produce no state change
