# State Transitions API (GET + PUT)

## Scope

This spec covers Iteration 56, Phase 3 API verification for:

- `GET /api/v1/boards/:boardId/state-transitions`
- `PUT /api/v1/boards/:boardId/state-transitions`

## Preconditions

1. Test user is authenticated and has board access.
2. `STATE_TRANSITIONS_ENABLED=true` unless a test explicitly disables it.
3. Target board has at least two active lists.

## Test Cases

### 1. GET returns default graph when no transition row exists

1. Ensure `board_state_transitions` has no row for the target board.
2. Send `GET /api/v1/boards/:boardId/state-transitions`.
3. Expect `200` with:
   - `data.boardId` = target board id
   - `data.enabled` = `false`
   - `data.graph.nodes` auto-created from board lists
   - `data.graph.edges` = `[]`
   - `data.graph.notes` = `[]`
4. Verify a `board_state_transitions` row is created lazily.

### 2. PUT valid graph saves and returns updated data

1. Send `PUT /api/v1/boards/:boardId/state-transitions` with body:
   - `enabled: true`
   - `graph` containing valid nodes/edges referencing existing board lists only
2. Expect `200` with updated `data.enabled` and `data.graph`.
3. Verify DB row is updated with the new graph payload.

### 3. PUT with unknown listId returns 422

1. Send `PUT /api/v1/boards/:boardId/state-transitions` where one node references a non-existent `listId`.
2. Expect `422` with:
   - `name: state-transition-node-unknown-list`
   - `data.nodeId` for the invalid node.

### 4. Feature flag disabled returns 501 for GET and PUT

1. Set `STATE_TRANSITIONS_ENABLED=false`.
2. Send `GET /api/v1/boards/:boardId/state-transitions`.
3. Send `PUT /api/v1/boards/:boardId/state-transitions`.
4. Expect both responses to be `501` with:
   - `name: not-implemented`.
