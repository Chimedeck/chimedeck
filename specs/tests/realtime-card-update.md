> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Playwright Test: Real-Time Card Update

**File:** `tests/realtime-card-update.spec.ts`

## Scenario

Two browser tabs open the same board. A card moved in tab 1 should appear in the new column in tab 2 within 1 second.

## Steps

1. Open tab 1 and tab 2, both navigated to `/boards/:boardId`.
2. In tab 1: drag card "Card A" from column "To Do" to column "In Progress".
3. Assert tab 1 shows "Card A" under "In Progress" immediately (optimistic).
4. Wait up to 1 second.
5. Assert tab 2 now shows "Card A" under "In Progress" without any page reload.

## Acceptance Criteria

- [ ] Card appears in the correct column in tab 2 within 1 s of the move in tab 1.
- [ ] No full page reload occurs in tab 2.
- [ ] Tab 1 ConnectionBadge shows "Live" throughout.
- [ ] Tab 2 ConnectionBadge shows "Live" throughout.

## Notes

- Requires the WebSocket server to be running (`bun run server`).
- Use `page.waitForFunction` or `expect.poll` to assert tab 2 state.