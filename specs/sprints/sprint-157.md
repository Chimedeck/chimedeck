# Sprint 157 — Enforceable State Transitions: Kanban Enforcement UI + Copy to Board

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 154 (Card Move Enforcement Layer), Sprint 155 (Graph Editor Foundation), Sprint 156 (Edges, Toolbar, Real-time), Sprint 18 (Board View — Kanban DnD)
> **Status:** ⬜ Future

---

## Goal

Surface the enforcement layer to users in the Kanban board: intercept invalid drag-and-drop card moves, show a clear error popup, and also add a "Copy to Board" flow in the graph editor so transitions can be reused across boards and workspaces.

---

## Strict Boundary

1. Only drag-and-drop card moves in the Kanban view are intercepted — programmatic moves via the CLI or MCP are already blocked server-side (Sprint 154).
2. Copy feature supports cross-board and cross-workspace targets, but the caller must be ADMIN/OWNER on the target board (enforced server-side, Sprint 153).
3. No new database migrations in this sprint.

---

## Scope

### 1. Kanban DnD Enforcement Hook

In the existing card drag-and-drop handler (wherever `onDragEnd` / `onDrop` is processed after a card is dropped into a new column):

**Before** committing the optimistic UI update + API call, call a client-side pre-validation using the cached rules:

```ts
// src/extensions/StateTransitions/hooks/useStateTransitionGuard.ts
export function useStateTransitionGuard(boardId: string) {
  // Fetches rules via GET .../state-transitions/rules (cached via RTK Query)
  // Returns: { canMove(fromListId, toListId): boolean, getRejectionReason(fromListId, toListId): RejectionReason }
}
```

**Flow:**
1. User drops card onto a new column.
2. `canMove(fromListId, toListId)` is called **before** the optimistic update.
3. If `false`: abort the drop, snap card back to original column, show `StateTransitionErrorPopup`.
4. If `true`: proceed with existing optimistic update + `PATCH /api/v1/cards/:id { listId }`.
5. If the server still returns `422 state-transition-forbidden` (race condition — rules changed mid-drag): roll back the optimistic update and show the error popup.

**Guard is inactive when:**
- `enabled = false` on the board.
- `STATE_TRANSITIONS_ENABLED` is `false`.
- Rules are not yet loaded (fails open — the server will catch it).

---

### 2. State Transition Error Popup (`StateTransitionErrorPopup.tsx`)

```
┌──────────────────────────────────────────────────────────────────┐
│  🚫  Move not allowed                                            │
│                                                                  │
│  Cards in "In Progress" cannot be moved to "Done" directly.      │
│                                                                  │
│  Allowed next steps:                                             │
│    ✅  In Review                                                  │
│    ✅  Blocked                                                    │
│                                                                  │
│  [View transition rules]                   [OK]                  │
└──────────────────────────────────────────────────────────────────┘
```

- Rendered as a centred modal (not a toast — the message requires the user to read it).
- **"View transition rules"** button opens the graph editor overlay directly (same as Board Settings entry).
- **"OK"** dismisses.
- Auto-dismisses after 8 seconds if the user takes no action.
- When `allowedNextStates` is empty (from-column fully locked): shows _"Cards in "In Progress" cannot be moved anywhere — this column has no allowed transitions."_

**Heroicons:**
- `NoSymbolIcon` (solid, red-500, 24px) — main icon.
- `CheckCircleIcon` (solid, green-500, 16px) — each allowed next state bullet.

---

### 3. Enforcement Visual Indicators on Kanban Board

When `enabled = true`, add subtle indicators so users know enforcement is active **before** attempting a move:

**Column header badge:**
- A small `LockClosedIcon` (12px, grey) next to each column name that is **fully locked** (no outgoing edges).
- Tooltip on hover: _"No outgoing transitions — cards cannot be moved from this column."_

**Column drag-over feedback:**
- When a user is mid-drag and hovering over a **forbidden** destination column, the column highlight turns red instead of the default blue/green, providing immediate visual cue before releasing.
- This requires patching the `onDragOver` handler to call `canMove` and apply a CSS class accordingly.

---

### 4. Copy to Board — Graph Editor Button

In the graph editor header (alongside the Close button and enable toggle), add a **Copy to Board** button:

```
┌───────────────────────────────────────────────────────────────────────┐
│  [ArrowsRightLeftIcon]  Enforceable State Transitions — Board Name     │
│                                  [Copy to Board ▾]  [Enforce: ON ●──] │
│                                                       [✕ Close]       │
└───────────────────────────────────────────────────────────────────────┘
```

**Icon:** `DocumentDuplicateIcon` (outline, 18px) + label "Copy to Board".

