# State Transitions Rules Endpoint

**Endpoint:** `GET /api/v1/boards/:boardId/state-transitions/rules`  
**Goal:** Return normalized transition rules for MCP/agent consumers.

## Scenarios
1. **No edges yields no rules**
   - Graph has nodes only.
   - Expect `200` with `data.rules = []`.
2. **Allowed/forbidden derivation**
   - Graph includes mixed `one_way` and `two_way` edges.
   - Expect `allowed_next_state_ids` and `forbidden_next_state_ids` to match directional reachability.
3. **List sync normalization**
   - Persist stale graph with deleted list node and outdated labels.
   - Expect deleted references removed and labels synchronized to current list titles.
4. **Feature flag off**
   - Set `STATE_TRANSITIONS_ENABLED=false`.
   - Expect `501` with `{ name: "not-implemented" }`.
5. **Invalid persisted graph**
   - Persist malformed `graph_data`.
   - Expect `422` with `{ name: "state-transition-graph-invalid" }`.
