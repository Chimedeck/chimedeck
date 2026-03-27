> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Sprint 103 — Card Money Endpoint

**Sprint:** 103  
**Tool:** Playwright MCP

## Setup
- Log in as an admin user
- Open or create a board with at least one card
- Obtain an API token (via `POST /api/v1/tokens` with name "test-token" and no expiry) and note the returned `hf_` raw token

## Steps

### 1. Authenticate and update card money fields
1. Open the board and note the ID of one card (visible in card URL or via `GET /api/v1/lists/:listId/cards`)
2. Send `PATCH /api/v1/cards/:id/money` with `Authorization: Bearer <hf_token>` and body `{ "amount": 99.99, "currency": "EUR", "label": "Price" }`
3. Verify response status is 200
4. Verify response body matches `{ "data": { "id": "<cardId>", "amount": 99.99, "currency": "EUR", "label": "Price" } }`

### 2. Update only the label
1. Send `PATCH /api/v1/cards/:id/money` with `Authorization: Bearer <hf_token>` and body `{ "label": "Budget" }`
2. Verify response status is 200
3. Verify response body has `"label": "Budget"` and still has `"amount": 99.99` and `"currency": "EUR"` unchanged

### 3. Clear amount (resets currency too)
1. Send `PATCH /api/v1/cards/:id/money` with `Authorization: Bearer <hf_token>` and body `{ "amount": null }`
2. Verify response status is 200
3. Verify response body has `"amount": null` and `"currency": null`

### 4. Validation — invalid body
1. Send `PATCH /api/v1/cards/:id/money` with empty body `{}`
2. Verify response status is 400
3. Verify response body has `"name": "bad-request"`

### 5. Validation — negative amount
1. Send `PATCH /api/v1/cards/:id/money` with body `{ "amount": -5 }`
2. Verify response status is 400
3. Verify response body has `"name": "bad-request"`

### 6. Validation — invalid currency
1. Send `PATCH /api/v1/cards/:id/money` with body `{ "amount": 10, "currency": "usd" }`
2. Verify response status is 400 (currency must be uppercase 3-letter)
3. Verify response body has `"name": "bad-request"`

### 7. Auth — JWT also works
1. Log in via the web UI and note your session cookie
2. Send `PATCH /api/v1/cards/:id/money` with session cookie (no Bearer token) and body `{ "amount": 50, "currency": "USD" }`
3. Verify response status is 200 and response returns updated money fields

## Expected Result
- `PATCH /api/v1/cards/:id/money` accepts both JWT and API token authentication
- Returns `{ data: { id, amount, currency, label } }` on success
- Validates body fields and returns `{ name: 'bad-request', ... }` with status 400 on invalid input
- Clearing amount also clears currency