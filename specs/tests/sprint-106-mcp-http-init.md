> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 106 — Remote MCP HTTP Init — Playwright MCP Test

## Scenario: Unauthenticated POST returns 401

1. POST /api/mcp with no `Authorization` header and a minimal MCP initialize body:
   ```json
   { "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { "protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": { "name": "test", "version": "1.0" } } }
   ```
2. Verify response status is 401.
3. Verify response body contains `error.code === 'unauthorized'`.

## Scenario: Valid POST initializes session and returns mcp-session-id header

1. Log in as a test user via POST /api/v1/auth/login; capture JWT.
2. POST /api/v1/tokens with `Authorization: Bearer <JWT>`, body `{ "name": "mcp-test-token" }`.
3. Capture `data.token` from the response — it should start with `hf_`.
4. POST /api/mcp with:
   - Header: `Authorization: Bearer <hf_token>`
   - Header: `Content-Type: application/json`
   - Body:
     ```json
     { "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { "protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": { "name": "test", "version": "1.0" } } }
     ```
5. Verify response status is 200.
6. Verify the response contains a `mcp-session-id` header with a non-empty UUID value.
7. Capture the `mcp-session-id` header value.

## Scenario: DELETE terminates session

1. Continue from the "Valid POST initializes session" scenario — use the captured `mcp-session-id`.
2. DELETE /api/mcp with:
   - Header: `Authorization: Bearer <hf_token>`
   - Header: `mcp-session-id: <captured-session-id>`
3. Verify response status is 204 with no body.
4. POST /api/mcp again with the same `mcp-session-id` header and a tool call body:
   ```json
   { "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {} }
   ```
5. Verify response status is 404 (session not found / expired).

## Scenario: Missing mcp-session-id on non-initialize POST returns 400

1. Log in as a test user and create an `hf_` token (same as above).
2. POST /api/mcp with `Authorization: Bearer <hf_token>`, a `Content-Type: application/json` header,
   a `mcp-session-id: some-fake-uuid` header, and a tools/list body:
   ```json
   { "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {} }
   ```
3. Verify response status is 404 with `name === 'session-not-found'`.

## Scenario: Session ownership prevents hijacking

1. Log in as user A; create token A (`hf_A`).
2. POST /api/mcp with token A to initialize; capture `mcp-session-id`.
3. Log in as user B; create token B (`hf_B`).
4. DELETE /api/mcp with `Authorization: Bearer <hf_B>` and the session id from step 2.
5. Verify response status is 403.