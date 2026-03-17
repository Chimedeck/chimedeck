# Offline Replay — Idempotent Comment Create & Card Description Save
## Sprint 83

### Overview

Verify that the server correctly handles offline replay scenarios where the client
re-submits a comment POST or a card description PATCH after reconnecting. Each
operation must be idempotent: a second submission of the same payload must return
the same result without creating duplicate comments or duplicate activity-feed entries.

**API conventions:**
- Success shape: `{ data: ... }`
- Error shape: `{ error: { code: 'hyphenated-error-name', message?: ... } }`

---

## Part 1 — Idempotent Comment Creation

### Scenario 1 — New comment is created without idempotency_key (normal online path)

**Given** User A is authenticated and is a MEMBER of the board  
**And** a card exists on that board  
**When** `POST /api/v1/cards/:cardId/comments` is called with body:
  ```json
  { "content": "Hello world" }
  ```
**Then** the response status is `201`  
**And** the response body is `{ data: { id, card_id, user_id, content, version, created_at, updated_at, author_name, ... } }`  
**And** `content` equals `"Hello world"`  
**And** a comment row is present in the database

---

### Scenario 2 — Comment created with an idempotency_key succeeds on first call

**Given** User A is authenticated and is a MEMBER of the board  
**And** a card exists on that board  
**When** `POST /api/v1/cards/:cardId/comments` is called with body:
  ```json
  {
    "content": "My offline comment",
    "idempotency_key": "client-uuid-abc-123"
  }
  ```
**Then** the response status is `201`  
**And** the response body contains:
  - `data.content` equals `"My offline comment"`
  - `data.id` is a UUID

---

### Scenario 3 — Duplicate replay with same idempotency_key returns the original comment

**Given** User A previously created a comment with `idempotency_key: "client-uuid-abc-123"`  
**And** the comment was successfully stored with `id: "original-comment-id"`  
**When** `POST /api/v1/cards/:cardId/comments` is called again with the same body:
  ```json
  {
    "content": "My offline comment",
    "idempotency_key": "client-uuid-abc-123"
  }
  ```
**Then** the response status is `201`  
**And** `data.id` equals `"original-comment-id"` (the original comment, not a new one)  
**And** no second comment row exists in the database for that card from User A with this key  
**And** no duplicate activity-feed entry is created

---

### Scenario 4 — Different users may use the same idempotency_key independently

