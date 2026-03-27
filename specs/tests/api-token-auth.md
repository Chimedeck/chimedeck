> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# API Token Authentication — Playwright MCP Test

## Scenario: Authenticate with a valid hf_ API token

1. Log in as a test user via POST /api/v1/auth/login; capture JWT.
2. POST /api/v1/tokens with `Authorization: Bearer <JWT>`, body `{ "name": "test-token" }`.
3. Capture `data.raw` from the response — it should start with `hf_`.
4. GET /api/v1/boards using `Authorization: Bearer <raw-token>`.
5. Verify response status is 200 and `data` array is present.

## Scenario: Revoked token returns 401

1. Using the raw token from above, DELETE /api/v1/tokens/:id (the created token id).
2. Retry GET /api/v1/boards using the same raw token.
3. Verify response status is 401 with `error.code === 'unauthorized'`.

## Scenario: Expired token returns 401

1. POST /api/v1/tokens with `{ "name": "expiring", "expiresAt": "<past ISO timestamp>" }`.
2. Capture `data.raw`.
3. GET /api/v1/boards using `Authorization: Bearer <raw-token>`.
4. Verify response status is 401 with `error.code === 'unauthorized'`.

## Scenario: Cross-user token rejected

1. Log in as user A, create a token, capture its id and raw value.
2. Log in as user B, POST /api/v1/tokens/:id (user A's token id) to revoke — expect 404.
3. GET /api/v1/boards using user A's raw token while authenticated as user B context is irrelevant; the token should still authenticate as user A, not user B.