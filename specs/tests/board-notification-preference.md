> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 95 — Board Notification Preference

## Purpose
Verify the per-board notification toggle in Board Settings works correctly and persists across reloads.

## Preconditions
- Dev server is running.
- User A is a board member of at least one board.
- User B is NOT a member of that board.

## Steps

### 1. Toggle appears in Board Settings
1. Log in as User A.
2. Open a board.
3. Click the tri-dot (⋯) menu in the board header → "Board settings".
4. Assert that a "User settings" section is visible.
5. Assert that a "Notifications for this board" toggle is visible and enabled (checked) by default.

### 2. Toggle can be turned off and persists
1. Click the toggle to disable notifications.
2. Assert that the toggle is now unchecked/off.
3. Close Board Settings.
4. Reload the page and re-open Board Settings.
5. Assert that the toggle is still unchecked/off.

### 3. Board membership required
1. Log in as User B (not a board member).
2. Call `GET /api/v1/boards/:boardId/notification-preference` directly.
3. Assert that the response status is 403 with error name `not-a-board-member`.

### 4. Unauthenticated access rejected
1. Log out.
2. Call `GET /api/v1/boards/:boardId/notification-preference` without a session.
3. Assert that the response status is 401.

## Expected
- Board Settings shows a "User settings" section with the notification toggle.
- Toggling off persists after a page reload.
- Non-members cannot access or modify the board preference.
- Unauthenticated requests are rejected.