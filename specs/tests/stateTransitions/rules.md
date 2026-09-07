# State Transitions Rules Endpoint

**Endpoint:** `GET /api/v1/boards/:boardId/state-transitions/rules`  
**Goal:** Return normalized transition rules for agent/MCP consumers.

## Preconditions
1. Caller is authenticated and has workspace access to the board.
2. `STATE_TRANSITIONS_ENABLED=true` unless the test explicitly disables it.
3. Board has active lists.

## Scenarios
1. **No edges**
   - Setup graph with nodes only and no edges.
   - Expect `200` with `data.rules = []`.
2. **One-way + two-way derivation**
   - Setup graph with mixed `one_way` and `two_way` edges.
   - Expect `rules[*].allowed_next_state_ids` and `forbidden_next_state_ids` to match graph reachability.
3. **Delete + rename normalization**
   - Persist stale graph containing deleted node references and outdated labels.
   - Expect deleted list IDs removed from rules and renamed list labels reflected in `current_state`/allowed/forbidden names.
4. **Feature flag off**
   - Set `STATE_TRANSITIONS_ENABLED=false`.
   - Expect `501` with `name: not-implemented`.
5. **Invalid persisted graph**
   - Persist malformed `graph_data`.
   - Expect `422` with `name: state-transition-graph-invalid`.
