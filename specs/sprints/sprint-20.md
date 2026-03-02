# Sprint 20 — Real-Time UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 19 (Card Detail), Sprint 10 (Real-Time Collaboration API)  
> **References:** [requirements §§2, 5.6, 6, 9, 10, 11](../architecture/requirements.md), [real_time_sync_protocol.md](../architecture/real_time_sync_protocol.md)

---

## Goal

Wire the frontend to the WebSocket infrastructure. Deliver live list/card updates from other collaborators, optimistic mutations with rollback, a reconnection indicator, and conflict toasts — making the board feel truly live.

---

## Scope

### 1. WebSocket Client

```
src/extensions/Realtime/
  client/
    socket.ts               # singleton WebSocket: connect/disconnect/reconnect backoff
    messageQueue.ts         # queues mutations while offline, drains on reconnect
  hooks/
    useWebSocket.ts         # connects on board mount, disconnects on unmount
    useBoardSync.ts         # dispatches Redux actions from incoming WS events
  middleware/
    wsMiddleware.ts         # Redux middleware: optimistic → HTTP → confirm/rollback
```

Connection lifecycle:
1. `BoardPage` mounts → `socket.connect(boardId, accessToken)`
2. Server acknowledges → client sends `{ type: "subscribe", boardId }`
3. Incoming events flow to `useBoardSync` → dispatched to Redux
4. `BoardPage` unmounts → `socket.disconnect()`

### 2. Reconnection Indicator

```
src/common/
  components/
    ConnectionBadge.tsx     # pill shown in board header
```

States and appearance:

| State | Classes | Label |
|-------|---------|-------|
| Connected | `bg-emerald-500/20 text-emerald-400 border-emerald-500/30` | Live |
| Reconnecting | `bg-yellow-500/20 text-yellow-400 border-yellow-500/30` + spin icon | Reconnecting… |
| Offline | `bg-red-500/20 text-red-400 border-red-500/30` | Offline |

Badge placement: `BoardHeader` right side, before member avatars.

### 3. Optimistic Update Flow

Every mutation (card move, title edit, etc.) follows:

```
User action
  ↓
Dispatch optimistic action → Redux (UI updates immediately, no flicker)
  ↓
HTTP request sent
  ├─ 2xx → dispatch CONFIRM → align card ID / position with server response
  └─ 4xx/5xx → dispatch ROLLBACK → restore snapshot → show error toast
```

All entity slices (`listSlice`, `cardSlice`) implement:
- `applyOptimistic(draft, action)`
- `confirmOptimistic(draft, serverResponse)`
- `rollbackOptimistic(draft, snapshot)`

### 4. Incoming Event Handling

Events received via WebSocket:

| Event type | UI action |
|------------|-----------|
| `card_created` | Insert card into correct list in Redux |
| `card_updated` | Merge changes into card in Redux |
| `card_moved` | Move card to new list with authoritative position |
| `card_archived` | Remove card from board view |
| `list_created` | Append list column to board |
| `list_updated` | Update list title |
| `list_reordered` | Replace `listOrder` array with server-authoritative order |
| `member_joined` | Add member to board header avatar stack |

Deduplication: each event carries `sequence`; client tracks last-seen `sequence` per board in a `Set` to skip replays.

### 5. Conflict Toast

When a WS event from another user overwrites content the local user is actively editing:

```
src/common/
  components/
    Toast.tsx               # Radix Toast primitive
    ToastRegion.tsx         # fixed bottom-right toast container
```

Conflict notification:
- `bg-slate-800 border border-slate-700 rounded-xl shadow-2xl px-4 py-3`
- Icon: `text-yellow-400` warning icon  
- Text: `"<Name> updated this card"` with a subtle `text-slate-400` timestamp
- Auto-dismiss after 4 s; manual dismiss via ✕

Error toast (rollback):
- Border `border-red-500/40`, icon `text-red-400`
- Text: human-readable error from API `name` field
- Auto-dismiss after 6 s

### 6. Presence Indicators

Small coloured dot overlaid on member avatars in `BoardHeader`:

```
src/extensions/Presence/
  hooks/
    usePresence.ts          # polls GET /api/v1/boards/:boardId/presence every 30 s
  components/
    PresenceDot.tsx         # absolute-positioned w-2 h-2 rounded-full (green/grey)
```

Avatar with dot: `relative` wrapper, dot `absolute bottom-0 right-0 ring-2 ring-slate-900`.

### 7. Acceptance Criteria

- [ ] Opening a board connects to WebSocket (visible in browser DevTools Network)
- [ ] A card created by another session appears on the board within 1 second
- [ ] A card moved by another session animates to its new column
- [ ] The connection badge shows "Live" when connected, "Reconnecting…" during drop
- [ ] Moving a card optimistically shows the new position immediately; on API error it snaps back with a toast
- [ ] Toasts appear bottom-right and auto-dismiss after their timeout
- [ ] Navigating away from the board closes the WebSocket connection

### 8. Tests

```
specs/tests/
  realtime-card-update.md   # Playwright: two tabs open same board, move card in tab 1, verify tab 2 updates
  realtime-reconnect.md     # Playwright: disconnect network, reconnect, verify badge and state recovery
  optimistic-rollback.md    # Playwright: intercept API, force 500, verify card snaps back + error toast
```

---
