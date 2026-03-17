# Offline Description Draft Recovery — Server Draft API Spec
## Sprint 83

### Overview

Verify that the server draft API correctly stores, retrieves, and deletes per-user card
drafts. All endpoints are scoped to the authenticated user. No user can read or modify
another user's draft. The API follows standard response shapes:
- Success: `{ data: ... }`
- Error: `{ name: 'hyphenated-error-name', data?: ... }`

---

## Scenario 1 — Unauthenticated request is rejected

**Given** no Authorization header  
**When** `GET /api/v1/cards/:cardId/drafts` is called  
**Then** the response status is `401`  
**And** the response body contains `{ error: { code: 'unauthorized' } }` or equivalent

---

## Scenario 2 — List drafts returns empty array when no drafts exist

**Given** User A is authenticated  
**And** a card exists on a board that User A is a member of  
**When** `GET /api/v1/cards/:cardId/drafts` is called  
**Then** the response status is `200`  
**And** the response body is `{ data: [] }`

---

## Scenario 3 — PUT description draft creates a new draft

**Given** User A is authenticated  
**And** a card exists on a board that User A is a member of  
**When** `PUT /api/v1/cards/:cardId/drafts/description` is called with body:
  ```json
  {
    "content_markdown": "## My draft heading",
    "intent": "editing",
    "client_updated_at": "2026-03-17T05:00:00.000Z"
  }
  ```
**Then** the response status is `200`  
**And** the response body is `{ data: { ... } }` containing:
  - `draft_type: "description"`
  - `content_markdown: "## My draft heading"`
  - `intent: "editing"`
  - `client_updated_at` matching the sent value
  - `synced_at` set to a non-null server timestamp
  - `id`, `card_id`, `created_at`, `updated_at` present

---

## Scenario 4 — PUT comment draft creates a separate draft row

**Given** User A is authenticated  
**And** a card exists on a board that User A is a member of  
**When** `PUT /api/v1/cards/:cardId/drafts/comment` is called with body:
  ```json
  {
    "content_markdown": "My comment draft",
    "intent": "editing",
    "client_updated_at": "2026-03-17T05:01:00.000Z"
  }
  ```
**Then** the response status is `200`  
**And** the response body contains `draft_type: "comment"`

---

## Scenario 5 — GET lists both description and comment drafts

**Given** User A has an existing description draft and comment draft for a card  
**When** `GET /api/v1/cards/:cardId/drafts` is called  
**Then** the response status is `200`  
**And** `data` is an array of 2 items  
**And** one item has `draft_type: "description"` and another has `draft_type: "comment"`

---

## Scenario 6 — PUT upserts (updates) an existing draft

**Given** User A already has a description draft for a card with `content_markdown: "old text"`  
**When** `PUT /api/v1/cards/:cardId/drafts/description` is called with `content_markdown: "new text"` and `intent: "save_pending"`  
**Then** the response status is `200`  
**And** `data.content_markdown` is `"new text"`  
**And** `data.intent` is `"save_pending"`  
**And** no duplicate row is created — the total count of description drafts for that card/user remains 1

---

## Scenario 7 — DELETE removes a draft

**Given** User A has a description draft for a card  
**When** `DELETE /api/v1/cards/:cardId/drafts/description` is called  
**Then** the response status is `200`  
**And** the response body is `{ data: {} }`  
**And** a subsequent `GET /api/v1/cards/:cardId/drafts` returns an empty array (or only remaining drafts)

---

## Scenario 8 — DELETE on a non-existent draft returns 404

**Given** User A has no drafts for a card  
**When** `DELETE /api/v1/cards/:cardId/drafts/description` is called  
**Then** the response status is `404`  
**And** the response body contains `{ name: 'draft-not-found' }`

---

## Scenario 9 — User B cannot see User A's drafts (no existence leak)

