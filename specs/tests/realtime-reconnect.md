> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Playwright Test: Reconnect Banner

**File:** `tests/realtime-reconnect.spec.ts`

## Scenario

The ConnectionBadge in the board header changes state when the WebSocket drops and recovers.

## Steps

1. Open the board page.
2. Assert ConnectionBadge shows "Live".
3. Simulate network disconnect (intercept WebSocket or take the server offline).
4. Assert ConnectionBadge transitions to "Reconnecting…" within 2 s.
5. Restore the network / server.
6. Assert ConnectionBadge returns to "Live" within 10 s.
7. Assert that any missed events (card created during disconnect) are applied after reconnect.

## Acceptance Criteria

- [ ] Badge shows "Live" when connected.
- [ ] Badge shows "Reconnecting…" after WebSocket close.
- [ ] Badge returns to "Live" after reconnect.
- [ ] State created during the offline window appears after reconnect (via missed-event fetch or queue replay).

## Notes

- Use `page.route('**/ws*', route => route.abort())` to simulate disconnect.
- Use exponential-backoff awareness when waiting for reconnect.