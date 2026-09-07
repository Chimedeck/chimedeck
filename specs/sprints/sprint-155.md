# Sprint 155 — Enforceable State Transitions: Graph Editor UI Foundation

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 153 (State Transitions DB + Core API), Sprint 18 (Board View), Sprint 19 (Card Detail Modal)
> **Status:** ⬜ Future

---

## Goal

Deliver the entry point into the graph editor and the canvas foundation: a new section in Board Settings, a full-screen graph editor overlay, column nodes rendered on the canvas, and a working enable/disable toggle that persists server-side. No edges or real-time sync in this sprint — those come in Sprint 156.

---

## Strict Boundary

1. No edge creation or dragging in this sprint.
2. No real-time collaborative sync in this sprint — that is Sprint 156.
3. No Kanban enforcement UI — that is Sprint 157.
4. Uses **ReactFlow** (`@xyflow/react`) for the canvas — do not build a custom canvas.
5. Graph editor only opens from Board Settings; not accessible from the board header.

---

## Scope

### 1. Install Dependency

```bash
bun add @xyflow/react
```

ReactFlow v12+ (`@xyflow/react`) provides nodes, edges, minimap, controls, and background grid out of the box.

---

### 2. Board Settings Entry Point

**Location:** `src/extensions/StateTransitions/` feature folder.

In the existing Board Settings panel (wherever board settings sections are rendered), add a new section at the bottom:

```
[ShareIcon]  Enforceable State Transitions
             Manage allowed column transitions for this board
             [Open Editor →]
```

**Icon:** `ArrowsRightLeftIcon` from `@heroicons/react/24/outline` (represents bidirectional transitions between states).

Clicking **Open Editor** mounts the full-screen graph editor overlay.

---

### 3. Feature Flag Guard

The entire UI section (Board Settings entry + graph editor) is hidden when `STATE_TRANSITIONS_ENABLED` is `false` (read from `src/config/featureFlags.ts` client-side equivalent).

---

### 4. Full-Screen Graph Editor Overlay

```
src/extensions/StateTransitions/
  components/
    StateTransitionsSettingsEntry.tsx     # Board Settings section + Open Editor button
    GraphEditor/
      index.tsx                           # full-screen overlay root
      GraphEditorHeader.tsx               # title, enable/disable toggle, Close button
      GraphCanvas.tsx                     # ReactFlow canvas with nodes
      ColumnNode.tsx                      # custom node: column block
      StickyNoteNode.tsx                  # custom node: sticky note (placeholder)
      useGraphEditor.ts                   # local state: nodes, edges, dirty flag
      useStateTransitionsSync.ts          # API GET/PUT wiring
  api.ts                                  # RTK Query slice for state-transitions endpoints
  translations/
    en.json
  routes.ts                               # no new routes — opens as overlay
  README.md
```

**Overlay behaviour:**
- Rendered as a `fixed inset-0 z-50` overlay with dark semi-transparent backdrop.
- Keyboard: `Escape` closes the editor (with unsaved-changes confirmation if dirty).
- Not a route — state is managed in React component tree, opened via Redux slice or local context from Board Settings.

---

### 5. Graph Editor Header (`GraphEditorHeader.tsx`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ArrowsRightLeftIcon]  Enforceable State Transitions — My Board Name       │
│                                                          [Enforce: OFF ○──] │
│                                                          [✕ Close]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Enable / Disable toggle:**
- A labelled toggle switch (Tailwind styled): **"Enforce transitions"**
- State is loaded from `GET .../state-transitions` on editor open.
- On toggle: optimistic UI update + debounced `PUT .../state-transitions { enabled }` to server.
- Shows a small loading spinner while the PATCH is in flight.
- When `enabled = true`, header shows a green `CheckBadgeIcon` indicator: _"Transitions are enforced for all board members"_.
- When `enabled = false`, shows a grey `InformationCircleIcon`: _"Diagram is saved but not enforced"_.

---

### 6. Column Node (`ColumnNode.tsx`)

