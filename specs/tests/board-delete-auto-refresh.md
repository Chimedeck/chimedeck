# Board Delete Auto-Refresh — Playwright MCP Test Scenarios

> **Sprint:** 87
> **Feature:** Board deletion with automatic UI refresh and real-time propagation
> **Status:** In progress — server-side event emission complete; client-side scenarios pending (Iterations 2–4)

---

## Overview

These scenarios validate the full board-deletion lifecycle:
1. Server API success and failure paths (Iteration 1 — implemented)
2. Client-side optimistic removal and rollback (Iteration 2)
3. Current-board deletion redirect (Iteration 3)
4. Workspace-level real-time propagation to other connected users (Iteration 4)

---

## Acceptance Checklist

- [x] DELETE /api/v1/boards/:id returns 204 on success (no body)
- [x] DELETE requires authentication — 401 when unauthenticated
- [x] DELETE requires ADMIN role — 403 for MEMBER or VIEWER
- [x] DELETE requires workspace membership — 403 for non-members
- [x] DELETE returns 409 with listCount/cardCount when board is non-empty and confirm is absent
- [x] DELETE with `confirm: true` removes a non-empty board
- [x] `board_deleted` event is persisted in the events table after successful deletion
- [x] `board_deleted` event payload includes `boardId` and `workspaceId`
- [x] Event is published to `workspace:{workspaceId}` pubsub channel
- [x] Event is fanned out to each workspace member's personal WS channel (`publishToUser`)
- [x] Deleted board is removed from workspace board list immediately (Iteration 2)
- [x] Optimistic removal is rolled back if API call fails (Iteration 2)
- [x] Viewing a board that is deleted redirects to workspace boards page (Iteration 3)
- [x] Success toast "Board deleted" appears after successful delete (Iteration 3)
- [ ] Other connected users see board removed in real-time (Iteration 4)

---

## BDAR-API-01 — Successful deletion of empty board

**Preconditions:**
- Authenticated user with ADMIN role in workspace W1
- Board B1 exists in workspace W1 with no lists and no cards

**Steps:**
1. Send `DELETE /api/v1/boards/{B1.id}` with valid auth token

**Expected:**
- Response status: `204 No Content`
- No response body
- Board B1 is absent from `GET /api/v1/workspaces/{W1.id}/boards`
- Row in `events` table: `type = 'board_deleted'`, `entity_id = B1.id`, `payload.workspaceId = W1.id`

---

## BDAR-API-02 — Deletion blocked without confirm for non-empty board

**Preconditions:**
- Authenticated user with ADMIN role in workspace W1
- Board B2 exists in workspace W1 with 2 lists and 5 cards

**Steps:**
1. Send `DELETE /api/v1/boards/{B2.id}` with valid auth token and no body

**Expected:**
- Response status: `409 Conflict`
- Response body: `{ "name": "delete-requires-confirmation", "data": { "listCount": 2, "cardCount": 5 } }`
- Board B2 still exists

---

## BDAR-API-03 — Successful deletion of non-empty board with confirm

**Preconditions:**
- Authenticated user with ADMIN role in workspace W1
- Board B2 exists in workspace W1 with 2 lists and 5 cards

**Steps:**
1. Send `DELETE /api/v1/boards/{B2.id}` with body `{ "confirm": true }`

**Expected:**
- Response status: `204 No Content`
- Board B2 is absent from workspace board list
- `board_deleted` event persisted in events table with correct payload

---

## BDAR-API-04 — Unauthenticated deletion attempt

**Preconditions:**
- Board B1 exists

**Steps:**
1. Send `DELETE /api/v1/boards/{B1.id}` with no Authorization header

**Expected:**
- Response status: `401 Unauthorized`
- No event emitted
- Board B1 still exists

---

## BDAR-API-05 — Deletion by non-admin member

**Preconditions:**
- Authenticated user U2 with MEMBER role in workspace W1
- Board B1 exists in workspace W1

**Steps:**
1. Send `DELETE /api/v1/boards/{B1.id}` with U2's auth token

**Expected:**
- Response status: `403 Forbidden`
- No event emitted
- Board B1 still exists

---

