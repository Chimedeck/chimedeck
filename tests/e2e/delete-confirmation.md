# delete-confirmation.md

## Overview

These tests verify the Sprint 56 delete confirmation flag feature:
- DELETE `/api/v1/boards/:id` without `confirm:true` returns **409** when the board contains lists or cards.
- DELETE `/api/v1/lists/:id` without `confirm:true` returns **409** when the list contains cards.
- With `confirm:true` in the request body, deletion proceeds and returns **204**.
- Empty boards and empty lists are deleted immediately without requiring confirmation.
- The client-side UI shows a confirmation dialog when the server returns 409 and sends `confirm:true` on the second attempt.

---

## Prerequisites

- A workspace and at least one board exist.
- User is authenticated as an ADMIN of the workspace.

---

## Test 1 — Board DELETE without confirm returns 409 when board has lists

### Steps

1. Use Playwright MCP to send `POST /api/v1/workspaces/:workspaceId/boards` with body `{ "title": "Delete Test Board" }` to create a board. Store the returned `data.id` as `boardId`.
2. Send `POST /api/v1/boards/:boardId/lists` with body `{ "title": "Test List" }` to create a list inside the board. Store `data.id` as `listId`.
3. Send `DELETE /api/v1/boards/:boardId` with **no body**.
4. Assert the response status is **409**.
5. Assert the response body matches `{ "name": "delete-requires-confirmation", "data": { "listCount": 1, "cardCount": 0 } }`.

---

## Test 2 — Board DELETE with confirm:true succeeds when board has lists

### Steps

1. (Continue from Test 1, reusing `boardId`.)
2. Send `DELETE /api/v1/boards/:boardId` with body `{ "confirm": true }`.
3. Assert the response status is **204**.
4. Send `GET /api/v1/boards/:boardId` and assert the response status is **404** (board is gone).

---

## Test 3 — Empty board DELETE proceeds without confirmation

### Steps

1. Send `POST /api/v1/workspaces/:workspaceId/boards` with body `{ "title": "Empty Board" }`. Store `data.id` as `emptyBoardId`.
2. Send `DELETE /api/v1/boards/:emptyBoardId` with **no body**.
3. Assert the response status is **204** (no confirmation required for empty boards).

---

## Test 4 — List DELETE without confirm returns 409 when list has cards

### Steps

1. Create a new board: `POST /api/v1/workspaces/:workspaceId/boards` → store `boardId2`.
2. Create a list: `POST /api/v1/boards/:boardId2/lists` with `{ "title": "List With Cards" }` → store `listId2`.
3. Create a card: `POST /api/v1/cards` (or the appropriate card creation endpoint) with `{ "listId": listId2, "title": "Card A" }` → store `cardId`.
4. Send `DELETE /api/v1/lists/:listId2` with **no body**.
5. Assert the response status is **409**.
6. Assert the response body matches `{ "name": "delete-requires-confirmation", "data": { "cardCount": 1 } }`.

---

## Test 5 — List DELETE with confirm:true succeeds when list has cards

### Steps

1. (Continue from Test 4, reusing `listId2`.)
2. Send `DELETE /api/v1/lists/:listId2` with body `{ "confirm": true }`.
3. Assert the response status is **204**.
4. Send `GET /api/v1/boards/:boardId2/lists` and assert the response body `data` array does not contain a list with `id === listId2`.

---

## Test 6 — Empty list DELETE proceeds without confirmation

### Steps

1. Create a board and a list with no cards.
2. Send `DELETE /api/v1/lists/:emptyListId` with **no body**.
3. Assert the response status is **204**.

---

## Test 7 — Client UI shows confirmation dialog for board with nested content

### Steps

1. Navigate to a board that contains at least one list.
2. Open board settings or the board action menu.
3. Click "Delete board".
4. Assert that a **modal dialog** appears (not a browser `confirm()` popup) containing:
   - The board title.
   - The number of lists and cards.
   - A warning message about permanent deletion.
   - A "Delete board" button and a "Cancel" button.
5. Click "Cancel" and assert the dialog closes and the board still exists.

---

## Test 8 — Client UI sends confirm:true and deletes board

### Steps

1. Navigate to a board that contains at least one list.
2. Open the board delete action.
3. The confirmation dialog appears (as in Test 7).
4. Click "Delete board".
5. Assert the user is redirected to `/workspaces` (or the workspace list page).
6. Assert the board no longer appears in the board list.

---

## Test 9 — Client UI shows confirmation dialog for list with cards

### Steps

1. Navigate to a board that contains a list with at least one card.
2. Open the list's action menu (e.g. the "…" button on the list header).
3. Click "Delete list".
4. Assert that a **modal dialog** appears containing:
   - The list title.
   - The number of cards.
   - A warning about permanent deletion.
   - "Delete list" and "Cancel" buttons.
5. Click "Cancel" and assert the dialog closes and the list still exists on the board.

---

## Test 10 — Client UI sends confirm:true and deletes list

### Steps

1. Navigate to a board with a list containing at least one card.
2. Trigger the list delete action.
3. When the confirmation dialog appears, click "Delete list".
4. Assert the dialog closes.
5. Assert the list (and its cards) no longer appear on the board canvas.
