# Test: Board Star and Follow

## Overview
Verifies that a user can star a board (pinning it to their personal starred list), unstar it, follow a board to receive notifications, and unfollow it. Also validates that starred and followed boards appear in the correct filtered lists.

## Pre-conditions
- User is authenticated (JWT or `hf_` API token)
- At least one board exists and the user is a member of that board
- Known `boardId`

## Steps

### 1. Star a board
1. `POST /api/v1/boards/:boardId/star` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200` or `201`
3. **Assert** response body has shape `{ "data": { "boardId": "<boardId>", "starred": true } }`

### 2. List starred boards
1. `GET /api/v1/boards?starred=true` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200`
3. **Assert** response body has shape `{ "data": [ ... ] }` and includes an entry with `id: "<boardId>"`

### 3. Reject duplicate star
1. `POST /api/v1/boards/:boardId/star` with header `Authorization: Bearer <token>`
2. **Assert** response status is `409` OR the endpoint is idempotent and returns `200` with `starred: true`
   - If `409`: **Assert** response body has `{ "name": "board-already-starred" }`

### 4. Unstar a board
1. `DELETE /api/v1/boards/:boardId/star` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200` or `204`

### 5. Confirm board no longer in starred list
1. `GET /api/v1/boards?starred=true` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200`
3. **Assert** the `data` array does not contain an entry with `id: "<boardId>"`

### 6. Follow a board
1. `POST /api/v1/boards/:boardId/follow` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200` or `201`
3. **Assert** response body has shape `{ "data": { "boardId": "<boardId>", "following": true } }`

### 7. List followed boards
1. `GET /api/v1/boards?following=true` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200`
3. **Assert** response body includes an entry with `id: "<boardId>"`

### 8. Unfollow a board
1. `DELETE /api/v1/boards/:boardId/follow` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200` or `204`

### 9. Confirm board no longer in followed list
1. `GET /api/v1/boards?following=true` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200`
3. **Assert** the `data` array does not contain an entry with `id: "<boardId>"`

### 10. Reject starring a board the user is not a member of
1. Using a second token for a user who is not a member of the board: `POST /api/v1/boards/:boardId/star`
2. **Assert** response status is `403`
3. **Assert** response body has `{ "name": "board-access-denied" }` or `{ "name": "insufficient-permissions" }`

### 11. Reject unauthenticated star
1. `POST /api/v1/boards/:boardId/star` with no `Authorization` header
2. **Assert** response status is `401`

## Expected Result
- Starring a board adds it to the user's starred list; unstarring removes it
- Following a board adds it to the followed list; unfollowing removes it
- Non-members cannot star or follow boards (`403`)
- Unauthenticated requests return `401`
