# Test: List CRUD

## Overview
Verifies that lists (Kanban columns) can be created, renamed, reordered, archived, and deleted within a board, and that all changes are persisted correctly.

## Pre-conditions
- User is authenticated (JWT or `hf_` API token)
- A workspace and board exist
- The user has at least Member role on the board

## Steps

### 1. Create a list
1. `POST /api/v1/boards/:boardId/lists` with header `Authorization: Bearer <token>` and body:
   ```json
   { "name": "Backlog" }
   ```
2. **Assert** response status is `201`
3. **Assert** response body has shape:
   ```json
   { "data": { "id": "<uuid>", "name": "Backlog", "position": "<fractional-index>", "archived": false } }
   ```
4. Capture `listId`

### 2. Retrieve all lists on the board
1. `GET /api/v1/boards/:boardId/lists` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200`
3. **Assert** response body has shape `{ "data": [ ... ] }` and the array contains the newly created list
4. **Assert** the list entry has `"archived": false`

### 3. Rename a list
1. `PATCH /api/v1/lists/:listId` with body:
   ```json
   { "name": "To Do" }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has `{ "data": { "id": "<listId>", "name": "To Do" } }`

### 4. Create a second list and reorder
1. `POST /api/v1/boards/:boardId/lists` with body `{ "name": "In Progress" }` — capture second `listId2`
2. `POST /api/v1/boards/:boardId/lists/reorder` with body:
   ```json
   { "orderedIds": ["<listId2>", "<listId>"] }
   ```
3. **Assert** response status is `200`
4. `GET /api/v1/boards/:boardId/lists`
5. **Assert** the first list in the returned array is `listId2`

### 5. Archive a list
1. `PATCH /api/v1/lists/:listId/archive` with no body
2. **Assert** response status is `200`
3. **Assert** response body has `{ "data": { "id": "<listId>", "archived": true } }`

### 6. Archived list is excluded from active board lists
1. `GET /api/v1/boards/:boardId/lists`
2. **Assert** the archived list is not present in the response array (or `archived: true` entries are excluded)

### 7. Delete a list (empty list, no confirmation required)
1. Create a new empty list via `POST /api/v1/boards/:boardId/lists` — capture `emptyListId`
2. `DELETE /api/v1/lists/:emptyListId`
3. **Assert** response status is `200`
4. `GET /api/v1/boards/:boardId/lists`
5. **Assert** deleted list is no longer present

### 8. Reject delete of list containing cards (requires confirmation)
1. Create a list and add a card to it
2. `DELETE /api/v1/lists/:listId` without a confirmation flag
3. **Assert** response status is `409` or `400`
4. **Assert** response body has `{ "name": "list-not-empty" }` or equivalent error name

### 9. Reject missing name on create
1. `POST /api/v1/boards/:boardId/lists` with body `{}`
2. **Assert** response status is `400`
3. **Assert** response body has `{ "name": "bad-request" }`

### 10. Reject unauthenticated request
1. `POST /api/v1/boards/:boardId/lists` with no `Authorization` header
2. **Assert** response status is `401`

## Expected Result
- Lists can be created, renamed, reordered, archived, and deleted
- Reorder persists fractional-index order
- Lists with cards require explicit confirmation before deletion
- Archived lists are excluded from the active board view
- Invalid or unauthenticated requests return appropriate error responses
