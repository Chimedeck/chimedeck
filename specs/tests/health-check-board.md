# Health Check Board — Backend API E2E Tests

> Playwright MCP markdown tests for the Health Check backend API (Sprint 115).
> Covers: presets endpoint, CRUD lifecycle, probe engine (green/amber/red), SSRF rejection,
> duplicate URL guard, rate limiting, and feature-flag gating.

---

## Setup

### Register and authenticate as a board member

- Navigate to `http://localhost:5173`
- If not logged in, go to `/register`
- Fill in name field with `HC Test User`
- Fill in email field with `hc-test@test.local`
- Fill in password field with `Password123!`
- Submit the registration form
- Verify the dashboard page loads
- Capture the auth token from local storage or cookie for use in subsequent API requests

### Create a workspace and board

- Navigate to `http://localhost:5173`
- Click "Create workspace" or find the workspace creation button
- Fill in the workspace name with `HC Test Workspace`
- Submit to create the workspace
- Click "Create board" or equivalent
- Fill in board name with `HC Test Board`
- Submit to create the board
- Note the board ID from the URL (format: `/boards/<boardId>`)
- Store it as `boardId`

---

## Test 1 (AC-1): GET /api/v1/health-check/presets — Returns preset list

- Send a GET request to `/api/v1/health-check/presets` with the authenticated user's credentials
- Verify the response status is `200`
- Verify the response body has a `data` array
- Verify the `data` array contains at least 1 item
- Verify each item has `key`, `name`, `description`, `url`, and `category` fields
- Verify the item with `key` equal to `"stripe-api"` has `url` equal to `"https://api.stripe.com/"`
- Verify all `url` values use `https:` scheme
- Verify all `key` values are unique within the array

---

## Test 2 (AC-2): POST /api/v1/boards/:boardId/health-checks — Add a custom URL health check

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "My Custom API",
    "url": "https://httpbin.org/status/200",
    "type": "custom"
  }
  ```
  using authenticated credentials
- Verify the response status is `201`
- Verify the response body has a `data` object
- Verify `data.name` equals `"My Custom API"`
- Verify `data.url` equals `"https://httpbin.org/status/200"`
- Verify `data.type` equals `"custom"`
- Verify `data.presetKey` is `null`
- Verify `data.isActive` is `true`
- Verify `data.id` is a non-empty UUID string
- Verify `data.boardId` matches `<boardId>`
- Verify `data.createdAt` is a valid ISO timestamp
- Verify `data.latestResult` is `null` (never probed yet)
- Store the returned `data.id` as `customHealthCheckId`

---

## Test 3 (AC-3): POST /api/v1/boards/:boardId/health-checks — Add a preset health check

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "GitHub API",
    "url": "https://api.github.com/",
    "type": "preset",
    "presetKey": "github-api"
  }
  ```
  using authenticated credentials
- Verify the response status is `201`
- Verify `data.type` equals `"preset"`
- Verify `data.presetKey` equals `"github-api"`
- Verify `data.name` equals `"GitHub API"`
- Verify `data.latestResult` is `null`
- Store the returned `data.id` as `presetHealthCheckId`

---

## Test 4 (AC-4): POST — Duplicate URL is rejected with 409

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "Duplicate Check",
    "url": "https://httpbin.org/status/200"
  }
  ```
  (same URL as the custom check created in Test 2)
- Verify the response status is `409`
- Verify the response body has an `error` object
- Verify `error.name` equals `"health-check-url-already-monitored"`

---

## Test 5: POST — Validation: invalid URL scheme is rejected

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "File Scheme",
    "url": "file:///etc/passwd"
  }
  ```
- Verify the response status is `422`
- Verify `error.name` is present and non-empty

---

## Test 6: POST — Validation: URL with embedded credentials is rejected

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "Creds In URL",
    "url": "https://user:password@example.com/"
  }
  ```
- Verify the response status is `422`
- Verify `error.name` equals `"health-check-url-credentials-not-allowed"`

---

## Test 7: POST — Validation: relative URL is rejected

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "Relative URL",
    "url": "/internal/path"
  }
  ```
- Verify the response status is `422`
- Verify `error.name` is present and non-empty

---

