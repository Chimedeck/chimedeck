# State Transitions PUT WS Broadcast

**Endpoint:** `PUT /api/v1/boards/:boardId/state-transitions`  
**Goal:** Broadcast `state_transition_updated` on every successful update.

## Preconditions
1. Caller has board write permissions (`ADMIN`/`OWNER` path accepted by backend checks).
2. `STATE_TRANSITIONS_ENABLED=true`.
3. PubSub observer is attached for the board channel.

## Scenarios
1. **Broadcast on successful PUT**
   - Send valid PUT changing `enabled` and/or `graph`.
   - Expect `200`.
   - Expect one published event:
     - `type: state_transition_updated`
     - `board_id: :boardId`
     - `actor_id` equals current user (or `system` fallback)
     - `payload.enabled` and `payload.graph` match persisted state
2. **Cache invalidation follow-up**
   - Warm transition rules cache for board.
   - Perform successful PUT with changed graph.
   - Expect subsequent rule/enforcement read to use updated graph (cache invalidated by event path).
3. **No event on validation failure**
   - Send invalid PUT (e.g., unknown list node).
   - Expect `422` and no `state_transition_updated` event.