## BDAR-API-06 — Deletion attempt by user outside workspace

**Preconditions:**
- Authenticated user U3 with no membership in workspace W1
- Board B1 exists in workspace W1

**Steps:**
1. Send `DELETE /api/v1/boards/{B1.id}` with U3's auth token

**Expected:**
- Response status: `403 Forbidden`
- No event emitted
- Board B1 still exists

---

## BDAR-API-07 — Deletion of non-existent board

**Preconditions:**
- Authenticated user with ADMIN role in any workspace

**Steps:**
1. Send `DELETE /api/v1/boards/non-existent-board-id` with valid auth token

**Expected:**
- Response status: `404 Not Found`
- Response body contains error code `board-not-found`

---

## BDAR-EVENT-01 — board_deleted event payload correctness

**Preconditions:**
- Authenticated user U1 (ADMIN) in workspace W1
- Board B1 exists in workspace W1

**Steps:**
1. Send `DELETE /api/v1/boards/{B1.id}` with valid auth token
2. Query events table: `SELECT * FROM events WHERE type = 'board_deleted' AND entity_id = '{B1.id}'`

**Expected:**
- Exactly one row returned
- `event.type = 'board_deleted'`
- `event.entity_id = B1.id`
- `event.actor_id = U1.id`
- `event.board_id IS NULL` (board no longer exists)
- `event.payload.boardId = B1.id`
- `event.payload.workspaceId = W1.id`
- `event.created_at` is within 2 seconds of the request timestamp

---

## BDAR-EVENT-02 — No duplicate event on successful delete

**Preconditions:**
- Authenticated user U1 (ADMIN) in workspace W1
- Board B1 exists in workspace W1

**Steps:**
1. Send `DELETE /api/v1/boards/{B1.id}` — succeeds with 204
2. Query events table for `type = 'board_deleted' AND entity_id = B1.id`

**Expected:**
- Exactly one event row — no duplicates

---

## BDAR-EVENT-03 — No event emitted when deletion is unauthorized

**Preconditions:**
- Authenticated user U2 with VIEWER role in workspace W1
- Board B1 exists in workspace W1
- Current event count for B1: N

**Steps:**
1. Send `DELETE /api/v1/boards/{B1.id}` with U2's auth token → expect 403
2. Count events for B1

**Expected:**
- Event count remains N (no board_deleted event persisted)

---

## BDAR-WS-01 — Workspace member receives board_deleted via personal WS channel

> **Note:** Requires Iteration 4 client-side subscription wiring to be testable end-to-end.

**Preconditions:**
- Workspace W1 has two members: U1 (ADMIN) and U2 (MEMBER)
- Both users have open WebSocket connections to the server
- Board B1 exists in workspace W1

**Steps:**
1. U1 sends `DELETE /api/v1/boards/{B1.id}`
2. Observe WebSocket messages received by U2

**Expected:**
- U2 receives a WS message: `{ "type": "board_deleted", "entity_id": B1.id, "payload": { "boardId": B1.id, "workspaceId": W1.id } }`
- Message includes `version`, `sequence`, `timestamp`, and `emittedAt` fields
- U2 does NOT need to reload the page to see B1 removed

---

## BDAR-UI-01 — Board removed from workspace boards page immediately (Iteration 2)

**Preconditions:**
- Authenticated user U1 (ADMIN) in workspace W1
- Board B1 exists in workspace W1 and appears in the workspace boards list
- User is on the workspace boards page (`/workspaces/{W1.id}/boards`)

**Steps:**
1. Locate the board tile for B1
2. Open the board action menu and click "Delete"
3. Confirm the deletion in the browser confirmation dialog
4. Observe the board list **before** the API response returns

**Expected:**
- Board tile for B1 disappears from the list **immediately** (before any network round-trip completes)
- Other board tiles remain visible and unchanged
- The boards list does not flash or re-render with B1 after the API response succeeds
- After API responds 204: B1 remains absent from the list permanently

---

## BDAR-UI-02 — Optimistic removal rolls back on API error (Iteration 2)

