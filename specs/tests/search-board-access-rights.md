# Search Board Access Rights

> Playwright MCP test scenarios for Sprint 86 — server-side access-aware search filtering and board-open permission consistency.

---

## API Scenarios — Workspace Search Access Filtering

### SBAR-API-01 — Auth required for workspace search

**Preconditions:** Workspace exists.  
**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task` with no `Authorization` header.

**Expected:**
- Response status: `401`
- Body: `{ error: { code: 'missing-or-invalid-token', ... } }`

---

### SBAR-API-02 — Non-member cannot search workspace

**Preconditions:**
- Authenticated user is not a member of the workspace.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task` with valid token.

**Expected:**
- Response status: `403`
- Body: `{ error: { code: 'insufficient-role', ... } }`

---

### SBAR-API-03 — PRIVATE board excluded for non-member VIEWER

**Preconditions:**
- Workspace has two boards: `board-private` (PRIVATE) and `board-workspace` (WORKSPACE).
- Caller is workspace VIEWER with no `board_members` row for `board-private`.
- Both boards have cards matching the search query.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task`.

**Expected:**
- Response status: `200`
- `data` does **not** contain any result with `id === board-private` or `board_id === board-private`.
- `data` **does** contain results from `board-workspace`.

---

### SBAR-API-04 — PRIVATE board included when VIEWER is an explicit board member

**Preconditions:**
- Workspace has `board-private` (PRIVATE).
- Caller is workspace VIEWER **and** has a `board_members` row for `board-private`.
- Board and its cards match the search query.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task`.

**Expected:**
- Response status: `200`
- `data` includes results from `board-private`.

---

### SBAR-API-05 — OWNER sees all boards regardless of visibility

**Preconditions:**
- Workspace has: `board-public` (PUBLIC), `board-workspace` (WORKSPACE), `board-private` (PRIVATE).
- Caller is workspace OWNER.
- All boards have cards matching the search query.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task`.

**Expected:**
- Response status: `200`
- `data` contains results from all three boards.

---

### SBAR-API-06 — ADMIN sees all boards regardless of visibility

**Preconditions:**
- Same setup as SBAR-API-05 but caller is workspace ADMIN.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task`.

**Expected:**
- Response status: `200`
- `data` contains results from all three boards.

---

### SBAR-API-07 — GUEST excluded from WORKSPACE-visibility boards

**Preconditions:**
- Workspace has `board-workspace` (WORKSPACE) with matching cards.
- Caller has workspace role GUEST.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task`.

**Expected:**
- Response status: `200`
- `data` does **not** contain any result from `board-workspace`.

---

### SBAR-API-08 — GUEST can see explicitly granted PRIVATE board

**Preconditions:**
- Workspace has `board-private` (PRIVATE) with matching cards.
- Caller has workspace role GUEST with a `board_guest_access` row for `board-private`.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task`.

**Expected:**
- Response status: `200`
- `data` includes results from `board-private`.

---

### SBAR-API-09 — GUEST excluded from PRIVATE board without explicit access

**Preconditions:**
- Workspace has `board-private` (PRIVATE) with matching cards.
- Caller has workspace role GUEST but **no** `board_guest_access` row.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task`.

**Expected:**
- Response status: `200`
- `data` does **not** contain any result from `board-private`.

---

### SBAR-API-10 — PUBLIC board visible to all authenticated members

**Preconditions:**
- Workspace has `board-public` (PUBLIC) with matching cards.
- Caller is workspace VIEWER (no explicit board membership).

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task`.

**Expected:**
- Response status: `200`
- `data` includes results from `board-public`.

---

### SBAR-API-11 — Response never leaks board metadata for inaccessible boards

**Preconditions:**
- Workspace has `board-private` (PRIVATE) with title "Secret Board".
- Caller is workspace MEMBER with no `board_members` row.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=secret`.

**Expected:**
- Response status: `200`
- `data` is empty (or contains no result referencing `board-private`).
- The title "Secret Board" is not present anywhere in the response body.

---

### SBAR-API-12 — Query too short (less than 2 characters)

**Preconditions:** Authenticated workspace member.  
**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=a`.