**Given** User A has a description draft for card C  
**And** User B is also a member of the same board  
**When** User B calls `GET /api/v1/cards/C/drafts`  
**Then** the response status is `200`  
**And** `data` is an empty array (User A's draft is not included)

---

## Scenario 10 — User B cannot delete User A's draft

**Given** User A has a description draft for card C  
**And** User B is also a member of the same board  
**When** User B calls `DELETE /api/v1/cards/C/drafts/description`  
**Then** the response status is `404`  
**And** the response body contains `{ name: 'draft-not-found' }`  
**And** User A's draft row is still present in the database

---

## Scenario 11 — Request with invalid draft type returns 400

**Given** User A is authenticated  
**And** a card exists on a board that User A is a member of  
**When** `PUT /api/v1/cards/:cardId/drafts/invalid_type` is called  
**Then** the response status is `400`  
**And** the response body contains `{ name: 'invalid-draft-type' }`

---

## Scenario 12 — Request with invalid intent returns 400

**Given** User A is authenticated  
**And** a card exists on a board that User A is a member of  
**When** `PUT /api/v1/cards/:cardId/drafts/description` is called with `intent: "unknown_intent"`  
**Then** the response status is `400`  
**And** the response body contains `{ name: 'invalid-intent' }`

---

## Scenario 13 — Request missing client_updated_at returns 400

**Given** User A is authenticated  
**And** a card exists on a board that User A is a member of  
**When** `PUT /api/v1/cards/:cardId/drafts/description` is called without a `client_updated_at` field  
**Then** the response status is `400`  
**And** the response body contains `{ name: 'missing-client-updated-at' }`

---

## Scenario 14 — Card not found returns 404

**Given** User A is authenticated  
**When** `GET /api/v1/cards/non-existent-card-id/drafts` is called  
**Then** the response status is `404`  
**And** the response body contains `{ name: 'card-not-found' }`

---

## Scenario 15 — Draft intent can be set to save_pending (offline save queued)

**Given** User A is authenticated and has an existing description draft  
**When** `PUT /api/v1/cards/:cardId/drafts/description` is called with `intent: "save_pending"`  
**Then** the response status is `200`  
**And** `data.intent` is `"save_pending"`  
**And** the draft content is preserved for replay on reconnect

---

## Scenario 16 — Draft intent can be set to submit_pending (offline comment queued)

**Given** User A is authenticated and has an existing comment draft  
**When** `PUT /api/v1/cards/:cardId/drafts/comment` is called with `intent: "submit_pending"`  
**Then** the response status is `200`  
**And** `data.intent` is `"submit_pending"`  
**And** the draft content is preserved for replay on reconnect

---

## Scenario 17 — Cross-device: second device can read draft synced from first device

**Given** User A creates a description draft from Device 1 (PUT succeeds, synced_at set)  
**When** User A opens the same card from Device 2 and calls `GET /api/v1/cards/:cardId/drafts`  
**Then** the response status is `200`  
**And** `data` contains the description draft with matching `content_markdown`  
**And** `synced_at` is non-null (confirming server-side persistence)

---

## Client Storage Scenarios

### Scenario 18 — Local draft is persisted to IndexedDB when user types

**Given** User A is authenticated and has a card open  
**When** User A types in the description editor  
**And** the debounce interval elapses  
**Then** `storage.saveDraft` is called with the correct `userId`, `workspaceId`, `cardId`, `draftType: "description"`, and current `contentMarkdown`  
**And** the draft can be retrieved via `storage.getDraft` with the same composite key  
**And** the `updatedAt` field equals the timestamp supplied at save time

---

### Scenario 19 — saveDraft is idempotent: second save overwrites first

**Given** a draft with `contentMarkdown: "draft v1"` is already stored in IndexedDB  
**When** `storage.saveDraft` is called with `contentMarkdown: "draft v2"` for the same key  
**Then** `storage.getDraft` returns `contentMarkdown: "draft v2"`  
**And** only one record exists in IndexedDB for that composite key (no duplicates)

---

### Scenario 20 — getDraftsByCard returns all draft types for a card

**Given** User A has both a description draft and a comment draft stored locally for a card  
**When** `storage.getDraftsByCard({ userId, cardId })` is called  
**Then** the result is an array of 2 items  
**And** one item has `draftType: "description"` and the other has `draftType: "comment"`

---

### Scenario 21 — deleteDraft removes the entry from IndexedDB

**Given** User A has a description draft stored in IndexedDB for a card  
**When** `storage.deleteDraft({ userId, workspaceId, cardId, draftType: "description" })` is called  
**Then** `storage.getDraft` returns `null` for that composite key  
**And** `storage.getDraftsByCard` returns an empty array (assuming no other drafts remain)

---

### Scenario 22 — Storage degrades gracefully when IndexedDB is unavailable

**Given** IndexedDB is blocked (e.g., private browsing mode)  
**When** `storage.saveDraft` is called  
**Then** no unhandled exception is thrown  
**And** the returned `LocalDraft` object still reflects the supplied values (in-memory fallback)

---

## API Wrapper Scenarios

### Scenario 23 — listServerDrafts returns the server's draft array

**Given** the server has two drafts for the current user on a card  
**When** `api.listServerDrafts({ cardId, token })` is called  
**Then** it resolves to an array of 2 `ServerDraft` objects  
**And** each object has `id`, `card_id`, `draft_type`, `content_markdown`, `intent`, `client_updated_at`, `synced_at`

---

### Scenario 24 — upsertServerDraft sends a PUT and returns the persisted draft

**Given** User A is online with a valid `token`  
**When** `api.upsertServerDraft({ cardId, draftType: "description", payload: { content_markdown, intent, client_updated_at }, token })` is called  
**Then** a `PUT /api/v1/cards/:cardId/drafts/description` request is made with a `Bearer` token header  
**And** the response resolves to a `ServerDraft` with `synced_at` set to a non-null timestamp

---

### Scenario 25 — upsertServerDraft throws when the server returns an error

**Given** the server returns a `400` response with `{ name: "invalid-intent" }`  
**When** `api.upsertServerDraft(...)` is called  
**Then** the returned promise rejects with the error body `{ name: "invalid-intent" }`

---

### Scenario 26 — deleteServerDraft sends a DELETE and resolves on success

**Given** User A has a description draft on the server  
**When** `api.deleteServerDraft({ cardId, draftType: "description", token })` is called  
**Then** a `DELETE /api/v1/cards/:cardId/drafts/description` request is made  
**And** the promise resolves without error

---

### Scenario 27 — deleteServerDraft rejects when draft not found (404)

**Given** no draft exists on the server for the given key  
**When** `api.deleteServerDraft(...)` is called  
**Then** the promise rejects with the error body `{ name: "draft-not-found" }`

---

## Reconciliation Scenarios

### Scenario 28 — No local and no server draft: reconcile returns source=none

**Given** both `local` and `server` arguments are `null`  
**When** `reconcileDrafts(null, null)` is called  
**Then** the result is `{ contentMarkdown: null, intent: null, updatedAt: null, source: "none" }`

---

### Scenario 29 — Only a local draft: reconcile returns source=local

**Given** a `local` draft with `updatedAt: "2026-03-17T05:00:00.000Z"` and `contentMarkdown: "local text"`  
**And** `server` is `null`  
**When** `reconcileDrafts(local, null)` is called  
**Then** the result has `source: "local"` and `contentMarkdown: "local text"`

---

### Scenario 30 — Only a server draft: reconcile returns source=server

**Given** `local` is `null`  
**And** a `server` draft with `client_updated_at: "2026-03-17T05:05:00.000Z"` and `content_markdown: "server text"`  
**When** `reconcileDrafts(null, server)` is called  
**Then** the result has `source: "server"` and `contentMarkdown: "server text"`

---

### Scenario 31 — Local is newer: local wins

**Given** a `local` draft with `updatedAt: "2026-03-17T06:00:00.000Z"`  
**And** a `server` draft with `client_updated_at: "2026-03-17T05:00:00.000Z"`  
**When** `reconcileDrafts(local, server)` is called  
**Then** the result has `source: "local"`  
**And** `contentMarkdown` equals the local draft's content

---

### Scenario 32 — Server is newer: server wins

**Given** a `local` draft with `updatedAt: "2026-03-17T04:00:00.000Z"`  
**And** a `server` draft with `client_updated_at: "2026-03-17T05:00:00.000Z"`  
**When** `reconcileDrafts(local, server)` is called  
**Then** the result has `source: "server"`  
**And** `contentMarkdown` equals the server draft's content

---

### Scenario 33 — Equal timestamps: server wins (clock-skew safety)

**Given** both `local.updatedAt` and `server.client_updated_at` are `"2026-03-17T05:00:00.000Z"`  
**When** `reconcileDrafts(local, server)` is called  
**Then** the result has `source: "server"`

---

### Scenario 34 — reconcileDraftForType filters by draftType before reconciling

**Given** a list of two server drafts: one `description` and one `comment`  
**And** a `local` description draft  
**When** `reconcileDraftForType({ local, serverDrafts, draftType: "description" })` is called  
**Then** only the server's description draft is compared against the local draft  
**And** the result reflects the newer of the two description drafts  
**And** the comment draft is ignored

---

## CardDescriptionTiptap Offline Draft UI Scenarios

### Scenario 35 — Draft is restored when card modal opens and a local draft exists

**Given** User A is authenticated and has a local IndexedDB draft for card C with `contentMarkdown: "My draft text"` and `intent: "editing"`
**And** the saved description on the server is `"Old saved description"` (different from draft)
**When** User A opens card C's modal
**Then** a draft recovery banner appears reading "You have an unsaved draft"
**And** the banner contains a "Resume editing" link
**And** clicking "Resume editing" opens the editor pre-filled with `"My draft text"` (not the saved description)

---

### Scenario 36 — No banner shown when no draft exists

**Given** User A is authenticated and has no local draft for card C
**When** User A opens card C's modal
**Then** no draft recovery banner is visible
**And** clicking the description area opens the editor with the saved description content

---

### Scenario 37 — Keystroke triggers debounced local save

**Given** User A opens the description editor for card C
**When** User A types "Hello world" into the editor
**And** 800 ms elapse (local save debounce interval)
**Then** the draft status footer reads "Draft saved locally"
**And** `storage.getDraft` returns `contentMarkdown: "Hello world"` for that composite key

---

### Scenario 38 — Background server sync triggers after typing (online)

**Given** User A is online and has the description editor open
**When** User A types "Server sync test" into the editor
**And** 3000 ms elapse (server sync debounce interval)
**Then** the draft status footer transitions to "Syncing draft…" and then "Synced draft"
**And** `api.upsertServerDraft` was called with `content_markdown: "Server sync test"` and `intent: "editing"`

---

### Scenario 39 — Draft status shows "Will sync when online" when offline

**Given** User A is offline (WebSocket disconnected, navigator offline)
**And** User A has the description editor open
**When** User A types any content into the editor
**Then** the draft status footer reads "Will sync when online"
**And** no server PUT request is attempted

---

### Scenario 40 — Pressing Save while online saves and clears draft

**Given** User A is online and has the description editor open with content "My final description"
**When** User A clicks "Save"
**Then** `onSave("My final description")` is called
**And** the editor closes
**And** `storage.getDraft` returns `null` for the card's description draft
**And** the draft status footer is no longer visible

---

### Scenario 41 — Pressing Save while offline queues PATCH and shows status

**Given** User A is offline (WebSocket disconnected)
**And** User A has the description editor open with content "Offline save content"
**When** User A clicks "Save"
**Then** `onSave` is NOT called
**And** the editor remains open (editing state persists)
**And** the local draft is updated with `intent: "save_pending"` and `contentMarkdown: "Offline save content"`
**And** a PATCH mutation is enqueued in `messageQueue` with:
  - `method: "PATCH"`
  - `url: "/api/v1/cards/<cardId>"`
  - `body: { description: "Offline save content" }`
  - `meta.draftType: "description"`
**And** the draft status footer reads "Will sync when online"

---

### Scenario 42 — Queued PATCH metadata is correct

**Given** a PATCH was queued during offline save (Scenario 41)
**When** the queued mutation is inspected
**Then** `mutation.meta.cardId` matches the current card's ID
**And** `mutation.meta.userId` matches the current user's ID
**And** `mutation.meta.workspaceId` matches the current workspace ID
**And** `mutation.meta.draftType` is `"description"`

---

### Scenario 43 — Sync failed shows retry and discard options

**Given** User A is online but the server draft PUT returns a 500 error
**When** the background server sync attempt completes
**Then** the draft status footer reads "Sync failed"
**And** a "Retry" button is visible in the footer
**And** a "Discard draft" button is visible in the footer

---

### Scenario 44 — Clicking Retry reattempts the server sync

**Given** the draft status is "Sync failed" (Scenario 43)
**When** User A clicks "Retry"
**Then** `api.upsertServerDraft` is called again with the current editor content
**And** on success the draft status transitions to "Synced draft"

---

### Scenario 45 — Clicking Discard draft removes local and server draft

**Given** the draft status is "Sync failed"
**When** User A clicks "Discard draft"
**Then** `storage.deleteDraft` is called for the current card's description draft
**And** `api.deleteServerDraft` is called (best-effort)
**And** the draft status returns to "idle" (footer disappears)
**And** the draft recovery banner is no longer shown

---

### Scenario 46 — Pressing Cancel discards the draft

**Given** User A has the description editor open with a local draft
**When** User A clicks "Cancel"
**Then** the editor closes
**And** `storage.deleteDraft` is called for the current draft
**And** the editor content reverts to the last saved description
**And** the draft recovery banner is no longer visible

---

### Scenario 47 — Hard refresh: draft is restored from IndexedDB on next open

**Given** User A has typed "Draft before refresh" and the local save debounce has fired
**When** User A hard-refreshes the page (full browser reload)
**And** User A re-opens card C's modal
**Then** the draft recovery banner is visible with "You have an unsaved draft"
**And** clicking "Resume editing" populates the editor with "Draft before refresh"

---

### Scenario 48 — Reconnect: "Will sync when online" draft syncs automatically

**Given** User A was offline and typed "Reconnect sync content" (status: "Will sync when online")
**And** the description editor is still open
**When** the WebSocket reconnects (User A comes back online)
**And** User A types any additional character to trigger the debounce
**Then** after the server sync debounce elapses, `api.upsertServerDraft` is called
**And** the draft status transitions to "Synced draft"

---

### Scenario 49 — Draft recovery banner does NOT appear when local draft equals saved description

**Given** User A has a local draft with `contentMarkdown` identical to the server's saved description
**When** User A opens card C's modal
**Then** no draft recovery banner is shown
**And** the draft status is "idle"

---

### Scenario 50 — Server draft wins reconciliation on reconnect (cross-device)

**Given** User A edited the description on Device 2 and synced it to the server (newer timestamp)
**And** User A's Device 1 has a stale local draft with an older timestamp
**When** User A opens card C on Device 1 (online)
**Then** `api.listServerDrafts` is called to fetch the server snapshot
**And** `reconcileDraftForType` selects the server draft (newer timestamp)
**And** the editor is pre-filled with the Device 2 content
**And** the local IndexedDB draft is updated to match the server's version

---

### Scenario 51 — Offline save_pending draft is shown as "Will sync when online" on next open

**Given** User A pressed Save while offline, which queued a PATCH and set `intent: "save_pending"`
**When** User A closes and reopens card C (still offline)
**Then** the draft recovery banner shows "You have an unsaved draft"
**And** clicking "Resume editing" opens the editor with the save-pending content
**And** the draft status footer reads "Will sync when online"

---

### Scenario 52 — Draft status footer is not shown in view mode (only in edit mode)

**Given** User A is in view mode (not editing the description)
**When** a draft exists locally
**Then** the draft recovery banner is shown in view mode (above the description)
**But** the draft status footer (syncing/synced indicators) is only shown while the editor is active

---

### Scenario 53 — No draft logic runs when cardId is undefined (new card form)

**Given** the description editor is rendered without a `cardId` prop (e.g. during card creation)
**When** User A types in the editor
**Then** `storage.saveDraft` is NOT called
**And** no draft recovery banner is shown
**And** the draft status footer remains hidden

