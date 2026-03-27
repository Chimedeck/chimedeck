> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Card Start Date

## Overview
Verifies that a start date can be set on a card, that it is returned in GET responses, that the start date cannot be set to a date after the due date, and that it can be cleared.

## Pre-conditions
- User is authenticated (JWT or `hf_` API token)
- A workspace, board, list, and card exist
- The user has write access to the board
- Known `cardId`

## Steps

### 1. Set a start date on a card (no due date)
1. `PATCH /api/v1/cards/:cardId` with header `Authorization: Bearer <token>` and body:
   ```json
   { "start_date": "2025-06-01T00:00:00.000Z" }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has shape `{ "data": { "id": "<cardId>", "start_date": "2025-06-01T00:00:00.000Z" } }`

### 2. Get card and confirm start date persisted
1. `GET /api/v1/cards/:cardId` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200`
3. **Assert** response body has `{ "data": { "start_date": "2025-06-01T00:00:00.000Z" } }`

### 3. Set start date and due date together (valid range)
1. `PATCH /api/v1/cards/:cardId` with header `Authorization: Bearer <token>` and body:
   ```json
   { "start_date": "2025-06-01T00:00:00.000Z", "due_date": "2025-06-30T23:59:59.000Z" }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has both `start_date: "2025-06-01T00:00:00.000Z"` and `due_date: "2025-06-30T23:59:59.000Z"`

### 4. Reject start date after due date
1. `PATCH /api/v1/cards/:cardId` with header `Authorization: Bearer <token>` and body:
   ```json
   { "start_date": "2025-07-01T00:00:00.000Z", "due_date": "2025-06-01T00:00:00.000Z" }
   ```
2. **Assert** response status is `400`
3. **Assert** response body has `{ "name": "start-date-after-due-date" }`

### 5. Reject start date equal to due date
1. `PATCH /api/v1/cards/:cardId` with header `Authorization: Bearer <token>` and body:
   ```json
   { "start_date": "2025-06-15T12:00:00.000Z", "due_date": "2025-06-15T12:00:00.000Z" }
   ```
2. **Assert** response status is `400` (start must be strictly before due) OR `200` if equal dates are allowed
   - If `400`: **Assert** response body has `{ "name": "start-date-after-due-date" }` or `{ "name": "invalid-date-range" }`

### 6. Clear start date by setting null
1. `PATCH /api/v1/cards/:cardId` with header `Authorization: Bearer <token>` and body:
   ```json
   { "start_date": null }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has `{ "data": { "start_date": null } }`

### 7. Get card and confirm start date cleared
1. `GET /api/v1/cards/:cardId` with header `Authorization: Bearer <token>`
2. **Assert** response status is `200`
3. **Assert** `data.start_date` is `null` or absent

### 8. Reject invalid date format
1. `PATCH /api/v1/cards/:cardId` with header `Authorization: Bearer <token>` and body:
   ```json
   { "start_date": "not-a-date" }
   ```
2. **Assert** response status is `400`
3. **Assert** response body has `{ "name": "invalid-date-format" }` or `{ "name": "validation-error" }`

### 9. Reject unauthenticated update
1. `PATCH /api/v1/cards/:cardId` with no `Authorization` header and body:
   ```json
   { "start_date": "2025-06-01T00:00:00.000Z" }
   ```
2. **Assert** response status is `401`

## Expected Result
- Start dates are persisted and returned in GET responses
- Start date cannot be after or equal to due date (business rule enforced)
- Start date can be cleared by setting `null`
- Invalid date formats return `400`
- Unauthenticated requests return `401`