---

### 5. Copy to Board Modal (`CopyTransitionsModal.tsx`)

```
┌───────────────────────────────────────────────────────┐
│  Copy state transitions to another board              │
│                                                       │
│  Workspace:  [Current Workspace  ▾]                   │
│  Board:      [Select board...    ▾]                   │
│                                                       │
│  ⚠️  Only columns matching by name will be copied.    │
│     Unmatched columns will be excluded.               │
│                                                       │
│  Also copy "Enforce" setting:  [✓]                    │
│                                                       │
│              [Cancel]    [Copy transitions →]         │
└───────────────────────────────────────────────────────┘
```

**Behaviour:**
- Workspace picker defaults to the current workspace; can switch to any workspace the user is a member of.
- Board picker shows boards where the user is ADMIN or OWNER (call `GET /api/v1/workspaces/:id/boards` filtered client-side).
- The source board is excluded from the board picker (cannot copy to itself).
- **"Also copy Enforce setting"** checkbox (default: checked) — if unchecked, the target board's `enabled` flag is left unchanged.
- On confirm: calls `POST /api/v1/boards/:sourceBoardId/state-transitions/copy` with `{ targetBoardId, copyEnabled: boolean }`.
- On success: shows success toast _"Transitions copied to [Board Name]"_ with a link to open the target board's graph editor.
- On partial match (some nodes dropped): shows info toast _"Copied with X column(s) excluded (no matching names found in target board)"_.

---

### 6. Copy API Extension (Sprint 153 amendment)

Extend the `POST .../copy` endpoint from Sprint 153 to accept an additional `copyEnabled` boolean:

```json
{ "targetBoardId": "uuid", "copyEnabled": true }
```

When `copyEnabled = false`, the target board's `enabled` flag is not touched. Server response includes a `skippedNodes` count:

```json
{
  "data": { ...graph... },
  "metadata": { "skippedNodes": 2 }
}
```

---

### 7. Kanban Board: "Transitions Active" Banner

When `enabled = true` on the board, show a dismissible info banner at the top of the Kanban board (below the board header):

```
┌────────────────────────────────────────────────────────────────────────┐
│  [ArrowsRightLeftIcon]  State transitions are enforced on this board.  │
│  Some card moves may be restricted.   [View rules]          [✕ Dismiss]│
└────────────────────────────────────────────────────────────────────────┘
```

- **"View rules"** opens the graph editor overlay.
- **"✕ Dismiss"** hides the banner for the session (`sessionStorage` key `state-transitions-banner-dismissed-{boardId}`).
- Banner is not shown when `enabled = false`.
- Banner is not shown if the user has already dismissed it this session.

---

### 8. RTK Query Additions

```ts
// src/extensions/StateTransitions/api.ts (additions)
getStateTransitionRules(boardId) // GET .../rules — used by useStateTransitionGuard
copyStateTransitions(sourceBoardId, payload) // POST .../copy
```

---

## Deliverables

1. `src/extensions/StateTransitions/hooks/useStateTransitionGuard.ts`
2. `src/extensions/StateTransitions/components/StateTransitionErrorPopup.tsx`
3. Kanban DnD handler patched with pre-move guard + rollback
4. Column header lock icon + drag-over forbidden visual
5. `CopyTransitionsModal.tsx` with workspace + board picker
6. `DocumentDuplicateIcon` "Copy to Board" button in graph editor header
7. "Transitions Active" dismissible banner on Kanban board
8. RTK Query additions: `getStateTransitionRules`, `copyStateTransitions`
9. Sprint 153 `copy` endpoint extended with `copyEnabled` + `skippedNodes`

---

## Acceptance Criteria

1. Dragging a card to a forbidden column snaps it back and shows `StateTransitionErrorPopup` with correct allowed states.
2. Error popup "View transition rules" opens the graph editor overlay.
3. Mid-drag hover over a forbidden column turns the column highlight red.
4. Fully locked columns show a `LockClosedIcon` in their header while enforcement is active.
5. Server-side `422` during a move (race condition) also triggers the error popup and rolls back the optimistic update.
6. Copy to Board modal correctly filters boards to those where the user is ADMIN/OWNER.
7. Copy succeeds: target board graph editor shows the copied transitions.
8. Partial copy (name mismatches) shows the info toast with skipped count.
9. `copyEnabled = false` leaves target board's `enabled` flag unchanged.
10. "Transitions Active" banner shows when `enabled = true`, is dismissable per session.
11. All enforcement UI is hidden (no guard, no banner, no lock icons) when `enabled = false`.
12. All UI is hidden when `STATE_TRANSITIONS_ENABLED` flag is `false`.
