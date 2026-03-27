> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Playwright MCP Test Spec — Board Notification Type Preferences Matrix (Sprint 100)

> Tests the Board Settings notification type preferences matrix, board-level overrides, reset, and translation.

---

## Setup

- Dev server running at `http://localhost:5173`
- Two seeded users: `user-a@test.com` / `user-b@test.com` (password `password`)
- One seeded board with both users as members
- Feature flags: `NOTIFICATION_PREFERENCES_ENABLED=true`, `EMAIL_NOTIFICATIONS_ENABLED=true`

---

## Scenario 1 — Matrix renders with correct types and columns

**Given** user is logged in as `user-a@test.com`
**When** user opens Board Settings for a board
**Then**
- Section heading "Notification Type Preferences" is visible
- Table contains 9 rows (all notification types)
- Each row has two toggle switches: one in the "In-App" column, one in the "Email" column
- All toggles are rendered

---

## Scenario 2 — Toggling a type updates board-level override

**Given** user is on Board Settings > Notification Type Preferences
**When** user toggles the "Card created — In-App" switch
**Then**
- Toggle immediately flips (optimistic update)
- A PATCH request is sent to `/api/v1/boards/:boardId/notification-type-preferences` with `{ type: "card_created", in_app_enabled: false }`
- After server response, toggle remains off
- The "source" indicator for that row/column shows "Board" (indigo ring)

---

## Scenario 3 — Reset to defaults restores all types

**Given** user has changed at least one type preference at board level
**When** user clicks "Reset to defaults"
**Then**
- A confirmation dialog appears
- After confirming, a DELETE request is sent to `/api/v1/boards/:boardId/notification-type-preferences`
- All toggles revert to their user/global default state
- All "source" indicators revert to "User" or "Default"

---

## Scenario 4 — Email column hides when email notifications are disabled

**Given** `EMAIL_NOTIFICATIONS_ENABLED=false`
**When** user opens Board Settings > Notification Type Preferences
**Then**
- The "Email" column is not rendered
- Only "In-App" toggles are visible

---

## Scenario 5 — All translation strings are correct

**When** user opens Board Settings > Notification Type Preferences
**Then**
- All table headings, button labels, and tooltips use translation keys from `Board/translations/en.json`
- No hardcoded English strings are present in the matrix UI

---

## Scenario 6 — Edge: API error rolls back toggle and shows error toast

**Given** the server returns a 500 error for PATCH
**When** user toggles any switch
**Then**
- Toggle briefly flips (optimistic update)
- After error, toggle reverts to previous state
- An error toast appears: "Failed to save preference. Please try again."

---

## Scenario 7 — Edge: Board member restriction

**Given** user is NOT a member of the board
**When** user tries to access Board Settings > Notification Type Preferences
**Then**
- The matrix is not visible
- API returns 403 with error name `not-a-board-member`