**Expected:**
- Response status: `400`
- Body: `{ error: { code: 'search-query-too-short', ... } }`

---

### SBAR-API-13 — Query with only special characters

**Preconditions:** Authenticated workspace member.  
**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=!!!`.

**Expected:**
- Response status: `400`
- Body: `{ error: { code: 'search-query-invalid', ... } }`

---

### SBAR-API-14 — Workspace not found

**Preconditions:** Authenticated user.  
**Steps:**
1. Send `GET /api/v1/workspaces/nonexistent-id/search?q=task`.

**Expected:**
- Response status: `404`
- Body: `{ error: { code: 'workspace-not-found', ... } }`

---

### SBAR-API-15 — type=board filters to boards only; still respects access

**Preconditions:**
- PRIVATE board and WORKSPACE board, both with matching data.
- Caller is workspace VIEWER with no `board_members` row for the PRIVATE board.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task&type=board`.

**Expected:**
- Response status: `200`
- `data` contains only items with `type === 'board'`.
- PRIVATE board is **not** in `data`.
- WORKSPACE board **is** in `data`.

---

### SBAR-API-16 — type=card filters to cards only; still respects access

**Preconditions:**
- PRIVATE board with cards, WORKSPACE board with cards.
- Caller is workspace VIEWER with no `board_members` row.

