# Sprint 156 — Enforceable State Transitions: Edges, Toolbar & Real-Time Collaboration

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 155 (Graph Editor Foundation), Sprint 09 (Real-Time Infrastructure), Sprint 10 (Real-Time Collaboration)
> **Status:** ⬜ Future

---

## Goal

Complete the graph editor: draggable edge creation between nodes, arrow styling (straight/curved, two-way), a toolbar for adding columns, defining arrow style, and adding sticky notes, plus live collaborative editing so two users opening the editor simultaneously see each other's changes in real time.

---

## Strict Boundary

1. New column creation (via the toolbar) also creates a real Kanban list — not a purely cosmetic node.
2. Sticky notes are canvas-only — they are stored in `graph_data.notes` but have no Kanban counterpart.
3. Real-time sync uses the existing WebSocket infrastructure (Sprint 09/10) and the `state_transition_updated` event defined in Sprint 153.
4. No new WebSocket channels or rooms — piggybacked on the existing board room.

---

## Scope

### 1. Edge Creation — Drag from Node Handle

Activate the ReactFlow `onConnect` callback (previously rendered-only handles from Sprint 155).

**UX flow:**
1. User hovers a node border — handles glow / become interactive (cursor: `crosshair`).
2. User drags from any handle on Node A to any handle on Node B.
3. An edge is created with the **currently selected action** from the toolbar (defaults to `allowed_move_to`).
4. The edge is immediately rendered and a debounced PUT is fired to persist.

**Edge validation:**
- Self-connections (A → A) are rejected with a brief shake animation.
- Duplicate edges in the same direction are rejected silently (no duplicate arrows).

---

### 2. Custom Edge Component (`TransitionEdge.tsx`)

```
src/extensions/StateTransitions/components/GraphEditor/
  TransitionEdge.tsx        # custom ReactFlow edge
  EdgeActionLabel.tsx       # floating pill label on edge midpoint
  EdgeDeleteButton.tsx      # ✕ button shown on edge hover
```

**Edge rendering:**
- **Straight** style: ReactFlow `StraightEdge` base with `markerEnd` arrow.
- **Curved** style: ReactFlow `BezierEdge` base with `markerEnd` arrow.
- A floating pill label in the middle of the edge showing the action name (e.g. "Allowed move to").
- On hover: label turns slightly opaque, shows `EdgeDeleteButton` (✕) and a style toggle icon.
- **Two-way** direction: `markerStart` + `markerEnd` both present (arrow on both ends).

**Edge colours:**
- `allowed_move_to`: `stroke: #22c55e` (green-500 Tailwind). Extensible — future action types can have their own colour defined in `config/actionTypes.ts`.

---

### 3. Edge Context Menu / Inspector Panel

Right-clicking an edge (or single-clicking its label) opens a small inline inspector:

```
┌──────────────────────────────┐
│  Action:   [Allowed move to ▾] │   (dropdown — only one option for now)
│  Direction: [→ One-way] [↔ Two-way]   │
│  Style:     [─ Straight] [~ Curved]  │
│                              │
│  [Delete edge]               │
└──────────────────────────────┘
```

Changes are applied immediately and debounced-PUT to server.

---

### 4. Toolbar (`GraphEditorToolbar.tsx`)

Rendered as a floating horizontal bar at the **top-left of the canvas** (above the ReactFlow controls):

```
[ + Add Column ]  [ → Arrow: Allowed move to ▾ ]  [ 📌 Add Note ]
```

| Button | Icon | Behaviour |
|--------|------|-----------|
| **Add Column** | `PlusCircleIcon` | Opens `AddColumnModal` — type a name → creates a new Kanban list (calls `POST /api/v1/boards/:id/lists`) AND adds a node to the graph |
| **Arrow style** | `ArrowLongRightIcon` | Dropdown showing current action type (currently only "Allowed move to") — selection persists as the default action for the next edge drawn |
| **Add Note** | `ChatBubbleBottomCenterTextIcon` | Drops a sticky note node in the centre of the current viewport |

---

### 5. Add Column Modal (`AddColumnModal.tsx`)

```
┌─────────────────────────────┐
│  Add new column             │
│  ┌───────────────────────┐  │
│  │ Column name...        │  │
│  └───────────────────────┘  │
│          [Cancel]  [Create] │
└─────────────────────────────┘
```

On **Create**:
1. Calls `POST /api/v1/boards/:id/lists` → gets back the new list with its `id`.
2. Adds a new node to the ReactFlow graph with `positionX = viewport.centre.x`, `positionY = viewport.centre.y`.
3. Debounced PUT to persist updated graph.
4. Kanban board updates via existing WS real-time sync.

---

### 6. Sticky Note Node (`StickyNoteNode.tsx`)

```
┌─────────────────────────────┐  ← yellow, bg-yellow-100 dark:bg-yellow-900
│  ✏  Click to edit note...  │
│                             │
│                    [✕]      │
└─────────────────────────────┘
```

