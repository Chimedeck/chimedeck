# State Transitions Enforcement — Test Scenarios

## Scope
Server-side enforcement for card moves (`validateCardMove`), rules caching/invalidation, and Trello-compat error mapping.

## Unit Tests
1. **Allowed move succeeds**
   - Given `enabled=true` and an edge `A -> B`, moving card from list `A` to `B` returns success.
2. **Forbidden move is blocked with details**
   - Given `enabled=true` and edge `A -> B`, moving from `A` to `C` throws `StateTransitionForbiddenError`.
   - Error includes `fromListId`, `toListId`, and `allowedNextStates` names/ids.
3. **Same-list reorder always allowed**
   - Moving from `A` to `A` always succeeds, regardless of graph.
4. **No outgoing edges means fully locked**
   - Given node `A` has no outgoing edges, moving from `A` to any different list is blocked.
5. **Feature disabled is no-op**
   - With `STATE_TRANSITIONS_ENABLED=false`, no move is blocked by transition rules.
6. **Board enforcement disabled is no-op**
   - With board row `enabled=false`, no move is blocked by transition rules.

## Integration Tests
1. **Card move API returns 422 on forbidden transition**
   - `POST/PATCH` move endpoint responds:
   ```json
   {
     "name": "state-transition-forbidden",
     "data": {
       "fromListId": "...",
       "fromListName": "...",
       "toListId": "...",
       "toListName": "...",
       "allowedNextStates": []
     }
   }
   ```
2. **Trello-compat move returns Trello-style 422**
   - Response body:
   ```json
   {
     "message": "State transition from \"<from>\" to \"<to>\" is not allowed.",
     "error": "STATE_TRANSITION_FORBIDDEN"
   }
   ```
3. **Blocked move writes activity**
   - Activity stream contains `card_move_blocked` with from/to list IDs and names.

## Cache and WS Invalidation
1. **Rules cache hit**
   - Repeated rules read returns cached data within TTL window.
2. **PUT invalidates cache**
   - After successful `PUT /state-transitions`, next enforcement read uses updated rules.
3. **WS event invalidates cache**
   - On `state_transition_updated` event handling, board cache entry is evicted and re-derived on next access.
