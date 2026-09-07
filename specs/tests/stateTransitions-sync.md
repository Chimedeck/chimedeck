# State Transitions List Sync Hooks

**Goal:** Keep `board_state_transitions.graph_data` aligned with board lists on rename/delete.

## Scenarios
1. **Rename sync**
   - Rename a list used by an existing graph node.
   - Expect the mapped node label to update to the new list title.
2. **Delete sync**
   - Delete a list represented by a graph node with connected edges.
   - Expect the node removed and all related edges removed.
3. **No-op safety**
   - Run rename/delete where graph is already synchronized.
   - Expect no mutation and no error.
4. **All mapped nodes removed**
   - Delete remaining mapped lists.
   - Expect `nodes: []`, `edges: []`, and notes preserved.