**Given** User A created a comment with `idempotency_key: "shared-key-xyz"`  
**When** User B (also a board MEMBER) submits a comment with the same `idempotency_key: "shared-key-xyz"`  
**Then** User B's response status is `201`  
**And** a new comment is created for User B (not User A's comment returned)  
**And** the two comments have different `id` values and different `user_id` values

---

### Scenario 5 — Empty idempotency_key is rejected

**Given** User A is authenticated  
**When** `POST /api/v1/cards/:cardId/comments` is called with body:
  ```json
  { "content": "Test", "idempotency_key": "" }
  ```
**Then** the response status is `400`  
**And** the error code is `"bad-request"`

---

### Scenario 6 — Comment without content is still rejected even with idempotency_key

**Given** User A is authenticated  
**When** `POST /api/v1/cards/:cardId/comments` is called with body:
  ```json
  { "idempotency_key": "valid-key" }
  ```
**Then** the response status is `400`  
**And** the error code is `"bad-request"`

---

### Scenario 7 — Replay while offline-then-reconnect, end-to-end

**Given** User A is on the card modal and types a comment  
**And** the browser is taken offline  
**When** User A presses **Comment**  
**Then** the UI shows `Will post when back online`  
**And** the comment draft has `intent: "submit_pending"` in the local store  
**When** the browser comes back online  
**Then** the queued POST is replayed with the stored `idempotency_key`  
**And** the response returns the created comment  
**And** the comment appears in the activity feed  
**And** the local comment draft is cleared

---

## Part 2 — Idempotent Card Description PATCH

### Scenario 8 — Description save succeeds on first call

**Given** User A is authenticated and is a MEMBER of the board  
**And** a card exists on that board  
**When** `PATCH /api/v1/cards/:cardId/description` is called with body:
  ```json
  {
    "description": "# Sprint goals\n\nThis sprint covers...",
    "idempotency_key": "save-op-uuid-001",
    "client_updated_at": "2026-03-17T06:00:00.000Z"
  }
  ```
**Then** the response status is `200`  
**And** the response body is `{ data: { id, description, updated_at, ... } }`  
**And** `data.description` contains the saved markdown  
**And** a `card.description.updated` activity event is written

---

### Scenario 9 — Replay with same idempotency_key and stale client_updated_at returns current card without duplicate activity

**Given** User A's description save was already applied at server time `T1 = "2026-03-17T06:00:10.000Z"`  
**And** User A replays the same PATCH with `client_updated_at: "2026-03-17T06:00:00.000Z"` (before T1)  
**When** `PATCH /api/v1/cards/:cardId/description` is called again with:
  ```json
  {
    "description": "# Sprint goals\n\nThis sprint covers...",
    "idempotency_key": "save-op-uuid-001",
    "client_updated_at": "2026-03-17T06:00:00.000Z"
  }
  ```
**Then** the response status is `200`  
**And** `data` is the current card (unchanged description)  
**And** no second `card.description.updated` activity entry is written

---

### Scenario 10 — PATCH without client_updated_at always applies update

**Given** User A is authenticated  
**When** `PATCH /api/v1/cards/:cardId/description` is called with body:
  ```json
  { "description": "Updated without metadata" }
  ```
**Then** the response status is `200`  
**And** the description is updated normally  
**And** a `card.description.updated` activity event is written

---

### Scenario 11 — Missing description field is rejected

**Given** User A is authenticated  
**When** `PATCH /api/v1/cards/:cardId/description` is called with body:
  ```json
  { "idempotency_key": "some-key" }
  ```
**Then** the response status is `400`  
**And** the error code is `"bad-request"`

---

### Scenario 12 — Invalid client_updated_at timestamp is rejected

**Given** User A is authenticated  
**When** `PATCH /api/v1/cards/:cardId/description` is called with body:
  ```json
  {
    "description": "Some content",
    "idempotency_key": "key-xyz",
    "client_updated_at": "not-a-date"
  }
  ```
**Then** the response status is `400`  
**And** the error code is `"bad-request"`

---

### Scenario 13 — Unauthenticated request to description PATCH is rejected

**Given** no Authorization header  
**When** `PATCH /api/v1/cards/:cardId/description` is called  
**Then** the response status is `401`

---

### Scenario 14 — Description PATCH for archived board is rejected

**Given** User A is authenticated  
**And** the board containing the card is ARCHIVED  
**When** `PATCH /api/v1/cards/:cardId/description` is called  
**Then** the response status is `403`

---

## Part 3 — Cross-scenario: description save replay after offline/online transition

### Scenario 15 — End-to-end offline description save and replay

**Given** User A has the card modal open and edits the description  
**And** the browser is taken offline  
**When** User A presses **Save**  
**Then** the draft is stored locally with `intent: "save_pending"`  
**And** the UI shows `Will save when back online`  
**When** the browser comes back online  
**Then** the queued `PATCH /api/v1/cards/:cardId/description` is replayed with `idempotency_key` and `client_updated_at`  
**And** the server applies the description update  
**And** the UI transitions to `Synced`  
**And** the local draft is cleared

### Scenario 16 — Hard refresh before reconnect restores save_pending draft

**Given** User A pressed Save while offline (draft is `save_pending`)  
**When** the browser performs a hard refresh (Ctrl+R / Cmd+R) while still offline  
**Then** on card open, the draft is restored from local IndexedDB  
**And** the UI shows `Will save when back online` (not a blank description)  
**When** the browser reconnects  
**Then** the queued PATCH is replayed as in Scenario 15
