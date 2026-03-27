> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Presence — Board Active Users

## Overview
Verifies that the board presence endpoint returns the set of users currently active on a board, and that presence entries appear and expire correctly as users join and leave.

## Pre-conditions
- Two user accounts exist (User A and User B), both members of the same workspace and board
- Both users have active sessions (JWT or `hf_` API token)
- The server has a Redis/cache layer for presence tracking

## Steps

### 1. No active users initially
1. (User A) `GET /api/v1/boards/:boardId/presence` with header `Authorization: Bearer <tokenA>`
2. **Assert** response status is `200`
3. **Assert** response body is `{ "data": [] }` (no active users yet)

### 2. User A subscribes to realtime (heartbeat)
1. (User A) `POST /api/v1/boards/:boardId/realtime/subscribe` or connect via WebSocket to the board room
2. The server registers User A's presence in the cache with a TTL (e.g. 30 seconds)
3. **Assert** no error is returned from the subscription call

### 3. User A appears in presence
1. (User B) `GET /api/v1/boards/:boardId/presence` with header `Authorization: Bearer <tokenB>`
2. **Assert** response status is `200`
3. **Assert** response body has shape:
   ```json
   { "data": [{ "id": "<userAId>", "name": "<name>", "email": "<email>", "avatar_url": "<url|null>" }] }
   ```
4. **Assert** the array contains exactly one entry whose `id` matches User A

### 4. User B subscribes and appears alongside User A
1. (User B) Subscribe to the board realtime room
2. (User A) `GET /api/v1/boards/:boardId/presence`
3. **Assert** the `data` array now contains both User A and User B

### 5. Presence entry expires after TTL (cache eviction)
1. Without renewing the subscription, wait for the presence TTL to elapse (or simulate cache key deletion)
2. `GET /api/v1/boards/:boardId/presence`
3. **Assert** the expired user is no longer in the `data` array

### 6. User explicitly unsubscribes
1. (User A) `POST /api/v1/boards/:boardId/realtime/unsubscribe` or close the WebSocket connection
2. Wait for the server to remove the presence key
3. (User B) `GET /api/v1/boards/:boardId/presence`
4. **Assert** User A is no longer in the `data` array

### 7. Non-member cannot read presence
1. Create a new user (User C) who is NOT a member of the board
2. (User C) `GET /api/v1/boards/:boardId/presence` with `Authorization: Bearer <tokenC>`
3. **Assert** response status is `403` or `404`

### 8. Unauthenticated request is rejected
1. `GET /api/v1/boards/:boardId/presence` with no `Authorization` header
2. **Assert** response status is `401`

## Expected Result
- `GET /api/v1/boards/:boardId/presence` returns an array of active user objects
- Each entry includes `id`, `name`, `email`, and `avatar_url`
- Presence entries are added when a user subscribes and removed on unsubscribe or TTL expiry
- Non-members receive `403`/`404`; unauthenticated callers receive `401`