## Test 8: POST — Validation: name exceeding 120 characters is rejected

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "url": "https://example.com/toolong"
  }
  ```
  (name is 121 characters)
- Verify the response status is `422`
- Verify `error.name` is present and non-empty

---

## Test 9 (AC-8): POST — SSRF: private IP address is rejected

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "Private IP",
    "url": "http://192.168.1.1/admin"
  }
  ```
- Verify the response status is `422`
- Verify `error.name` is present and indicates SSRF rejection (e.g. `"health-check-url-ssrf-blocked"` or similar)

---

## Test 10 (AC-8): POST — SSRF: localhost is rejected

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "Localhost",
    "url": "http://localhost:3000/"
  }
  ```
- Verify the response status is `422`
- Verify `error.name` is present and indicates SSRF rejection

---

## Test 11 (AC-8): POST — SSRF: loopback IP (127.x) is rejected

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "Loopback IP",
    "url": "http://127.0.0.1/"
  }
  ```
- Verify the response status is `422`
- Verify `error.name` is present and indicates SSRF rejection

---

## Test 12 (AC-8): POST — SSRF: 10.x private range is rejected

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "10.x Private",
    "url": "http://10.0.0.1/"
  }
  ```
- Verify the response status is `422`
- Verify `error.name` is present and indicates SSRF rejection

---

## Test 13 (AC-8): POST — SSRF: .local hostname is rejected

- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
  ```json
  {
    "name": "Local hostname",
    "url": "http://myserver.local/"
  }
  ```
- Verify the response status is `422`
- Verify `error.name` is present and indicates SSRF rejection

---

## Test 14: GET /api/v1/boards/:boardId/health-checks — List returns all entries

- Send a GET request to `/api/v1/boards/<boardId>/health-checks` with authenticated credentials
- Verify the response status is `200`
- Verify the response body has a `data` array
- Verify the array contains at least 2 items (the custom and preset checks added earlier)
- Verify each item has `id`, `boardId`, `name`, `url`, `type`, `presetKey`, `isActive`, `createdAt`, and `latestResult` fields
- Verify the item with `id` equal to `<customHealthCheckId>` has `latestResult` equal to `null`

---

## Test 15 (AC-5): POST /api/v1/boards/:boardId/health-checks/:id/probe — Green endpoint

- Send a POST request to `/api/v1/boards/<boardId>/health-checks/<customHealthCheckId>/probe`
  using `https://httpbin.org/status/200` (responds 200 in < 1 000 ms under normal conditions)
  with authenticated credentials
- Verify the response status is `200`
- Verify the response body has a `data` object
- Verify `data.status` equals `"green"`
- Verify `data.httpStatus` equals `200`
- Verify `data.responseTimeMs` is a non-negative integer less than `1000`
- Verify `data.checkedAt` is a valid ISO timestamp
- Verify `data.errorMessage` is `null`

---

## Test 16 (AC-7): POST /api/v1/boards/:boardId/health-checks/:id/probe — Unreachable endpoint (red)

- First, add a health check with an unreachable URL:
  - Send a POST request to `/api/v1/boards/<boardId>/health-checks` with body:
    ```json
    {
      "name": "Unreachable Endpoint",
      "url": "https://this-domain-does-not-exist-12345.invalid/"
    }
    ```
  - Verify response status is `201`
  - Store returned `data.id` as `unreachableHealthCheckId`
- Send a POST request to `/api/v1/boards/<boardId>/health-checks/<unreachableHealthCheckId>/probe`
- Verify the response status is `200`
- Verify `data.status` equals `"red"`
- Verify `data.errorMessage` is a non-empty string
- Verify `data.httpStatus` is `null`

---

## Test 17 (AC-9): GET list after probe — latestResult is embedded

- Send a GET request to `/api/v1/boards/<boardId>/health-checks` with authenticated credentials
- Verify the response status is `200`
- Verify the item with `id` equal to `<customHealthCheckId>` has a non-null `latestResult`
- Verify `latestResult.status` is one of `"green"`, `"amber"`, or `"red"`
- Verify `latestResult.checkedAt` is a valid ISO timestamp
- Verify `latestResult.httpStatus` is present (integer or null)
- Verify the item with `id` equal to `<unreachableHealthCheckId>` has `latestResult.status` equal to `"red"`

---

## Test 18: POST /api/v1/boards/:boardId/health-checks/probe-all — Probes all entries

