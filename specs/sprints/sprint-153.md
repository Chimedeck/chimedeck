# Sprint 153 — Enforceable State Transitions: DB Schema + Core API

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 06 (List Management), Sprint 07 (Card Core), Sprint 05 (Board Lifecycle)
> **Status:** ⬜ Future

---

## Goal

Lay the server-side foundation for board-level enforceable state transitions: database schema, CRUD API for the transition graph, rules normalization endpoint for agents and MCP servers, and the copy-to-board endpoint. This sprint has **no UI** — all deliverables are testable via the REST API.

---

## Strict Boundary

1. State transitions are **board-scoped only** — no workspace-level or organisation-level settings.
2. Enforcement logic (blocking card moves) is **not** in this sprint — that is Sprint 154.
3. Graph editor UI is **not** in this sprint — that is Sprint 155–156.
4. Feature gated behind `STATE_TRANSITIONS_ENABLED` flag.

---

## Scope

### 1. Database Migration

File: `db/migrations/NNNN_state_transitions.ts`

```sql
-- One row per board; created lazily on first GET/PUT
CREATE TABLE board_state_transitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL UNIQUE REFERENCES boards(id) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  graph_data  JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[],"notes":[]}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bst_board_id ON board_state_transitions(board_id);
```

**`graph_data` shape (TypeScript reference):**

```ts
interface StateTransitionGraph {
  nodes: StateTransitionNode[];
  edges: StateTransitionEdge[];
  notes: StateTransitionNote[];
}

interface StateTransitionNode {
  id: string;           // == list_id from board's lists
  listId: string;
  label: string;        // column name (kept in sync with list name)
  positionX: number;
  positionY: number;
}

interface StateTransitionEdge {
  id: string;           // uuid
  fromNodeId: string;   // source node id (list_id)
  toNodeId: string;     // target node id (list_id)
  action: 'allowed_move_to';  // extensible — only value for now
  direction: 'one_way' | 'two_way';
  style: 'straight' | 'curved';
  label?: string;       // optional display override; defaults to action display name
}

interface StateTransitionNote {
  id: string;
  content: string;
  positionX: number;
  positionY: number;
}
```

---

### 2. Server Module

```
server/extensions/stateTransitions/
  api/
    index.ts          # mounts routes under /api/v1/boards/:boardId/state-transitions
    get.ts            # GET — returns graph + enabled status
    put.ts            # PUT — replaces full graph_data + enabled flag
    getRules.ts       # GET /rules — returns normalised rules JSON for agents
    copy.ts           # POST /copy — copies graph to target board
  common/
    serializer.ts     # toGraphResponse(), toRulesResponse()
    validator.ts      # validates graph_data shape before save
    sync.ts           # stripDeletedNodes(graphData, activeLists[]) — removes stale nodes/edges
```

---

### 3. API Endpoints

#### `GET /api/v1/boards/:boardId/state-transitions`

Returns full graph + metadata.

**Auth:** Board member (any role).

**Response `200`:**
```json
{
  "data": {
    "boardId": "uuid",
    "enabled": false,
    "graph": {
      "nodes": [ { "id": "list-uuid", "listId": "list-uuid", "label": "In Progress", "positionX": 120, "positionY": 80 } ],
      "edges": [ { "id": "edge-uuid", "fromNodeId": "list-a", "toNodeId": "list-b", "action": "allowed_move_to", "direction": "one_way", "style": "curved" } ],
      "notes": []
    },
    "updatedAt": "2026-05-19T10:00:00Z"
  }
}
```

If no row exists yet, returns a default graph auto-populated with the board's current lists as nodes (positions auto-arranged in a single row) and `enabled: false`.

---

#### `PUT /api/v1/boards/:boardId/state-transitions`

Replaces the entire graph and/or the enabled flag.

**Auth:** Board ADMIN or OWNER.

**Request body:**
```json
{
  "enabled": true,
  "graph": { "nodes": [...], "edges": [...], "notes": [...] }
}
```

Both fields are optional in a single request; omitted fields are left unchanged.

**Response `200`:** same shape as GET.

**Validation errors `422`:**
- `{ "name": "state-transition-graph-invalid", "data": { "message": "..." } }` — malformed graph_data
- `{ "name": "state-transition-node-unknown-list", "data": { "nodeId": "..." } }` — node references a list that does not exist on the board

---

#### `GET /api/v1/boards/:boardId/state-transitions/rules`

Returns a machine-readable rules document for use by agents (Hermes, MCP server, CLI).

