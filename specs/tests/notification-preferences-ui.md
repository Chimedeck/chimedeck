> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test Spec: Notification Preferences UI

> Playwright MCP specification for Sprint 71 — NotificationPreferencesPanel component.

---

## Setup

- Base URL: `http://localhost:5173`
- Two test users pre-seeded: `user-a@test.com` / `user-b@test.com` (password `password`)
- Server flag `NOTIFICATION_PREFERENCES_ENABLED=true` in all scenarios unless stated otherwise
- Server flag `SES_ENABLED=false` by default unless stated otherwise

---

## Scenario 1 — Panel renders all 4 notification types

**Given** `NOTIFICATION_PREFERENCES_ENABLED=true`
**And** user is logged in as `user-a@test.com`

**When** user navigates to `/profile/edit`

**Then**
- Section heading "Notification Preferences" is visible
- Table contains 4 rows: "@Mentions", "Card created", "Card moved", "Card commented"
- Each row has two toggle switches: one in the "In-App" column, one in the "Email" column
- All 8 toggles are rendered

---

## Scenario 2 — Default state (opt-out model: enabled by default)

**Given** user has no rows in `notification_preferences` table

**When** user opens the Notification Preferences panel

**Then**
- All In-App toggles appear in the **on** (checked) state (`aria-checked="true"`)
- All Email toggles appear in the **on** state (or off if email is disabled — see Scenario 5)

---

## Scenario 3 — Toggling a switch fires PATCH and updates UI optimistically

**Given** user is on `/profile/edit` with the Notification Preferences panel visible
**And** the "@Mentions — In-App" toggle is currently **on**

**When** user clicks the "@Mentions — In-App" toggle

**Then**
- Toggle immediately flips to **off** (`aria-checked="false"`) — optimistic update
- A `PATCH /api/v1/notifications/preferences` request is sent with body `{ "type": "mention", "in_app_enabled": false }`
- After server response, toggle remains **off**

**When** user refreshes the page and re-opens the panel

**Then**
- "@Mentions — In-App" toggle is still **off** (persisted to DB)

---

## Scenario 4 — API error rolls back toggle and shows error toast

**Given** the server returns a 500 error for `PATCH /api/v1/notifications/preferences`

**When** user clicks any toggle

**Then**
- Toggle briefly flips (optimistic update)
- After error response, toggle reverts to its previous state
- An error toast appears with the message "Failed to save preference. Please try again."

---

## Scenario 5 — Email toggles are disabled when SES_ENABLED=false

**Given** `SES_ENABLED=false` (server default)
**And** `EMAIL_NOTIFICATIONS_ENABLED=false` (server default)

**When** user opens the Notification Preferences panel

**Then**
- All Email column toggle buttons have `disabled` attribute
- Email toggles appear visually greyed out (reduced opacity)
- Hovering over an Email toggle shows tooltip: "Email notifications are disabled on this server"
- Clicking an Email toggle does **not** fire a `PATCH` request

---

## Scenario 6 — Email toggles are enabled when SES_ENABLED=true and EMAIL_NOTIFICATIONS_ENABLED=true

**Given** `SES_ENABLED=true`
**And** `EMAIL_NOTIFICATIONS_ENABLED=true`

**When** user opens the Notification Preferences panel

**Then**
- All Email column toggle buttons are **not** disabled
- Clicking an Email toggle fires `PATCH /api/v1/notifications/preferences` with `email_enabled: false` (or `true`)

---

## Scenario 7 — Panel is hidden when NOTIFICATION_PREFERENCES_ENABLED=false

**Given** `NOTIFICATION_PREFERENCES_ENABLED=false`
**And** user is logged in

**When** user navigates to `/profile/edit`

**Then**
- Section heading "Notification Preferences" is **not** present in the DOM
- No table or toggle switches related to notification preferences are rendered

---

## Scenario 8 — Toggle aria-labels are accessible

**When** user opens the Notification Preferences panel

**Then**
- The "Card created — In-App" toggle has `aria-label="Card created — In-App"`
- The "Card created — Email" toggle has `aria-label="Card created — Email"`
- The "@Mentions — Email" toggle has `aria-label="@Mentions — Email"`
- All 8 toggles have correct `aria-label` values combining row label and column name

---

## Scenario 9 — Loading state

**Given** the `GET /api/v1/notifications/preferences` request is pending

**When** user opens the Notification Preferences panel

**Then**
- The loading placeholder text "Loading notification preferences…" is visible
- No toggle switches are rendered yet

**When** the request completes

**Then**
- Loading placeholder disappears and the toggle table renders