**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task&type=card`.

**Expected:**
- Response status: `200`
- `data` contains only items with `type === 'card'`.
- No card with `board_id` matching the PRIVATE board appears.

---

## API Scenarios — Board-Open Permission Consistency

### SBAR-API-17 — GET /api/v1/boards/:id returns 403 for PRIVATE board non-member

**Preconditions:**
- Board has `PRIVATE` visibility.
- Caller is workspace MEMBER with no `board_members` row.

**Steps:**
1. Send `GET /api/v1/boards/:boardId`.

**Expected:**
- Response status: `403`
- Body: `{ error: { code: 'board-access-denied', ... } }`

---

### SBAR-API-18 — GET /api/v1/boards/:id returns 200 for WORKSPACE board MEMBER

**Preconditions:**
- Board has `WORKSPACE` visibility.
- Caller is workspace MEMBER (no explicit board membership needed).

**Steps:**
1. Send `GET /api/v1/boards/:boardId`.

**Expected:**
- Response status: `200`
- Body: `{ data: { id: boardId, visibility: 'WORKSPACE', ... }, ... }`

---

### SBAR-API-19 — GET /api/v1/boards/:id returns 200 for PUBLIC board (unauthenticated)

**Preconditions:**
- Board has `PUBLIC` visibility.

**Steps:**
1. Send `GET /api/v1/boards/:boardId` with no `Authorization` header.

**Expected:**
- Response status: `200`
- Body includes `{ data: { visibility: 'PUBLIC' } }`

---

### SBAR-API-20 — GUEST cannot open WORKSPACE board directly

**Preconditions:**
- Board has `WORKSPACE` visibility.
- Caller has workspace role GUEST.

**Steps:**
1. Send `GET /api/v1/boards/:boardId`.

**Expected:**
- Response status: `403`
- Body: `{ error: { code: 'board-access-denied', ... } }`

---

## UI Scenarios — Workspace Search Access Filtering

### SBAR-UI-01 — Search results do not show inaccessible PRIVATE board

**Preconditions:**
- Logged in as workspace MEMBER with no access to `board-private`.
- `board-private` has cards matching the search query.

**Steps:**
1. Navigate to workspace page.
2. Open global search.
3. Type `task` (at least 2 characters) and wait for results.

**Expected:**
- Results panel does not include any item from `board-private`.
- No board named "Secret Board" (or equivalent) appears.

---

### SBAR-UI-02 — OWNER sees all boards in workspace search results

**Preconditions:**
- Logged in as workspace OWNER.
- Workspace has PUBLIC, WORKSPACE, and PRIVATE boards with matching cards.

**Steps:**
1. Navigate to workspace page.
2. Open global search.
3. Type the shared query term.

**Expected:**
- Results include cards/boards from all three board types.

---

### SBAR-UI-03 — GUEST does not see WORKSPACE board in search results

**Preconditions:**
- Logged in as workspace GUEST.
- Workspace has a WORKSPACE board with matching cards.

**Steps:**
1. Navigate to workspace page.
2. Open global search.
3. Type the shared query term.

**Expected:**
- Results do not include any item from the WORKSPACE-visibility board.

---

### SBAR-UI-04 — Unauthenticated user is redirected to login on workspace search attempt

**Preconditions:**
- No active session.

**Steps:**
1. Navigate directly to a workspace search URL.

**Expected:**
- User is redirected to the login page.
- No search results are shown.

---

## UI Scenarios — Stale-Cache Safety (Client)

> These scenarios cover the case where a board is returned in a search result but becomes inaccessible
> (deleted, visibility changed, membership revoked) **after** the search response was cached on the client.
> The `SearchResults` component verifies access on click; on failure it purges the stale entry and redirects.

---

### SBAR-UI-05 — Stale board result: click shows neutral message and redirects

**Preconditions:**
- Logged in as workspace MEMBER.
- A board (`board-stale`) was returned in a previous workspace search result (cached client-side).
- Between the search response and the click, `board-stale` visibility was changed to PRIVATE and the
  user lost access (or the board was deleted).

**Steps:**
1. Open global search and search for the term that returned `board-stale`.
2. Before clicking, simulate the board becoming inaccessible (intercept `GET /api/v1/boards/board-stale` to return `403`).
3. Click the `board-stale` result in the results panel.

**Expected:**
- The UI shows a neutral amber banner: _"This board is no longer accessible. Redirecting to your boards list…"_
- The banner has `role="status"` and `aria-live="polite"` for assistive-technology compatibility.
- A loading spinner appears briefly on the clicked item during the access check.
- After ~1.8 s the app navigates to `/workspaces/:workspaceId/boards`.
- The stale board entry is **removed** from the in-memory result list (not shown again if the modal is re-opened with the same cached results).

---

### SBAR-UI-06 — Stale board result: 404 treated identically to 403

**Preconditions:**
- Same as SBAR-UI-05 but the access check returns `404` (board was deleted).

**Steps:**
1. Open global search and find the cached board result.
2. Intercept `GET /api/v1/boards/board-deleted` to return `404`.
3. Click the board result.

**Expected:**
- Identical behaviour to SBAR-UI-05: amber banner, cache purge, redirect to boards list.

---

### SBAR-UI-07 — Accessible board result: no stale banner, normal navigation

**Preconditions:**
- Logged in as workspace MEMBER with access to `board-accessible`.
- `GET /api/v1/boards/board-accessible` returns `200`.

**Steps:**
1. Open global search and search for the query.
2. Click the `board-accessible` result.

**Expected:**
- No amber banner is shown.
- The app navigates directly to `/boards/board-accessible`.
- The result is **not** purged from the local cache.

---

### SBAR-UI-08 — Stale board purged from local cache after failed click

**Preconditions:**
- Cached workspace search results contain two boards: `board-ok` (accessible) and `board-gone` (now inaccessible).

**Steps:**
1. Open global search (results are cached).
2. Intercept `GET /api/v1/boards/board-gone` to return `403`.
3. Click `board-gone`.
4. After the redirect, reopen the search modal with the same query.

**Expected:**
- `board-gone` does **not** appear in the result list on the second open.
- `board-ok` still appears (unaffected by the purge).

---

### SBAR-UI-09 — Network/server error on access check falls through to normal navigation

**Preconditions:**
- Logged in as workspace MEMBER.
- Board result is in cached results.
- `GET /api/v1/boards/board-id` returns `500` (server error).

**Steps:**
1. Open global search.
2. Intercept `GET /api/v1/boards/board-id` to return `500`.
3. Click the board result.

**Expected:**
- No amber banner is shown (5xx is treated as a transient error, not a permission failure).
- The app proceeds with navigation to `/boards/board-id` as if the check passed.
- The result is **not** purged from the cache.

---

### SBAR-UI-10 — Card results bypass access pre-check (no stale banner)

**Preconditions:**
- Cached workspace search results include a card result for a card on `board-stale`.

**Steps:**
1. Open global search.
2. Click the card result.

**Expected:**
- No access pre-check fetch is made (card results are not subject to board access pre-check).
- The app navigates immediately to `/boards/:boardId?card=:cardId`.
- No amber banner is shown.

---

## Observability Scenarios

> These scenarios verify that structured log events are emitted for observable access decisions.
> Log events are JSON lines written to stdout. Test by inspecting server stdout during the request.

---

### SBAR-OBS-01 — `search.permission_denied` logged on unauthenticated search

**Preconditions:** No `Authorization` header.  
**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task` without auth.

