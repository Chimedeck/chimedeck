# Sprint 154 — Enforceable State Transitions: Card Move Enforcement Layer

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 153 (State Transitions DB + Core API), Sprint 07 (Card Core — move endpoint)
> **Status:** ⬜ Future

---

## Goal

Wire the state transition rules into the card move handler so that invalid moves are rejected server-side when enforcement is enabled. Also add the corresponding error response to the Trello-compat move endpoint and write all tests to validate enforcement logic.

---

## Strict Boundary

1. Only the card **move** operation is enforced — no other card mutations are in scope.
2. Kanban UI error popup is **not** in this sprint — that is Sprint 157.
3. No changes to the graph editor UI.
4. Enforcement is a no-op when `enabled = false` or when `STATE_TRANSITIONS_ENABLED = false`.

---

## Scope

### 1. Enforcement Guard Module

```
server/extensions/stateTransitions/
  enforcement/
    index.ts          # validateCardMove({ boardId, fromListId, toListId }) → Promise<void | never>
    rules.ts          # getRulesForBoard(boardId) — cached, invalidated on state_transition_updated WS event
```

**`validateCardMove` contract:**

```ts
/**
 * Throws StateTransitionForbiddenError if:
 *  - enforcement is enabled on the board AND
 *  - the fromList has at least one outgoing edge (i.e., transitions are defined for it) AND
 *  - toList is NOT in the allowed_next_states for fromList
 *
 * Silent no-op when:
 *  - enforcement is disabled
 *  - STATE_TRANSITIONS_ENABLED flag is false
 *  - no state transition row exists for the board
 *  - fromList has NO outgoing edges (treat as "fully blocked" — see rule below)
 */
export async function validateCardMove({
  boardId,
  fromListId,
  toListId,
}: {
  boardId: string;
  fromListId: string;
  toListId: string;
}): Promise<void>;
```

**Blocking rule:**

> If the `fromList` node has **no outgoing edges** in the graph, the card is **forbidden from moving anywhere** (the node is "locked"). This reflects the intent: columns without any defined transitions are fully closed when enforcement is on.

> If `fromListId === toListId` (same-column reorder), the move is always **allowed** regardless of rules.

---

### 2. Error Type

```ts
// server/extensions/stateTransitions/common/errors.ts
export class StateTransitionForbiddenError extends Error {
  constructor(
    public readonly fromListId: string,
    public readonly fromListName: string,
    public readonly toListId: string,
    public readonly toListName: string,
    public readonly allowedNextStates: string[],
  ) {
    super(`State transition from "${fromListName}" to "${toListName}" is forbidden`);
    this.name = 'StateTransitionForbiddenError';
  }
}
```

---

### 3. Card Move Handler Integration

File: wherever the existing `PATCH /api/v1/cards/:id` (or dedicated move endpoint) is handled.

```ts
// Inside card move handler, after auth + ownership checks, before DB write:
await validateCardMove({
  boardId: card.boardId,
  fromListId: card.listId,      // current list
  toListId: body.listId,        // requested destination
});
// Proceed with move...
```

**Error response when blocked:**

HTTP `422 Unprocessable Entity`:

```json
{
  "name": "state-transition-forbidden",
  "data": {
    "fromListId": "uuid",
    "fromListName": "In Progress",
    "toListId": "uuid",
    "toListName": "Done",
    "allowedNextStates": [
      { "id": "uuid", "name": "In Review" },
      { "id": "uuid", "name": "Blocked" }
    ]
  }
}
```

---

### 4. Trello-Compat Layer Integration

File: `server/extensions/trelloCompat/` — card move routes.

Map `StateTransitionForbiddenError` to Trello-style error:

```json
{
  "message": "State transition from \"In Progress\" to \"Done\" is not allowed.",
  "error": "STATE_TRANSITION_FORBIDDEN"
}
```

HTTP status: `422`.

---

### 5. In-Memory Rules Cache

To avoid a DB round-trip on every card move, cache the derived rules per board in memory:

```ts
// server/extensions/stateTransitions/enforcement/rules.ts
const cache = new Map<string, { rules: DerivedRules; ttl: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

// Invalidate immediately when WS event state_transition_updated arrives for a boardId
```

The cache is **invalidated eagerly** when the `state_transition_updated` WS event is emitted (same process) — no need for Redis-backed invalidation since the emitter and the enforcement module live in the same server process.

---

### 6. Activity Log Entry

When a card move is **blocked** by state transition enforcement, emit an activity entry:

```ts
{
  type: 'card_move_blocked',
  cardId,
  boardId,
  actorId,
  payload: {
    fromListId,
    fromListName,
    toListId,
    toListName,
  }
}
```

This appears in the card's activity feed as:
> **[User]** attempted to move this card from **In Progress** to **Done** — blocked by state transition rules.

---

## Deliverables

1. `server/extensions/stateTransitions/enforcement/index.ts` — `validateCardMove`
2. `server/extensions/stateTransitions/enforcement/rules.ts` — cache layer
3. `server/extensions/stateTransitions/common/errors.ts` — error class
4. Integration of `validateCardMove` into card move handler
5. Trello-compat error mapping
6. Activity log on blocked move

---

## Acceptance Criteria

1. Moving a card to an allowed list succeeds with `200`.
2. Moving a card to a forbidden list returns `422` with `name: 'state-transition-forbidden'` and full `data` payload.
3. Moving a card within the same list (position reorder) is always allowed.
4. Enforcement is a complete no-op when `enabled = false`.
5. Enforcement is a complete no-op when `STATE_TRANSITIONS_ENABLED = false`.
6. A `fromList` node with no outgoing edges blocks moves to **all** other lists.
7. Rules cache is invalidated when `validateCardMove` is called after a `PUT` to the graph.
8. Blocked move appears in card activity feed with correct copy.
9. Trello-compat card move returns Trello-style `422` body when blocked.
10. Unit tests for enforcement logic covering: allowed, forbidden, no-edges (blocked), same-list, disabled flag.
11. Integration tests: end-to-end POST move → 422 when rule violated.
