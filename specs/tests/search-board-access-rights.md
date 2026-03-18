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

## Acceptance Checklist

> Use this checklist to verify Sprint 86 (access-aware search) acceptance criteria are fully met.

| # | Criterion | Status |
|---|-----------|--------|
| 1 | PRIVATE boards never returned for non-member MEMBER/VIEWER | ⬜ PASS / FAIL |
| 2 | WORKSPACE boards never returned for GUEST role | ⬜ PASS / FAIL |
| 3 | PRIVATE boards returned for OWNER and ADMIN without extra board_members row | ⬜ PASS / FAIL |
| 4 | PRIVATE boards returned for MEMBER/VIEWER with explicit board_members row | ⬜ PASS / FAIL |
| 5 | PRIVATE boards returned for GUEST with explicit board_guest_access row | ⬜ PASS / FAIL |
| 6 | Card results filtered through same board access rules (no card leaks from inaccessible boards) | ⬜ PASS / FAIL |
| 7 | Board metadata never leaked for inaccessible boards | ⬜ PASS / FAIL |
| 8 | GET /api/v1/boards/:id PRIVATE + non-member → 403 (board-access-denied) | ⬜ PASS / FAIL |
| 9 | GET /api/v1/boards/:id WORKSPACE + GUEST → 403 (board-access-denied) | ⬜ PASS / FAIL |
| 10 | GET /api/v1/boards/:id PUBLIC + unauthenticated → 200 | ⬜ PASS / FAIL |
| 11 | Auth required for workspace search → 401 | ⬜ PASS / FAIL |
| 12 | Non-workspace-member → 403 on workspace search | ⬜ PASS / FAIL |
| 13 | Query <2 chars → 400 (search-query-too-short) | ⬜ PASS / FAIL |
| 14 | Query with no valid terms → 400 (search-query-invalid) | ⬜ PASS / FAIL |
