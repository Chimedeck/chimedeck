> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Card Short URL

## Overview
Verifies that each card has a stable short URL that resolves to the card detail page, that the short URL is returned in API responses, and that accessing an invalid or deleted card's short URL returns an appropriate error.

## Pre-conditions
- User is authenticated (JWT or `hf_` API token)
- A workspace, board, list, and card exist
- The user is a member of the board
- Known `cardId`

## Steps

### 1. Get card and confirm short URL is present
1. `GET /api/v1/cards/:cardId` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200`
3. **Assert** response body has `{ "data": { "id": "<cardId>", "shortUrl": "<string>" } }`
4. **Assert** `shortUrl` matches the pattern `^https?://.+/c/[A-Za-z0-9]+$` or similar compact URL format
5. Capture `shortUrl`

### 2. Resolve short URL via API
1. Extract the short code from `shortUrl` (e.g. `"abc123"` from `https://host/c/abc123`)
2. `GET /api/v1/cards/short/:shortCode` with header `Authorization: Bearer <token>`
3. **Assert** response status is `200`
4. **Assert** response body has `{ "data": { "id": "<cardId>" } }` matching the original card

### 3. Short URL is stable across updates
1. `PATCH /api/v1/cards/:cardId` with header `Authorization: Bearer <token>` and body:
   ```json
   { "title": "Updated card title" }
   ```
2. **Assert** response status is `200`
3. `GET /api/v1/cards/:cardId` with header `Authorization: Bearer <token>`
4. **Assert** `data.shortUrl` is identical to the `shortUrl` captured in step 1
5. **Assert** `GET /api/v1/cards/short/:shortCode` still resolves to the same card

### 4. Short URL in card list response
1. `GET /api/v1/lists/:listId/cards` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200`
3. **Assert** the card entry matching `cardId` has `shortUrl` present and non-empty

### 5. Reject resolution of unknown short code
1. `GET /api/v1/cards/short/DOESNOTEXIST` with header `Authorization: Bearer <token>`
2. **Assert** response status is `404`
3. **Assert** response body has `{ "name": "card-not-found" }`

### 6. Reject resolution of short code for archived card
1. Archive the card: `PATCH /api/v1/cards/:cardId` with body `{ "archived": true }`
2. **Assert** response status is `200`
3. `GET /api/v1/cards/short/:shortCode` with header `Authorization: Bearer <token>`
4. **Assert** response status is `404` or `410`
5. **Assert** response body has `{ "name": "card-not-found" }` or `{ "name": "card-archived" }`

### 7. Reject unauthenticated short URL resolution
1. `GET /api/v1/cards/short/:shortCode` with no `Authorization` header
2. **Assert** response status is `401`

## Expected Result
- Every card has a `shortUrl` field returned in GET responses
- Short URL resolves to the correct card via the short-code endpoint
- Short URL remains stable when the card title is updated
- Archived or deleted card short codes return `404` or `410`
- Unknown short codes return `404 card-not-found`
- Unauthenticated requests return `401`