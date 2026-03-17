# Offline Comment Draft Recovery
## Sprint 83

### Overview

Verify that the `CommentEditor` persists comment drafts locally while offline,
restores them on card re-open, and queues the comment POST for replay when the
user presses **Comment/Save** while offline. Once reconnected, the queued
mutation is replayed idempotently and the draft is cleared.

**Scope:** `CommentEditor` in both new-comment and edit-comment modes.

**Draft states (footer UI):**
- `Draft saved locally` — typing, persisted to IndexedDB, no network
- `Synced draft` — typing, persisted to IndexedDB + server
- `Will post when back online` — offline submit queued
- `Sync failed` — background server sync failed (shows Retry / Discard)
- `Will sync when online` — typing while offline, local only

---

## Part 1 — Local Draft Persistence While Offline (New Comment)

### Scenario 1 — Typing while offline saves to IndexedDB

**Given** User A is authenticated  
**And** a card modal is open for card C1  
**And** the network connection is offline  
**When** User A types `"My offline comment text"` in the comment editor  
**And** waits 800 ms (debounce interval)  
**Then** IndexedDB store `kanban-offline-drafts` contains a draft with:
  - `draftType: 'comment'`
  - `contentMarkdown: 'My offline comment text'`
  - `intent: 'editing'`
  - `key` matching `{userId}::{workspaceId}::{cardId}::comment`
**And** the footer shows `Will sync when online`

---

### Scenario 2 — Draft is restored after hard refresh (offline)

**Given** User A typed `"Hard refresh comment"` in the comment editor while offline  
**And** the draft was debounce-saved to IndexedDB  
**When** User A does a hard page refresh (Cmd+Shift+R / F5) while still offline  
**And** opens the same card modal  
**Then** the comment editor is pre-filled with `"Hard refresh comment"`  
**And** the footer shows `Draft saved locally`  
**And** the draft recovery banner is visible with text `Unsaved comment draft restored`

---

### Scenario 3 — Draft is restored after hard refresh (online)

**Given** User A typed `"Online refresh comment"` in the comment editor  
**And** the draft was synced to the server  
**When** User A does a hard page refresh  
**And** opens the same card modal (online)  
**Then** the comment editor is pre-filled with `"Online refresh comment"`  
**And** the footer shows `Synced draft`

---

### Scenario 4 — Typing while online syncs draft to server after 3 s

**Given** User A is authenticated and online  
**And** a card modal is open for card C1  
**When** User A types `"Online typing"` in the comment editor  
**And** waits 3000 ms (server sync debounce)  
**Then** `PUT /api/v1/cards/C1/drafts/comment` was called with:
  ```json
  { "content_markdown": "Online typing", "intent": "editing" }
  ```
**And** the footer shows `Synced draft`

---

## Part 2 — Offline Submit Queuing

### Scenario 5 — Pressing Comment while offline queues a POST

**Given** User A is authenticated  
**And** a card modal is open for card C1  
**And** the network connection is offline  
**When** User A types `"Offline comment"` in the comment editor  
**And** User A presses the **Comment** button  
**Then** the editor remains visible with the typed text  
**And** the footer shows `Will post when back online`  
**And** the draft recovery banner updates to `Unsaved comment (will post when back online)`  
**And** the IndexedDB draft has `intent: 'submit_pending'`  
**And** the in-memory message queue contains a POST mutation for `/api/v1/cards/C1/comments`  
**And** the mutation body includes `{ "content": "Offline comment", "idempotency_key": "<uuid>" }`  
**And** `onSubmit` callback was NOT called

---

### Scenario 6 — Draft is preserved after hard refresh with submit_pending intent

**Given** User A pressed Comment while offline (scenario 5)  
**And** the draft is stored as `submit_pending` in IndexedDB  
**When** User A does a hard page refresh while still offline  
**And** opens the same card modal  
**Then** the comment editor is pre-filled with `"Offline comment"`  
**And** the footer shows `Will post when back online`  
**And** the draft recovery banner shows `Unsaved comment (will post when back online)`

---

### Scenario 7 — Reconnecting replays queued comment POST