**Auth:** Board member (any role) OR valid API token with board access.

**Response `200`:**
```json
{
  "data": {
    "boardId": "uuid",
    "enabled": true,
    "rules": [
      {
        "current_state": "In Progress",
        "current_state_id": "list-uuid-a",
        "allowed_next_states": ["In Review", "Blocked"],
        "allowed_next_state_ids": ["list-uuid-b", "list-uuid-c"],
        "forbidden_next_states": ["Done", "Backlog"],
        "forbidden_next_state_ids": ["list-uuid-d", "list-uuid-e"]
      }
    ]
  }
}
```

**Derivation logic:**

For each node that has at least one outgoing edge:
- `allowed_next_states` = all nodes reachable via `allowed_move_to` edges (both `one_way` from this node, and `two_way` edges involving this node).
- `forbidden_next_states` = all other nodes on the board that are NOT in `allowed_next_states`.

For nodes with **no outgoing edges at all**, they are omitted from the rules array — the enforcement layer treats them as completely blocked (no allowed moves).

---

#### `POST /api/v1/boards/:boardId/state-transitions/copy`

Copies the source board's `graph_data` and `enabled` status to a target board.

**Auth:** Caller must be ADMIN or OWNER on **both** the source board and the target board.

**Request body:**
```json
{ "targetBoardId": "uuid" }
```

**Behaviour:**
1. Load source graph.
2. For each node in source graph: attempt to find a matching list in the target board by **name** (case-insensitive). If found, substitute the `id` and `listId`. If not found, the node is **dropped** from the copied graph (and any edges referencing it are also dropped).
3. Save the resulting (potentially partial) graph to the target board.
4. Returns the resulting graph on the target board.

**Response `200`:** same shape as GET (for the target board).

**Error `422`:**
- `{ "name": "state-transition-copy-no-source", "data": {} }` — source board has no transitions defined.
- `{ "name": "state-transition-copy-target-not-found", "data": {} }` — target board not accessible.
- `{ "name": "state-transition-copy-insufficient-permission", "data": {} }` — caller lacks ADMIN/OWNER on target board.

---

### 4. Feature Flag

`server/config/featureFlags.ts` — add:

```ts
STATE_TRANSITIONS_ENABLED: Bun.env.STATE_TRANSITIONS_ENABLED === 'true',
```

All routes return `501 Not Implemented` when flag is `false`.

---

### 5. Auto-sync on List Operations

Hook into existing list **rename** and **delete** handlers:

- **List renamed:** update matching node `label` in `graph_data` via a targeted JSONB update.
- **List deleted:** call `sync.stripDeletedNodes(graphData, activeLists)` and save; this removes the deleted node and all edges referencing it. This is a hard delete of those rules — no soft delete / archive.

Both hooks are no-ops when no `board_state_transitions` row exists yet.

---

### 6. File Structure

```
server/extensions/stateTransitions/
  api/
    index.ts
    get.ts
    put.ts
    getRules.ts
    copy.ts
  common/
    serializer.ts
    validator.ts
    sync.ts
  config/
    actionTypes.ts    # { id: 'allowed_move_to', label: 'Allowed move to' }
                      # Extend here when new action types are added
```

---

### 7. WebSocket Event

Broadcast the following event to all members of the board whenever `graph_data` or `enabled` changes:

```ts
{
  type: 'state_transition_updated',
  board_id: string,
  payload: { enabled: boolean, graph: StateTransitionGraph },
  actor_id: string,
  timestamp: string
}
```

---

## Deliverables

1. `db/migrations/NNNN_state_transitions.ts`
2. `server/extensions/stateTransitions/` module (all files above)
3. Routes mounted on Express app
4. Auto-sync hooks wired into list rename + delete handlers
5. WS event broadcast on graph save

---

## Acceptance Criteria

1. `GET /api/v1/boards/:boardId/state-transitions` returns a default graph (nodes from lists, no edges) when no row exists.
2. `PUT` saves graph and returns updated response; invalid node IDs return `422`.
3. `GET .../rules` returns correct `allowed_next_states` / `forbidden_next_states` derived from edges.
4. `POST .../copy` copies matching-name nodes to target board; mismatched nodes are silently dropped.
5. Deleting a list removes its node and all related edges from the stored graph.
6. All routes return `501` when `STATE_TRANSITIONS_ENABLED=false`.
7. WS event `state_transition_updated` is broadcast on every successful PUT.
8. Unit tests for `serializer.ts`, `validator.ts`, `sync.ts`.
9. Integration tests for all 4 API endpoints.