Each node represents one Kanban list/column.

```
┌────────────────────────────────┐
│  ◉ ◎ ◎ ◎  (connection handles)│
│                                │
│    📋  In Progress             │
│        [list name]             │
│                                │
│  ◉ ◎ ◎ ◎  (connection handles)│
└────────────────────────────────┘
```

**Handles (Sprint 156 will wire these up for edge creation):**
- 4 handles per node: `top`, `right`, `bottom`, `left` (ReactFlow `Position`).
- Rendered as small circles on node borders — visible but not yet interactive in this sprint.
- `source` + `target` type on each handle (ReactFlow supports both per-handle).

**Node appearance:**
- Background: `bg-white dark:bg-neutral-800`
- Border: `border border-neutral-300 dark:border-neutral-600 rounded-lg`
- Minimum size: `200px × 80px`
- Column name in bold, truncated with ellipsis at 180px.
- A small `Squares2X2Icon` (Heroicons, 14px) to the left of the name.
- Draggable via ReactFlow's built-in node drag — position auto-saved to `graph_data.nodes[].positionX/Y` on drag end (debounced PUT).

---

### 7. Initial Layout — Auto-Arrangement

When the board has no saved `graph_data` yet (or nodes list is empty), auto-arrange the board's lists as nodes in a horizontal row:

```
positionX = index * 280 + 40
positionY = 200
```

Columns are sorted by their existing list position (fractional index order).

---

### 8. Canvas Controls

Use ReactFlow's built-in panels:
- **MiniMap** — bottom-right, shows all nodes.
- **Controls** — bottom-left: zoom in, zoom out, fit view, lock.
- **Background** — `BackgroundVariant.Dots` (subtle dot grid).

---

### 9. RTK Query Slice (`api.ts`)

```ts
getStateTransitions(boardId)    // GET /api/v1/boards/:boardId/state-transitions
putStateTransitions(boardId, payload) // PUT — full graph + enabled
```

---

### 10. Heroicons Used

| Component | Icon |
|-----------|------|
| Board Settings entry | `ArrowsRightLeftIcon` (outline, 20px) |
| Graph editor header | `ArrowsRightLeftIcon` (outline, 24px) |
| Close button | `XMarkIcon` |
| Column node | `Squares2X2Icon` (14px) |
| Enabled indicator | `CheckBadgeIcon` (green, 16px) |
| Disabled indicator | `InformationCircleIcon` (grey, 16px) |
| Toggle loading | `ArrowPathIcon` (spinning, 14px) |

---

### 11. Unsaved Changes Guard

`useGraphEditor.ts` tracks a `isDirty` flag. On `Escape` or Close button click:
- If `isDirty === true`: show `ConfirmDiscardModal` — "You have unsaved changes. Discard and close?"
- If `isDirty === false`: close immediately.

Positions are auto-saved on drag end (debounced); the dirty flag is set only for edge/note additions that haven't synced yet — in this sprint, this guard primarily protects against accidental close while a save is in flight.

---

## Deliverables

1. `bun add @xyflow/react` added to `package.json`
2. `src/extensions/StateTransitions/` feature folder (all files above)
3. Board Settings section wired to open graph editor overlay
4. Graph editor overlay with header, enable/disable toggle, and canvas
5. Column nodes rendered from board's lists, draggable, positions persisted
6. RTK Query slice for GET/PUT state transitions

---

## Acceptance Criteria

1. Board Settings shows the "Enforceable State Transitions" section with `ArrowsRightLeftIcon`.
2. Clicking Open Editor opens the full-screen overlay.
3. On open, nodes appear for every list on the board, auto-arranged if no prior positions saved.
4. Dragging a node and releasing persists its new position (visible on re-open).
5. Toggle switches `enabled` on/off; change is immediately reflected in header indicator and persists server-side.
6. `Escape` / Close button closes the editor; confirmation shown if save is in flight.
7. Section hidden when `STATE_TRANSITIONS_ENABLED` is `false`.
8. Dark mode styles render correctly on all editor components.