**Given** User A has a queued POST in the message queue (from scenario 5)  
**And** the `idempotency_key` is the UUID from the queued mutation  
**When** the network reconnects and the WebSocket is re-established  
**And** the queue is replayed  
**Then** `POST /api/v1/cards/C1/comments` is called with:
  ```json
  {
    "content": "Offline comment",
    "idempotency_key": "<same-uuid>"
  }
  ```
**And** the response is `201` with a new comment row  
**And** after successful replay, `clearDraft` is called  
**And** the comment draft is removed from IndexedDB  
**And** `DELETE /api/v1/cards/C1/drafts/comment` is called on the server  
**And** the footer draft status returns to `idle` (no footer shown)

---

### Scenario 8 — Replayed POST is idempotent (no duplicate comment)

**Given** the queued POST from scenario 5 was already replayed once  
**When** the replay is triggered again with the same `idempotency_key`  
**Then** the server returns the original comment (same `id`)  
**And** no duplicate comment appears in the activity feed  
**And** no new database row is created for that comment

---

## Part 3 — Draft Privacy

### Scenario 9 — Comment draft is NOT visible to other users

**Given** User A typed `"Private draft"` in the comment editor but did not press Comment  
**And** User B is viewing the same card at the same time  
**Then** User B does NOT see `"Private draft"` in the activity feed  
**And** `GET /api/v1/cards/C1/drafts` scoped to User B returns an empty list  
**And** User A's draft is only returned when queried with User A's auth token

---

### Scenario 10 — Unposted comment does NOT appear in the activity feed

**Given** User A has a `submit_pending` draft for card C1  
**When** User B opens the activity feed for card C1  
**Then** the activity feed does NOT contain any comment with User A's pending content  
**And** the comment only appears after the replay POST succeeds

---

## Part 4 — Draft Restore on Login / Card Open

### Scenario 11 — Restore synced draft on card open (cross-device)

**Given** User A typed and synced a comment draft on Device 1  
**When** User A opens the same card modal on Device 2 (logged in, online)  
**Then** the comment editor on Device 2 is pre-filled with the synced draft text  
**And** the footer shows `Synced draft`

---

### Scenario 12 — Local draft wins when more recent than server draft

**Given** User A has a server draft with `client_updated_at: T1`  
**And** User A also has a local draft with `updatedAt: T2` where `T2 > T1`  
**When** the reconcile logic runs  
**Then** the local draft content is applied to the editor  
**And** the footer shows `Draft saved locally`

---

### Scenario 13 — Server draft wins when more recent than local draft

**Given** User A has a local draft with `updatedAt: T1`  
**And** User A has a server draft with `client_updated_at: T2` where `T2 > T1`  
**When** the reconcile logic runs  
**Then** the server draft content is applied to the editor  
**And** the footer shows `Synced draft`  
**And** the server draft is back-synced to IndexedDB

---

## Part 5 — Draft Cleanup

### Scenario 14 — Successful online submit clears the draft

**Given** User A has a comment draft in IndexedDB and on the server  
**When** User A presses the **Comment** button while online  
**And** `onSubmit` resolves successfully  
**Then** the editor content is cleared  
**And** the IndexedDB draft is deleted  
**And** `DELETE /api/v1/cards/C1/drafts/comment` is called  
**And** the footer draft status is `idle`

---

### Scenario 15 — Pressing Discard clears the draft without submitting

**Given** User A has a comment draft restored in the editor  
**When** User A clicks the **Discard** button in the recovery banner  
**Then** the IndexedDB draft is deleted  
**And** `DELETE /api/v1/cards/C1/drafts/comment` is called  
**And** the recovery banner is hidden  
**And** the footer draft status is `idle`  
**And** the editor content is NOT cleared (user may keep typing)

---

## Part 6 — Sync Failure Handling

### Scenario 16 — Server sync failure shows retry option

**Given** User A is typing in the comment editor while online  
**And** the background PUT to `/api/v1/cards/C1/drafts/comment` returns a 500 error  
**Then** the footer shows `Sync failed`  
**And** a `Retry` link and `Discard draft` link are visible

---

