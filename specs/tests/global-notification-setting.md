# Sprint 95 — Global Notification Setting

## Purpose
Verify the global notification master toggle in the Profile Settings page works correctly and persists across reloads. When disabled, board notifications are silenced regardless of per-board settings.

## Preconditions
- Dev server is running.
- At least one user account exists.
- User is a member of at least one board.

## Steps

### 1. "Notifications" section appears in Profile Settings
1. Log in.
2. Click the avatar menu → "Settings" (navigates to `/profile/edit`).
3. Assert that a "Notifications" section is visible on the page.
4. Assert that an "Enable notifications" toggle is visible and enabled (checked) by default.

### 2. Toggle can be turned off and persists
1. Click the toggle to disable global notifications.
2. Assert that the toggle is now unchecked/off.
3. Reload the page.
4. Assert that the toggle is still unchecked/off.

### 3. Toggle can be turned back on and persists
1. Click the toggle to re-enable global notifications.
2. Assert that the toggle is now checked/on.
3. Reload the page.
4. Assert that the toggle is still checked/on.

### 4. Notifications are suppressed when global toggle is off
1. Disable the global toggle.
2. Log in as a different user on the same board.
3. Trigger a board action (e.g., create a card).
4. Switch back to the first user's session.
5. Assert that no in-app notification appears for the first user.

### 5. Unauthenticated access rejected
1. Log out.
2. Call `GET /api/v1/user/notification-settings` without a session.
3. Assert that the response status is 401.
4. Call `PATCH /api/v1/user/notification-settings` without a session.
5. Assert that the response status is 401.

## Expected
- Profile Settings page shows a "Notifications" section with a master toggle.
- Toggling off persists after a page reload.
- All board notifications are suppressed while the global toggle is off.
- Unauthenticated requests are rejected.
