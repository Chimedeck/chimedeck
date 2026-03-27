> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Notification Preferences API — Playwright MCP Spec

## Overview

Tests for `GET /api/v1/notifications/preferences` and `PATCH /api/v1/notifications/preferences`.

---

## Setup

- Two registered users: **userA** (primary) and **userB** (secondary).
- Both have verified accounts with valid JWT tokens.
- The `NOTIFICATION_PREFERENCES_ENABLED` flag is **on** (default).

---

## Test Cases

### 1. GET returns all 4 types with defaults for a new user

**Steps:**
1. Authenticate as userA (fresh account with no preference rows).
2. `GET /api/v1/notifications/preferences` with the JWT bearer token.

**Expected response (200):**
```json
{
  "data": [
    { "type": "mention",        "in_app_enabled": true, "email_enabled": true, "updated_at": null },
    { "type": "card_created",   "in_app_enabled": true, "email_enabled": true, "updated_at": null },
    { "type": "card_moved",     "in_app_enabled": true, "email_enabled": true, "updated_at": null },
    { "type": "card_commented", "in_app_enabled": true, "email_enabled": true, "updated_at": null }
  ]
}
```

---

### 2. PATCH upserts a preference correctly (insert)

**Steps:**
1. Authenticate as userA.
2. `PATCH /api/v1/notifications/preferences` with body:
   ```json
   { "type": "mention", "in_app_enabled": false }
   ```

**Expected response (200):**
```json
{
  "data": {
    "type": "mention",
    "in_app_enabled": false,
    "email_enabled": true,
    "updated_at": "<ISO timestamp>"
  }
}
```

---

### 3. GET reflects the upserted value

**Steps:**
1. After step 2 above, `GET /api/v1/notifications/preferences` as userA.

**Expected:**
- `mention` row has `in_app_enabled: false`, `email_enabled: true`.
- The other 3 types still show defaults (`in_app_enabled: true`, `email_enabled: true`).

---

### 4. PATCH upserts a preference correctly (update existing)

**Steps:**
1. Authenticate as userA (reuse session from above).
2. `PATCH /api/v1/notifications/preferences` with body:
   ```json
   { "type": "mention", "in_app_enabled": true, "email_enabled": false }
   ```

**Expected response (200):**
```json
{
  "data": {
    "type": "mention",
    "in_app_enabled": true,
    "email_enabled": false,
    "updated_at": "<ISO timestamp>"
  }
}
```

---

### 5. PATCH rejects an invalid type

**Steps:**
1. `PATCH /api/v1/notifications/preferences` with body:
   ```json
   { "type": "unknown_type", "in_app_enabled": true }
   ```

**Expected response (400):**
```json
{
  "error": {
    "name": "invalid-notification-type"
  }
}
```

---

### 6. PATCH rejects a non-boolean value

**Steps:**
1. `PATCH /api/v1/notifications/preferences` with body:
   ```json
   { "type": "mention", "in_app_enabled": "yes" }
   ```

**Expected response (400):**
```json
{
  "error": {
    "name": "invalid-in-app-enabled"
  }
}
```

---

### 7. Unauthenticated GET returns 401

**Steps:**
1. `GET /api/v1/notifications/preferences` with **no** Authorization header.

**Expected response (401).**

---

### 8. Unauthenticated PATCH returns 401

**Steps:**
1. `PATCH /api/v1/notifications/preferences` with **no** Authorization header, body:
   ```json
   { "type": "mention", "in_app_enabled": false }
   ```

**Expected response (401).**

---

### 9. Feature flag off returns 501

**Steps:**
1. Set `NOTIFICATION_PREFERENCES_ENABLED=false` in the environment and restart the server.
2. Authenticate as userA.
3. `GET /api/v1/notifications/preferences`.

**Expected response (501):**
```json
{
  "error": {
    "name": "feature-disabled"
  }
}
```

---

### 10. Preferences are isolated per user

**Steps:**
1. Authenticate as userA and `PATCH` to disable `mention` in-app.
2. Authenticate as userB (fresh account).
3. `GET /api/v1/notifications/preferences` as userB.

**Expected:** userB sees all 4 types with default `true` values — unaffected by userA's settings.