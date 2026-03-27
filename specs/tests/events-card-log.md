> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Events — Card Activity Log

## Overview
Verifies that the card activity log records create, move, and assignment events, and that the log is returned in reverse-chronological order via the activity API.

## Pre-conditions
- User is authenticated (JWT or `hf_` API token)
- A workspace, board, and two lists exist
- The user has at least Member role on the board

## Steps

### 1. Create a card and verify create event
1. `POST /api/v1/lists/:listId/cards` with header `Authorization: Bearer <token>` and body:
   ```json
   { "title": "Implement login" }
   ```
2. **Assert** response status is `201`; capture `cardId`
3. `GET /api/v1/cards/:cardId/activity`
4. **Assert** response status is `200`
5. **Assert** response body has shape `{ "data": [ ... ] }`
6. **Assert** the first entry has `"action": "card.created"` (or equivalent) and `"actorId"` matching the current user

### 2. Move card to another list and verify move event
1. `PATCH /api/v1/cards/:cardId` with body:
   ```json
   { "listId": "<secondListId>" }
   ```
2. **Assert** response status is `200`
3. `GET /api/v1/cards/:cardId/activity`
4. **Assert** the first entry (most recent) has `"action": "card.moved"` or `"action": "card.list_changed"`
5. **Assert** the event includes the source list ID and destination list ID in its `data` or `metadata` field

### 3. Assign a member to the card and verify assignment event
1. `POST /api/v1/cards/:cardId/members` with body:
   ```json
   { "userId": "<memberId>" }
   ```
2. **Assert** response status is `201`
3. `GET /api/v1/cards/:cardId/activity`
4. **Assert** the first entry has `"action": "card.member_added"` or `"action": "member.assigned"`
5. **Assert** the event includes the assigned `userId`

### 4. Activity log is append-only (no updates or deletions)
1. `GET /api/v1/cards/:cardId/activity`
2. **Assert** all previously recorded events are still present (create, move, assign events visible)
3. **Assert** the array length is ≥ 3

### 5. Activity entries include actor display info
1. `GET /api/v1/cards/:cardId/activity`
2. **Assert** each entry includes an `actor` object with at least `id`, `name`, and `email`
3. **Assert** the `avatar_url` field is present (may be null if no avatar set)

### 6. Events are returned newest-first
1. `GET /api/v1/cards/:cardId/activity`
2. **Assert** the `data` array is ordered by `created_at` descending (first element has the latest timestamp)

### 7. Only visible event types are returned
1. `GET /api/v1/cards/:cardId/activity`
2. **Assert** every entry's `action` is one of the allowed visible event types (e.g. `card.created`, `card.moved`, `card.member_added`, `comment.created`, etc.)
3. **Assert** internal system events (if any) are not exposed

### 8. Non-member cannot access card activity
1. Create a new user (User C) who is NOT a member of the board
2. (User C) `GET /api/v1/cards/:cardId/activity` with `Authorization: Bearer <tokenC>`
3. **Assert** response status is `403` or `404`

### 9. Unauthenticated request is rejected
1. `GET /api/v1/cards/:cardId/activity` with no `Authorization` header
2. **Assert** response status is `401`

## Expected Result
- Card create, move, and member-assign actions each produce an activity entry
- `GET /api/v1/cards/:cardId/activity` returns `{ data: [...] }` newest-first
- Each entry includes actor display info (`id`, `name`, `email`, `avatar_url`)
- Activity log is append-only; past entries are never removed
- Non-members receive `403`/`404`; unauthenticated callers receive `401`