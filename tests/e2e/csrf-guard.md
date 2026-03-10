# CSRF Origin Header Guard — E2E Tests

## Setup

These tests verify that the CSRF origin guard middleware correctly blocks requests
from mismatched origins and allows requests from the correct origin.

The tests use the API directly rather than UI flows, since the guard operates at
the HTTP middleware layer.

---

## Test 1: Mutating request with correct Origin header passes

### Steps

1. Send a POST request to `http://localhost:3000/api/v1/boards` with:
   - Header `Origin: http://localhost:3000`
   - Header `Content-Type: application/json`
   - Header `Authorization: Bearer <valid_token>`
   - Body `{ "name": "CSRF Test Board", "workspaceId": "<valid_workspace_id>" }`
2. Verify the response status is NOT 403.
3. Verify the response body does NOT contain `csrf-origin-mismatch`.

---

## Test 2: Mutating request with mismatched Origin header is blocked

### Steps

1. Send a POST request to `http://localhost:3000/api/v1/boards` with:
   - Header `Origin: https://evil.example.com`
   - Header `Content-Type: application/json`
   - Header `Authorization: Bearer <valid_token>`
   - Body `{ "name": "Malicious Board", "workspaceId": "<valid_workspace_id>" }`
2. Verify the response status is 403.
3. Verify the response body contains `{ "error": { "code": "csrf-origin-mismatch" } }`.

---

## Test 3: Mutating request with mismatched Referer header is blocked

### Steps

1. Send a PUT request to `http://localhost:3000/api/v1/boards/<board_id>` with:
   - Header `Referer: https://attacker.net/form.html`
   - Header `Content-Type: application/json`
   - Header `Authorization: Bearer <valid_token>`
   - Body `{ "name": "Updated Name" }`
2. Verify the response status is 403.
3. Verify the response body contains `{ "error": { "code": "csrf-origin-mismatch" } }`.

---

## Test 4: Mutating request with no Origin or Referer header is allowed

### Steps

1. Send a DELETE request to `http://localhost:3000/api/v1/boards/<board_id>` with:
   - Header `Content-Type: application/json`
   - Header `Authorization: Bearer <valid_token>`
   - Body `{ "confirm": true }`
   - NO `Origin` or `Referer` header
2. Verify the response status is NOT 403.
3. Verify the response body does NOT contain `csrf-origin-mismatch`.
   *(Non-browser clients such as mobile apps and server-to-server integrations
   do not send Origin/Referer and must not be blocked.)*

---

## Test 5: Safe (read) request with mismatched Origin is NOT blocked

### Steps

1. Send a GET request to `http://localhost:3000/api/v1/boards` with:
   - Header `Origin: https://evil.example.com`
   - Header `Authorization: Bearer <valid_token>`
2. Verify the response status is NOT 403.
3. Verify the response body does NOT contain `csrf-origin-mismatch`.
   *(GET requests are safe by nature and exempt from CSRF origin checking.)*

---

## Test 6: Auth cookies contain SameSite=Strict; Secure; HttpOnly flags

### Steps

1. Send a POST request to `http://localhost:3000/api/v1/auth/login` with:
   - Header `Content-Type: application/json`
   - Body `{ "email": "<valid_email>", "password": "<valid_password>" }`
2. Capture the `Set-Cookie` response header.
3. Verify the `Set-Cookie` header contains `HttpOnly`.
4. Verify the `Set-Cookie` header contains `SameSite=Strict`.
5. Verify the `Set-Cookie` header contains `Secure`.
