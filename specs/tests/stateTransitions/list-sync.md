# State Transitions List Sync Hooks

**Goal:** Keep `board_state_transitions.graph_data` aligned with board list lifecycle.

## Preconditions
1. `STATE_TRANSITIONS_ENABLED=true`.
2. Board has a persisted state transition graph row.

## Scenarios
1. **List rename updates node label**
   - Persist graph node mapped to list `listId` with old label.
   - Rename list title through list update endpoint.
   - Expect matching graph node label to be updated to new title.
2. **List delete strips node + edges**
   - Persist graph containing node for list to be deleted.
   - Persist edges where `fromNodeId` or `toNodeId` reference that node.
   - Delete list through list delete endpoint.
   - Expect deleted node removed and all dangling edges removed.
3. **Idempotent no-op**
   - Trigger rename/delete where resulting graph is already synchronized.
   - Expect no graph mutation and no error.
4. **All nodes deleted edge case**
   - Delete remaining lists represented in graph.
   - Expect graph with `nodes: []` and `edges: []` (notes preserved).