- Double-click enters inline edit mode (`<textarea>` auto-resize).
- On blur: saves content to `graph_data.notes[].content` and debounced PUT.
- Draggable — position persisted on drag end.
- Connects to no handles — purely informational.

---

### 7. Real-Time Collaborative Editing

**Emit on every local change:**

When the local user mutates the graph (node drag, edge create/delete, note add/edit, toggle enable), the PUT to `state-transitions` triggers a `state_transition_updated` WS broadcast (server already does this from Sprint 153).

**Receive remote changes:**

In `useStateTransitionsSync.ts`, subscribe to `state_transition_updated` events on the board WS channel:

```ts
onWsEvent('state_transition_updated', (event) => {
  if (event.actor_id === currentUserId) return; // ignore own echoes
  applyRemoteGraph(event.payload.graph);         // merge into ReactFlow state
  setEnabled(event.payload.enabled);
});
```

**`applyRemoteGraph` merge strategy:**
- Replace `edges` and `notes` entirely from the remote payload (last-write-wins).
- For `nodes`: merge by `id` — update `label`, `positionX`, `positionY` from remote; preserve any local unsaved node additions for 500ms before forcing remote state (optimistic grace period).

**Presence indicator:**
- A small `[N users editing]` badge in the top-right of the header when 2+ users have the editor open.
- Uses the existing presence infrastructure from Sprint 13 (if available) — no new presence channel.

---

### 8. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Delete` / `Backspace` | Delete selected node(s) or edge(s) |
| `Cmd/Ctrl + Z` | Undo last local graph action (client-side undo stack, max 20 steps) |
| `Cmd/Ctrl + A` | Select all nodes |
| `Escape` | Deselect all; or close inspector panel |

Undo stack is **client-local only** — no server-side undo. The undo stack is cleared when a remote `state_transition_updated` event arrives.

---

### 9. Node Deletion from Canvas

When a user deletes a node from the canvas (keyboard Delete or right-click → Remove):
1. Remove the node and all its edges from the ReactFlow state.
2. **Also delete the corresponding Kanban list** via `DELETE /api/v1/boards/:id/lists/:listId` — with a confirmation modal:
   > "Removing this column from the diagram will also delete the **In Progress** column and all its cards from the board. This cannot be undone."
3. Cancel button aborts the deletion entirely.

---

### 10. Action Types Registry (Extensibility Stub)

`src/extensions/StateTransitions/config/actionTypes.ts`:

```ts
export const ACTION_TYPES = [
  {
    id: 'allowed_move_to',
    label: 'Allowed move to',
    colour: '#22c55e',  // Tailwind green-500
    // Future: add icon, description, validation rules here
  },
  // TODO: Add more action types here as the feature evolves
  // Examples: 'requires_approval', 'auto_assign', 'notify_on_enter'
] as const;

export type ActionTypeId = typeof ACTION_TYPES[number]['id'];
```

---

## Deliverables

1. `TransitionEdge.tsx` + `EdgeActionLabel.tsx` + `EdgeDeleteButton.tsx`
2. `GraphEditorToolbar.tsx`
3. `AddColumnModal.tsx`
4. `StickyNoteNode.tsx`
5. Edge inspector inline panel
6. `useStateTransitionsSync.ts` updated with real-time receive + merge logic
7. Keyboard shortcut handler
8. `config/actionTypes.ts` extensibility stub
9. Node deletion flow with Kanban list deletion confirmation

---

## Heroicons Used

| Component | Icon |
|-----------|------|
| Toolbar: Add Column | `PlusCircleIcon` (outline, 20px) |
| Toolbar: Arrow type | `ArrowLongRightIcon` (outline, 20px) |
| Toolbar: Add Note | `ChatBubbleBottomCenterTextIcon` (outline, 20px) |
| Sticky note header | `PencilIcon` (14px) |
| Edge delete | `XMarkIcon` (12px) |
| Node delete confirmation | `ExclamationTriangleIcon` (solid, amber) |

---

## Acceptance Criteria

1. Dragging from a node handle to another creates an arrow with the current action type and default style.
2. Self-connections are rejected with visual feedback.
3. Duplicate directional edges are rejected silently.
4. Edge inspector allows changing action type, direction (one-way/two-way), and style (straight/curved).
5. Changing direction to two-way renders arrow markers on both ends.
6. "Add Column" modal creates a real Kanban list and adds it as a node on the canvas.
7. Sticky notes can be added, edited inline, dragged, and deleted.
8. Two browser tabs with the same board graph editor open simultaneously both update when one user makes a change (real-time sync ≤ 1 s).
9. Undo (`Cmd+Z`) reverts the last local action; undo stack resets on remote event.
10. Deleting a node that is a Kanban list triggers a confirmation; confirming deletes the list and all its cards.
11. `config/actionTypes.ts` is the single source of action type definitions; no hardcoded strings elsewhere.
