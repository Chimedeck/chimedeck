> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# E2E Test: Mark All Read

## Test ID
`notifications-mark-read`

## Goal
Verify that the "Mark all read" action clears the notification badge and dims all notification rows.

## Prerequisites
- User B has at least 2 unread notifications (from prior mention tests)

## Steps

1. Log in as `userB`
2. Assert: notification bell badge shows count ≥ 2
3. Click the 🔔 bell to open the panel
4. Assert: all visible notification rows have the unread indicator dot
5. Click **"Mark all read"** button in the panel header
6. Assert: badge on the bell disappears immediately
7. Assert: all notification rows no longer show the unread indicator dot
8. Close and reopen the panel
9. Assert: rows remain in "read" state (no dot)
10. Reload the page
11. Assert: bell badge is still absent (state persisted in DB)

## Acceptance Criteria
- [ ] "Mark all read" sets all rows to read state
- [ ] Badge disappears immediately (optimistic update)
- [ ] State persists across page reload
- [ ] Individual `[×]` dismiss removes the row from the panel