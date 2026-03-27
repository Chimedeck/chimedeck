> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Payment — Card Price

## Overview
Verifies that a monetary value (amount, currency, label) can be set, partially updated, and cleared on a card, and that the board-level monetisation flag controls visibility of money fields.

## Pre-conditions
- User is authenticated via `hf_` API token (or JWT)
- A workspace, board, list, and card exist
- The user has at least Member role on the board

## Steps

### 1. Set card money fields
1. `PATCH /api/v1/cards/:cardId/money` with header `Authorization: Bearer <hf_token>` and body:
   ```json
   { "amount": 49.99, "currency": "USD", "label": "Price" }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has shape:
   ```json
   { "data": { "id": "<cardId>", "amount": 49.99, "currency": "USD", "label": "Price" } }
   ```

### 2. Partially update — change label only
1. `PATCH /api/v1/cards/:cardId/money` with body:
   ```json
   { "label": "Budget" }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has `"label": "Budget"` while `"amount": 49.99` and `"currency": "USD"` remain unchanged

### 3. Partially update — change amount
1. `PATCH /api/v1/cards/:cardId/money` with body:
   ```json
   { "amount": 99.00 }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has `"amount": 99.00` and `"currency": "USD"` unchanged

### 4. Clear amount (resets currency)
1. `PATCH /api/v1/cards/:cardId/money` with body:
   ```json
   { "amount": null }
   ```
2. **Assert** response status is `200`
3. **Assert** response body has `"amount": null` and `"currency": null`

### 5. Both JWT and API token are accepted
1. Obtain a session JWT by `POST /api/v1/auth/login`
2. `PATCH /api/v1/cards/:cardId/money` with `Authorization: Bearer <jwt>` and body `{ "amount": 25, "currency": "EUR" }`
3. **Assert** response status is `200`

### 6. Reject negative amount
1. `PATCH /api/v1/cards/:cardId/money` with body `{ "amount": -10, "currency": "USD" }`
2. **Assert** response status is `400`
3. **Assert** response body has `{ "name": "bad-request" }`

### 7. Reject invalid currency format (must be uppercase 3-letter ISO 4217)
1. `PATCH /api/v1/cards/:cardId/money` with body `{ "amount": 10, "currency": "usd" }`
2. **Assert** response status is `400`
3. **Assert** response body has `{ "name": "bad-request" }`

### 8. Reject empty body
1. `PATCH /api/v1/cards/:cardId/money` with body `{}`
2. **Assert** response status is `400`
3. **Assert** response body has `{ "name": "bad-request" }`

### 9. Reject unauthenticated request
1. `PATCH /api/v1/cards/:cardId/money` with no `Authorization` header and body `{ "amount": 10, "currency": "USD" }`
2. **Assert** response status is `401`

### 10. Board monetisation flag
1. Retrieve the board: `GET /api/v1/boards/:boardId`
2. **Assert** the board has a `monetisation` field (or equivalent flag)
3. If the flag can be toggled, `PATCH /api/v1/boards/:boardId` with body `{ "monetisation": false }`
4. **Assert** response status is `200`

## Expected Result
- `PATCH /api/v1/cards/:cardId/money` accepts both JWT and `hf_` API token authentication
- Returns `{ data: { id, amount, currency, label } }` with the persisted values
- Partial updates preserve unspecified fields; clearing `amount` also clears `currency`
- Negative amounts, lowercase currencies, and empty bodies return `400 bad-request`
- Unauthenticated requests return `401`