- Send a POST request to `/api/v1/boards/<boardId>/health-checks/probe-all` with authenticated credentials
- Verify the response status is `200`
- Verify the response body has a `data` object
- Verify `data.results` is an array
- Verify `data.checkedAt` is a valid ISO timestamp
- Verify each item in `data.results` has a `status` field equal to one of `"green"`, `"amber"`, or `"red"`

---

## Test 19: Rate limiting — probe returns 429 after rapid repeat calls

- Send a POST request to `/api/v1/boards/<boardId>/health-checks/<customHealthCheckId>/probe`
- Immediately send a second POST request to the same endpoint (within 5 seconds)
- Verify the second response status is `429`
- Verify `error.name` equals `"probe-rate-limited"`

---

## Test 20: Rate limiting — probe-all returns 429 after rapid repeat

- Send a POST request to `/api/v1/boards/<boardId>/health-checks/probe-all`
- Immediately send a second POST request to the same endpoint (within 5 seconds)
- Verify the second response status is `429`
- Verify `error.name` equals `"probe-rate-limited"`

---

## Test 21: DELETE /api/v1/boards/:boardId/health-checks/:id — Remove a health check

- Send a DELETE request to `/api/v1/boards/<boardId>/health-checks/<presetHealthCheckId>`
  with authenticated credentials
- Verify the response status is `200`
- Verify the response body has `data` equal to `{}`
- Send a GET request to `/api/v1/boards/<boardId>/health-checks`
- Verify the `data` array does not contain an item with `id` equal to `<presetHealthCheckId>`

---

## Test 22: DELETE — 404 for already-deleted health check

- Send a DELETE request to `/api/v1/boards/<boardId>/health-checks/<presetHealthCheckId>` again
- Verify the response status is `404`
- Verify `error.name` equals `"health-check-not-found"`

---

## Test 23: DELETE — 404 for non-existent ID

- Send a DELETE request to `/api/v1/boards/<boardId>/health-checks/00000000-0000-0000-0000-000000000000`
  with authenticated credentials
- Verify the response status is `404`
- Verify `error.name` equals `"health-check-not-found"`

---

## Test 24: Probe a non-existent health check returns 404

- Send a POST request to `/api/v1/boards/<boardId>/health-checks/00000000-0000-0000-0000-000000000000/probe`
  with authenticated credentials
- Verify the response status is `404`
- Verify `error.name` equals `"health-check-not-found"`

---

## Test 25: Unauthenticated requests are rejected

- Send a GET request to `/api/v1/health-check/presets` with no Authorization header
- Verify the response status is `401`
- Send a GET request to `/api/v1/boards/<boardId>/health-checks` with no Authorization header
- Verify the response status is `401`
- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with no Authorization header and a valid body
- Verify the response status is `401`

---

## Test 26 (AC-10): Feature flag disabled — all health-check routes return 404

> **Pre-condition:** Set environment variable `HEALTH_CHECK_ENABLED=false` and restart the server.
> If the server cannot be restarted in this test run, skip this test and mark it as a manual verification step.

- Send a GET request to `/api/v1/health-check/presets` with authenticated credentials
- Verify the response status is `404`
- Send a GET request to `/api/v1/boards/<boardId>/health-checks` with authenticated credentials
- Verify the response status is `404`
- Send a POST request to `/api/v1/boards/<boardId>/health-checks` with authenticated credentials and a valid body
- Verify the response status is `404`
- Send a POST request to `/api/v1/boards/<boardId>/health-checks/<customHealthCheckId>/probe` with authenticated credentials
- Verify the response status is `404`
- Send a POST request to `/api/v1/boards/<boardId>/health-checks/probe-all` with authenticated credentials
- Verify the response status is `404`

---

## Summary of Acceptance Criteria Coverage

| AC | Test(s) |
|----|---------|
| AC-1 — Presets endpoint returns list | Test 1 |
| AC-2 — Add custom URL: 201, latestResult null | Test 2 |
| AC-3 — Add preset: 201, type/presetKey set | Test 3 |
| AC-4 — Duplicate URL: 409 | Test 4 |
| AC-5 — Probe green endpoint | Test 15 |
| AC-6 — Probe slow endpoint (amber) | _(manual / integration test — requires slow mock)_ |
| AC-7 — Probe unreachable endpoint: red | Test 16 |
| AC-8 — SSRF rejection | Tests 9–13 |
| AC-9 — GET list includes latestResult after probe | Tests 17 |
| AC-10 — Feature flag disabled → 404 | Test 26 |