### Scenario 17 — Retry sync recovers from failure

**Given** the footer shows `Sync failed` (scenario 16)  
**When** User A clicks **Retry**  
**Then** `PUT /api/v1/cards/C1/drafts/comment` is called again  
**And** on success the footer shows `Synced draft`

---

## Part 7 — Edit Comment Mode

### Scenario 18 — Editing an existing comment persists a draft

**Given** User A is editing an existing comment (edit-comment form with `initialValue`)  
**And** the `cardId` and `boardId` are passed to `CommentEditor`  
**When** User A modifies the text and waits 800 ms  
**Then** the modified text is saved to IndexedDB as a comment draft  
**And** the footer shows the appropriate draft status

---

### Scenario 19 — Pressing Cancel does not clear the draft

**Given** User A started editing an existing comment and a draft was saved  
**When** User A presses the **Cancel** button  
**Then** the edit form is dismissed  
**And** the draft remains in IndexedDB (not deleted by cancel)  
**And** the draft will be restored next time the edit form is opened

> Note: explicit draft discard is via the Discard button, not Cancel.

---

## Part 8 — Cross-Device Comment Draft Continuity

### Scenario 20 — Comment draft synced on Device 1 is restored on Device 2

**Given** User A typed a comment on Device 1 and the draft was synced to the server  
**When** User A opens the same card modal on Device 2 (fresh browser, no local IndexedDB)  
**Then** `GET /api/v1/cards/:cardId/drafts` returns the server comment draft  
**And** the comment editor is pre-filled with the Device 1 draft content  
**And** the footer shows `Synced draft`  
**And** the draft is back-synced to Device 2's IndexedDB

---

### Scenario 21 — Offline Device 2 draft wins over stale server draft

**Given** User A has a server comment draft from Device 1 at timestamp `T1`  
**And** User A has a local comment draft on Device 2 at timestamp `T2` (T2 > T1), typed while offline  
**When** Device 2 opens the card modal while still offline  
**Then** the local draft wins (local-only restore since offline)  
**And** the comment editor is pre-filled with the Device 2 draft  
**And** the footer shows `Draft saved locally`

---

### Scenario 22 — submit_pending conflict: "Post failed" UI with Retry Post and Discard

**Given** User A pressed Comment offline on Device 1 (`submit_pending` draft at `T1`)  
**And** User A also edited the same comment draft on Device 2, syncing a newer version to the server at `T2` (T2 > T1)  
**When** Device 1 reconnects and opens the card modal  
**Then** reconcile returns server as winner with `loserPendingIntent: 'submit_pending'`  
**And** the comment editor footer shows `Post failed`  
**And** `data-testid="comment-draft-retry-sync"` button label is `Retry Post`  
**And** `data-testid="comment-draft-discard-footer"` button is visible

---

### Scenario 23 — Retry Post button re-queues the comment POST

**Given** the state from Scenario 22 ("Post failed" UI)  
**When** User A clicks **Retry Post**  
**Then** the comment content is saved locally with `intent: submit_pending`  
**And** `POST /api/v1/cards/:cardId/comments` is enqueued with `idempotency_key`  
**And** the footer transitions to `Will post when back online`  
**And** on reconnect, the POST is replayed and the comment appears in the activity feed  
**And** the local comment draft is cleared

---

### Scenario 24 — Discard after conflict clears comment draft

**Given** the state from Scenario 22 ("Post failed" UI)  
**When** User A clicks **Discard draft**  
**Then** IndexedDB comment draft is deleted  
**And** server comment draft is deleted  
**And** the comment editor is cleared  
**And** the draft recovery banner and footer disappear

---

### Scenario 25 — submit_pending draft survives login/logout cycle

**Given** User A has a comment `submit_pending` draft saved in IndexedDB on Device 1  
**And** User A logs out and logs back in on Device 1  
**When** User A opens the same card modal  
**Then** the submit_pending draft is re-fetched from the server (if token renewed)  
**Or** the local draft is restored from IndexedDB if the server fetch fails  
**And** the footer shows `Will post when back online` (not empty)  
**And** no comment is leaked to the activity feed before explicit Post/Retry
