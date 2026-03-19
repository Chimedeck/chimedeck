# Test: Notification Preferences — Mention Guard

Verifies that the `preferenceGuard` check inside `createNotificationsForMentions` correctly gates
in-app notification insertion and WebSocket event dispatch based on the user's `in_app_enabled`
preference for the `mention` type.

---

## Prerequisites

- Two accounts exist: **UserA** (actor / mentioner) and **UserB** (mention target)
- Both users are members of a shared board that contains at least one card
- The `NOTIFICATION_PREFERENCES_ENABLED` environment variable is `true` (default)

---

## Scenario 1 — in_app_enabled: false → notification NOT created

### Setup

1. Authenticate as **UserB** and call `PATCH /api/v1/notifications/preferences` with:
   ```json
   { "preferences": [{ "type": "mention", "in_app_enabled": false, "email_enabled": true }] }
   ```
2. Verify the response contains `{ "type": "mention", "in_app_enabled": false }`.

### Steps

1. Authenticate as **UserA**.
2. Open the card detail for a card UserB is a member of.
3. Edit the card description and add `@UserB` to trigger a mention.
4. Save the card description.

### Expected outcomes

- The API response for the card update returns `200 OK`.
- Calling `GET /api/v1/notifications` **as UserB** returns an empty array (no `mention` notification row exists).
- No `notification_created` WebSocket event is received on UserB's channel for this mention.

---

## Scenario 2 — in_app_enabled: true → notification IS created

### Setup

1. Authenticate as **UserB** and call `PATCH /api/v1/notifications/preferences` with:
   ```json
   { "preferences": [{ "type": "mention", "in_app_enabled": true, "email_enabled": true }] }
   ```
2. Verify the response contains `{ "type": "mention", "in_app_enabled": true }`.

### Steps

1. Authenticate as **UserA**.
2. Open the card detail for the same card.
3. Edit the card description to include `@UserB` (different wording to ensure a new mention event).
4. Save the card description.

### Expected outcomes

- The API response for the card update returns `200 OK`.
- Calling `GET /api/v1/notifications` **as UserB** returns an array containing exactly one notification with:
  - `type: "mention"`
  - `read: false`
  - `actor_id` equal to UserA's id
- A `notification_created` WebSocket event is received on UserB's channel with the notification payload including the `actor` object.

---

## Scenario 3 — NOTIFICATION_PREFERENCES_ENABLED=false → always deliver

### Setup

1. Set the environment variable `NOTIFICATION_PREFERENCES_ENABLED=false` (restart server).
2. Authenticate as **UserB** and ensure a DB row with `in_app_enabled: false` for `mention` exists
   (carryover from Scenario 1 or created explicitly via direct DB insert).

### Steps

1. Authenticate as **UserA**.
2. Edit the card description to add a new `@UserB` mention.
3. Save the card description.

### Expected outcomes

- Calling `GET /api/v1/notifications` **as UserB** returns the notification (preference guard was skipped).
- The notification has `type: "mention"` and `read: false`.

---

## Scenario 4 — Actor mentioning themselves → no notification

### Setup

- `NOTIFICATION_PREFERENCES_ENABLED=true`, UserA's mention preference is enabled.

### Steps

1. Authenticate as **UserA**.
2. Edit a card description to add `@UserA` (self-mention).
3. Save.

### Expected outcomes

- `GET /api/v1/notifications` as **UserA** returns no notification for this event.

---

## Scenario 5 — preferenceGuard DB error → fail open (notification delivered)

> This scenario validates that a transient DB error inside `preferenceGuard` does not swallow
> the notification. It is best verified via an integration/unit test that mocks a DB failure,
> but is documented here for completeness.

### Expected behaviour

- If `preferenceGuard` throws (e.g., DB connection error), `in_app_enabled` defaults to `true`.
- The notification is inserted and the WS event is published as if preferences were enabled.
