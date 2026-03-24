# Test: Label CRUD

## Overview
Verifies that labels can be created, listed, updated, and deleted at the workspace level, and that labels can be assigned to and removed from cards.

## Pre-conditions
- User is authenticated (JWT or `hf_` API token)
- A workspace, board, list, and card exist
- The user has at least Member role in the workspace

## Steps

### 1. Create a label in a workspace
1. `POST /api/v1/workspaces/:workspaceId/labels` with header `Authorization: Bearer <token>` and body:
   ```json
   { "name": "Bug", "color": "#ef4444" }
   ```
2. **Assert** response status is `201`
3. **Assert** response body has shape:
   ```json
   { "data": { "id": "<uuid>", "name": "Bug", "color": "#ef4444", "workspaceId": "<workspaceId>" } }
   ```
4. Capture `labelId`

### 2. List labels in a workspace
1. `GET /api/v1/workspaces/:workspaceId/labels` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200`
3. **Assert** response body has shape `{ "data": [ ... ] }` and contains the created label

### 3. Update a label
1. `PATCH /api/v1/labels/:labelId` with body:
   ```json
   { "name": "Critical Bug", "color": "#b91c1c" }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has `{ "data": { "id": "<labelId>", "name": "Critical Bug", "color": "#b91c1c" } }`

### 4. Assign label to a card
1. `POST /api/v1/cards/:cardId/labels` with body:
   ```json
   { "labelId": "<labelId>" }
   ```
2. **Assert** response status is `201`
3. **Assert** response body has `{ "data": { "cardId": "<cardId>", "labelId": "<labelId>" } }`

### 5. Get card and verify label is present
1. `GET /api/v1/cards/:cardId`
2. **Assert** response status is `200`
3. **Assert** the card's `labels` array includes an entry with `id` equal to `<labelId>`

### 6. Remove label from a card
1. `DELETE /api/v1/cards/:cardId/labels/:labelId`
2. **Assert** response status is `200`
3. `GET /api/v1/cards/:cardId`
4. **Assert** the card's `labels` array no longer contains `<labelId>`

### 7. Delete a label from the workspace
1. `DELETE /api/v1/labels/:labelId`
2. **Assert** response status is `200`
3. `GET /api/v1/workspaces/:workspaceId/labels`
4. **Assert** the deleted label is not present in the response

### 8. Reject duplicate label name in same workspace
1. `POST /api/v1/workspaces/:workspaceId/labels` with body `{ "name": "Critical Bug", "color": "#000000" }` (same name as updated label)
2. **Assert** response status is `409`
3. **Assert** response body has `{ "name": "label-name-conflict" }` or equivalent

### 9. Reject missing name on create
1. `POST /api/v1/workspaces/:workspaceId/labels` with body `{ "color": "#3b82f6" }`
2. **Assert** response status is `400`
3. **Assert** response body has `{ "name": "bad-request" }`

### 10. Reject unauthenticated request
1. `GET /api/v1/workspaces/:workspaceId/labels` with no `Authorization` header
2. **Assert** response status is `401`

## Expected Result
- Labels can be created, listed, updated, and deleted at the workspace level
- Labels can be assigned to and removed from cards
- Deleting a workspace label does not crash cards that previously had it assigned
- Invalid requests return `400 bad-request`; name conflicts return `409`
- Unauthenticated requests return `401`
