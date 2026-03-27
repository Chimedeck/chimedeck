> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

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

---

## Part 4 — Cross-Device Draft Continuity

### Scenario 17 — Server draft is newer than local: cross-device merge on card open

**Given** User A edited a description on Device 1, which synced draft to server at `T1`  
**And** User A opens the same card on Device 2, which has no local draft  
**When** the card modal opens on Device 2 (online)  
**Then** `GET /api/v1/cards/:cardId/drafts` is called  
**And** the description editor is pre-filled with the server draft content  
**And** the footer shows `Synced draft`  
**And** the server draft is back-synced to Device 2's IndexedDB

---

### Scenario 18 — Local draft is newer than server: local wins on reconcile

**Given** User A edited a description on Device 1 (local only, not yet synced) at `T2`  
**And** the server has an older draft from a previous session at `T1` (T1 < T2)  
**When** User A opens the card modal on Device 1 (online)  
**Then** the reconcile logic picks the local draft (T2 > T1)  
**And** the description editor is pre-filled with the Device 1 local content  
**And** the footer shows `Draft saved locally`  
**And** the local draft is NOT overwritten with the stale server version

---

### Scenario 19 — Both sides have equal timestamps: server wins (tie-break)

**Given** User A has a local draft and a server draft with identical `client_updated_at`  
**When** the card modal opens  
**Then** reconcile picks the server draft (server wins tie-break)  
**And** the description editor is pre-filled with the server content  
**And** the footer shows `Synced draft`

---

### Scenario 20 — Cross-device: offline device keeps local draft until reconnect

**Given** User A edited a description on Device 2 while offline at `T2`  
**And** the server has a draft from Device 1 at `T1` (T1 < T2)  
**When** the card modal opens on Device 2 while still offline  
**Then** the description editor is pre-filled with the local Device 2 content (local-only restore)  
**And** the footer shows `Draft saved locally`  
**When** Device 2 comes back online  
**Then** background sync pushes the local draft to the server (since T2 > T1, it will win on next open)

---

## Part 5 — Replay Conflict UI

### Scenario 21 — save_pending conflict: server overwritten local pending save

**Given** User A pressed Save offline on Device 1 (draft `save_pending`, timestamp `T1`)  
**And** User A also edited the same card on Device 2, which synced a newer draft to the server at `T2` (T2 > T1)  
**When** Device 1 comes back online and opens the card modal  
**Then** reconcile fetches both local (`save_pending`, `T1`) and server (`editing`, `T2`)  
**And** the server draft wins (T2 > T1)  
**And** `loserPendingIntent` is `save_pending`  
**And** the footer shows `Save failed` with a `Retry Save` button and `Discard draft` button  
**And** `data-testid="draft-retry-sync"` button label is `Retry Save`  
**And** `data-testid="draft-discard"` button is visible

---

### Scenario 22 — Retry Save re-enqueues the PATCH

**Given** the state from Scenario 21 (save conflict, "Save failed" UI shown)  
**When** User A clicks `Retry Save`  
**Then** the current editor content is saved locally with `intent: save_pending`  
**And** a new `PATCH /api/v1/cards/:cardId` is enqueued in messageQueue  
**And** the footer transitions to `Will save when back online`  
**And** on reconnect, the PATCH is replayed and the description is updated

---

### Scenario 23 — Discard draft after save conflict clears state

**Given** the state from Scenario 21 (save conflict, "Save failed" UI shown)  
**When** User A clicks `Discard draft`  
**Then** the local draft is deleted from IndexedDB  
**And** the server draft is deleted  
**And** the footer disappears (status becomes `idle`)  
**And** the description reverts to the last saved server value

---

### Scenario 24 — submit_pending conflict: server newer than local comment draft

**Given** User A pressed Comment offline on Device 1 (draft `submit_pending`, `T1`)  
**And** User A edited the same comment draft on Device 2, which synced a newer comment draft to the server at `T2` (T2 > T1)  
**When** Device 1 opens the card modal online  
**Then** reconcile resolves with server winning  
**And** `loserPendingIntent` is `submit_pending`  
**And** the comment footer shows `Post failed` with `Retry Post` and `Discard draft` buttons  
**And** `data-testid="comment-draft-retry-sync"` button label is `Retry Post`

---

### Scenario 25 — Retry Post re-enqueues the POST with idempotency key

**Given** the state from Scenario 24 (post conflict, "Post failed" UI shown)  
**When** User A clicks `Retry Post`  
**Then** the current comment content is saved locally with `intent: submit_pending`  
**And** a `POST /api/v1/cards/:cardId/comments` is enqueued with the same (or new stable) `idempotency_key`  
**And** the footer shows `Will post when back online`  
**And** on reconnect, the POST is replayed idempotently

---

### Scenario 26 — Non-pending sync failure shows generic "Retry" label

**Given** User A is typing in the description editor (background sync running)  
**And** the background `PUT /api/v1/cards/:cardId/drafts/description` call fails with a 500  
**When** the error is returned  
**Then** the footer shows `Sync failed` with `Retry` (NOT `Retry Save`)  
**And** clicking `Retry` retries the background draft PUT (not a PATCH)

---

### Scenario 27 — Non-pending comment sync failure shows generic "Retry" label

**Given** User A is typing in the comment editor (background draft sync running)  
**And** the background `PUT /api/v1/cards/:cardId/drafts/comment` call fails with a 500  
**When** the error is returned  
**Then** the footer shows `Sync failed` with `Retry` (NOT `Retry Post`)  
**And** clicking `Retry` retries the background draft PUT