**Preconditions:**
- Authenticated user U1 (ADMIN) in workspace W1
- Board B1 exists in workspace W1 and is visible in the boards list
- Server is configured to return 500 (or 403) when DELETE `/api/v1/boards/{B1.id}` is called (simulate via network intercept or test flag)

**Steps:**
1. Locate the board tile for B1
2. Open the board action menu and click "Delete"
3. Confirm the deletion dialog
4. Wait for the API call to fail

**Expected:**
- Board tile for B1 disappears immediately (optimistic remove)
- After the API error is received: board tile for B1 **reappears** in the list at its original position
- No "ghost" board entry is present (no duplicate of B1)
- The rest of the board list is unchanged and in the correct order
- `deleteInProgress` flag is cleared in Redux state after rollback

---

## BDAR-UI-03 — Redirect when currently open board is deleted

**Preconditions:**
- Authenticated user U1 (ADMIN) in workspace W1
- Board B1 exists in workspace W1 with no lists and no cards
- User is viewing the board detail page: `/boards/{B1.id}`
- No panels (settings, members, automation) are open

**Steps:**
1. Click the board settings/action menu on the board header
2. Click "Delete board"
3. Observe the page response

**Expected:**
- The browser URL changes to `/workspace/{W1.id}/boards`
- The workspace boards page is rendered with the full boards list
- Board B1 is absent from the boards list
- No full-page reload occurs (SPA navigation)

---

## BDAR-UI-03b — Redirect when confirming deletion of non-empty board from board page

**Preconditions:**
- Authenticated user U1 (ADMIN) in workspace W1
- Board B2 exists in workspace W1 with 2 lists and 5 cards
- User is viewing the board detail page: `/boards/{B2.id}`

**Steps:**
1. Click the board settings/action menu
2. Click "Delete board"
3. Server returns 409 → confirmation dialog appears showing "2 lists, 5 cards"
4. Click "Confirm delete" in the dialog

**Expected:**
- The confirmation dialog closes
- The browser URL changes to `/workspace/{W1.id}/boards`
- Board B2 is absent from the boards list
- A success toast "Board deleted" is visible on the workspace boards page
- No full-page reload occurs

---

## BDAR-UI-03c — Open panels are closed before redirect

**Preconditions:**
- Authenticated user U1 (ADMIN) in workspace W1
- Board B1 exists with no lists or cards
- User is viewing `/boards/{B1.id}` with the board settings panel **open**

**Steps:**
1. With settings panel open, trigger board deletion via the header delete action
2. Confirm deletion

**Expected:**
- The settings panel closes before the navigation occurs
- No panel overlay is visible after landing on the workspace boards page
- URL is `/workspace/{W1.id}/boards`

---

## BDAR-UI-04 — Toast "Board deleted" on successful delete

**Preconditions:**
- Authenticated user U1 (ADMIN) in workspace W1
- Board B1 exists in workspace W1
- User is on the board detail page `/boards/{B1.id}`

**Steps:**
1. Delete board B1 (either empty path or confirm path)
2. Wait for navigation to complete
3. Observe the workspace boards page (`/workspace/{W1.id}/boards`)

**Expected:**
- A toast notification is visible at the bottom-right of the screen
- Toast message reads exactly: "Board deleted"
- Toast has informational (non-error) styling (e.g. no red border)
- Toast auto-dismisses after ~4 seconds without user interaction
- Toast does not re-appear if the user navigates back to the boards page

---

## BDAR-UI-04b — No toast or double-redirect when already on workspace boards page

**Preconditions:**
- Authenticated user U1 (ADMIN) in workspace W1
- Board B1 appears in the workspace boards list at `/workspace/{W1.id}/boards`
- Deletion is triggered from the **board card tile** (not from the board detail page)

**Steps:**
1. On the workspace boards page, open the board action menu on B1's tile
2. Click "Delete" and confirm the browser dialog

**Expected:**
- Board B1 tile disappears immediately (optimistic removal — see BDAR-UI-01)
- **No** "Board deleted" toast is shown (the toast is only triggered from the board detail page redirect flow)
- URL remains `/workspace/{W1.id}/boards` — no redirect occurs

---

## BDAR-RT-01 — Other connected users see board removed in real-time (Iteration 4)

> **Deferred to Iteration 4.**
