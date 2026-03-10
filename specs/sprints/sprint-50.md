# Sprint 50 — API & Event Envelope Fixes

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 03 (Authentication), Sprint 09 (Real-Time Infrastructure), Sprint 10 (Real-Time Collaboration)  
> **References:** [requirements §8 — API, Real-Time Events](../architecture/requirements.md)

---

## Goal

Three protocol-level mismatches between the requirements specification and the current implementation are corrected:

1. **Error envelope format** — REST API errors must use `{ "error": { "code": "...", "message": "..." } }` instead of the current `{ "name": "...", "data": { "message": "..." } }`
2. **`member_joined` event** — this required real-time event is never emitted; wire it to workspace and board membership creation
3. **Event version field** — the real-time event envelope is missing a `version` number field as required by §8

> ⚠️ **Breaking change:** The error envelope format change affects all API consumers. Update all client-side error handling in `src/` at the same time.

---

## Scope

### 1. Error Envelope — `server/common/response.ts` (or equivalent)

Current shape:
```json
{ "name": "current-user-is-not-admin", "data": { "message": "..." } }
```

Required shape:
```json
{ "error": { "code": "current-user-is-not-admin", "message": "Human-readable description" } }
```

Update the shared error-response helper so every `res.status(4xx|5xx).json(...)` call uses the new shape. The `code` field maps directly to the current `name` field (hyphenated string). The `message` field comes from `data.message`.

Do **not** change the success response shape (`{ data: ... }`, `{ data: ..., includes: ... }`, `{ data: ..., metadata: ... }`) — only error responses change.

---

### 2. Client-Side Error Handling

Search for all `error.name`, `err.name`, `.data?.message` patterns in `src/` that parse API error responses and update them to read `error.error?.code` and `error.error?.message` instead.

This affects:
- RTK Query `baseQuery` error handling
- Any inline `catch` blocks that inspect API error shape
- Error display components that render API error messages

---

### 3. `member_joined` Real-Time Event

#### When to emit

| Trigger | Event |
|---|---|
| User accepts workspace invite | `member_joined` with `scope: 'workspace'` |
| User is added to a board as a member | `member_joined` with `scope: 'board'` |

#### Event payload

```ts
interface MemberJoinedEvent {
  type: 'member_joined';
  version: number;        // monotonically incrementing per board/workspace
  entityId: string;       // workspace or board ID
  scope: 'workspace' | 'board';
  payload: {
    userId: string;
    displayName: string;
    role: string;
    joinedAt: string;     // ISO 8601
  };
}
```

Emit via the existing pub/sub channel used by other mutation events.

---

### 4. Event Envelope — Add `version` Field

All real-time events emitted by the server must include a `version` field per §8 of the requirements. Currently events carry a `sequence` field but not an explicit `version`.

Update the event emission helper in `server/mods/events/` (or wherever events are serialised before publishing):

```ts
interface BaseEvent {
  type: string;
  version: number;   // ADD THIS — monotonically incrementing integer per entity
  entityId: string;
  payload: unknown;
  sequence?: number; // keep for backward compatibility if already in use
}
```

The `version` integer is the value stored in the event store's `sequence_number` column (or equivalent). It tells clients the exact position in the entity's event stream, enabling correct conflict detection.

---

## Acceptance Criteria

- [ ] All `4xx`/`5xx` responses use `{ "error": { "code": "...", "message": "..." } }` shape
- [ ] `{ "name": ... }` never appears in any error response
- [ ] Client `baseQuery` parses the new error shape without `console.error`
- [ ] Accepting a workspace invite emits a `member_joined` event on the WS channel
- [ ] Adding a board member emits a `member_joined` event on the board WS channel
- [ ] All emitted real-time events include a `version` field (integer)
- [ ] Existing integration tests updated to match new error shape