**Expected:**
- Server stdout contains a JSON line matching `{ "event": "search.permission_denied", "workspaceId": "<id>", "reason": "unauthenticated" }`.
- No `userId` field in the log entry (caller is anonymous).

---

### SBAR-OBS-02 — `search.permission_denied` logged for non-member caller

**Preconditions:** Authenticated user not in the workspace.  
**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task` with valid token.

**Expected:**
- Server stdout contains a JSON line matching `{ "event": "search.permission_denied", "workspaceId": "<id>", "userId": "<id>", "reason": "not-workspace-member" }`.

---

### SBAR-OBS-03 — `search.permission_filter_applied` logged on every successful search

**Preconditions:** Authenticated workspace member.  
**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task`.

**Expected:**
- Server stdout contains a JSON line matching `{ "event": "search.permission_filter_applied", "workspaceId": "<id>", "userId": "<id>", "callerRole": "<role>" }`.
- The `ts` field is present and is a valid ISO 8601 timestamp.
- The search query text (`q`) is **not** present in the log entry.

---

### SBAR-OBS-04 — `search.results` logged with result count and hasMore

**Preconditions:** Authenticated workspace member with at least one matching board/card.  
**Steps:**
1. Send `GET /api/v1/workspaces/:workspaceId/search?q=task`.

**Expected:**
- Server stdout contains a JSON line matching `{ "event": "search.results", "workspaceId": "<id>", "resultCount": <n>, "hasMore": false }`.
- `resultCount` matches the number of items in `data`.

---

### SBAR-OBS-05 — `board.access_checked` logged with `result: "denied"` for PRIVATE non-member

**Preconditions:**
- PRIVATE board, caller is workspace MEMBER with no board_members row.

**Steps:**
1. Send `GET /api/v1/boards/:boardId` with a MEMBER token.

**Expected:**
- Server stdout contains `{ "event": "board.access_checked", "boardId": "<id>", "result": "denied", "statusCode": 403 }`.
- The `userId` field is present and matches the caller.

---

### SBAR-OBS-06 — `board.access_checked` logged with `result: "allowed"` for accessible board

**Preconditions:**
- WORKSPACE board, caller is workspace MEMBER.

**Steps:**
1. Send `GET /api/v1/boards/:boardId` with a MEMBER token.

**Expected:**
- Server stdout contains `{ "event": "board.access_checked", "boardId": "<id>", "result": "allowed", "visibility": "WORKSPACE", "statusCode": 200 }`.

---

### SBAR-OBS-07 — Log entries contain `ts` field and no sensitive data

**Preconditions:** Any search or board-access request.  
**Steps:**
1. Execute any search or board GET request.
2. Inspect the emitted log lines.

**Expected:**
- Every log entry has a `ts` field with a valid ISO 8601 timestamp.
- No log entry contains the search query (`q`), card titles, or board titles.
- No log entry contains passwords, tokens, or email addresses.

---

## Acceptance Checklist

> Use this checklist to verify Sprint 86 (access-aware search + observability) acceptance criteria are fully met.

| # | Criterion | Covered By | Status |
|---|-----------|-----------|--------|
| 1 | PRIVATE boards never returned for non-member MEMBER/VIEWER | SBAR-API-03 | ⬜ PASS / FAIL |
| 2 | WORKSPACE boards never returned for GUEST role | SBAR-API-07 | ⬜ PASS / FAIL |
| 3 | PRIVATE boards returned for OWNER and ADMIN without extra board_members row | SBAR-API-05, SBAR-API-06 | ⬜ PASS / FAIL |
| 4 | PRIVATE boards returned for MEMBER/VIEWER with explicit board_members row | SBAR-API-04 | ⬜ PASS / FAIL |
| 5 | PRIVATE boards returned for GUEST with explicit board_guest_access row | SBAR-API-08 | ⬜ PASS / FAIL |
| 6 | Card results filtered through same board access rules (no card leaks from inaccessible boards) | SBAR-API-16 | ⬜ PASS / FAIL |
| 7 | Board metadata never leaked for inaccessible boards | SBAR-API-11 | ⬜ PASS / FAIL |
| 8 | GET /api/v1/boards/:id PRIVATE + non-member → 403 (board-access-denied) | SBAR-API-17 | ⬜ PASS / FAIL |
| 9 | GET /api/v1/boards/:id WORKSPACE + GUEST → 403 (board-access-denied) | SBAR-API-20 | ⬜ PASS / FAIL |
| 10 | GET /api/v1/boards/:id PUBLIC + unauthenticated → 200 | SBAR-API-19 | ⬜ PASS / FAIL |
| 11 | Auth required for workspace search → 401 | SBAR-API-01 | ⬜ PASS / FAIL |
| 12 | Non-workspace-member → 403 on workspace search | SBAR-API-02 | ⬜ PASS / FAIL |
| 13 | Query <2 chars → 400 (search-query-too-short) | SBAR-API-12 | ⬜ PASS / FAIL |
| 14 | Query with no valid terms → 400 (search-query-invalid) | SBAR-API-13 | ⬜ PASS / FAIL |
| 15 | Stale board click (403) → amber banner shown, entry purged from cache, redirect to boards list | SBAR-UI-05 | ⬜ PASS / FAIL |
| 16 | Stale board click (404) → same behaviour as 403 | SBAR-UI-06 | ⬜ PASS / FAIL |
| 17 | Accessible board click → no banner, normal navigation, no cache purge | SBAR-UI-07 | ⬜ PASS / FAIL |
| 18 | Card result click bypasses board access pre-check | SBAR-UI-10 | ⬜ PASS / FAIL |
| 19 | 5xx on access check falls through to normal navigation (no false-positive stale warning) | SBAR-UI-09 | ⬜ PASS / FAIL |
| 20 | `search.permission_denied` logged on unauthenticated search | SBAR-OBS-01 | ⬜ PASS / FAIL |
| 21 | `search.permission_denied` logged for non-member caller | SBAR-OBS-02 | ⬜ PASS / FAIL |
| 22 | `search.permission_filter_applied` logged on every successful search | SBAR-OBS-03 | ⬜ PASS / FAIL |
| 23 | `search.results` logged with result count | SBAR-OBS-04 | ⬜ PASS / FAIL |
| 24 | `board.access_checked` logged with `result: "denied"` for PRIVATE non-member | SBAR-OBS-05 | ⬜ PASS / FAIL |
| 25 | `board.access_checked` logged with `result: "allowed"` for accessible board | SBAR-OBS-06 | ⬜ PASS / FAIL |
| 26 | Log entries contain `ts` field and no sensitive data (no `q`, no titles) | SBAR-OBS-07 | ⬜ PASS / FAIL |
