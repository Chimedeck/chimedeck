> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 78 – Iteration 2: Board Visibility Enforcement Middleware

Verify that the board visibility middleware correctly enforces access rules:
- **PRIVATE** boards return `403` for unauthenticated requests and for authenticated workspace members without an explicit `board_members` entry.
- **WORKSPACE** boards are accessible to all authenticated workspace members.
- **PUBLIC** boards are readable without authentication.

---

## Prerequisites

- Server running at `http://localhost:3000`
- At least one workspace with two test users:
  - `admin@example.com` / `password` — workspace ADMIN (also the board creator)
  - `member@example.com` / `password` — workspace MEMBER (not in any board_members row)
- Database migrations `0030_guest_role` and `0040_board_members` have been applied

---

## Test A — PRIVATE Board Denies Unauthenticated Access

### A1. Create a PRIVATE board as workspace admin

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000" })
mcp_playwright_browser_snapshot()
```

Sign in as admin:

```
mcp_playwright_browser_click({ element: "Email input", ref: "<email-input-ref>" })
mcp_playwright_browser_type({ text: "admin@example.com" })
mcp_playwright_browser_click({ element: "Password input", ref: "<password-input-ref>" })
mcp_playwright_browser_type({ text: "password" })
mcp_playwright_browser_click({ element: "Sign in button", ref: "<sign-in-ref>" })
mcp_playwright_browser_snapshot()
```

Expected: Admin dashboard visible.

Create a new board (the default visibility is PRIVATE):

```
mcp_playwright_browser_click({ element: "Create Board button", ref: "<create-board-ref>" })
mcp_playwright_browser_snapshot()
mcp_playwright_browser_click({ element: "Board title input", ref: "<title-input-ref>" })
mcp_playwright_browser_type({ text: "Private Test Board" })
mcp_playwright_browser_click({ element: "Submit button", ref: "<submit-ref>" })
mcp_playwright_browser_snapshot()
```

Expected: Board is created and listed with PRIVATE visibility. Note the board ID from the URL.

### A2. Verify PRIVATE board is accessible to admin

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>" })
mcp_playwright_browser_snapshot()
```

Expected: JSON response with `data.visibility = "PRIVATE"` and HTTP 200.

### A3. Sign out and try to access the PRIVATE board without authentication

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/auth/logout" })
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>" })
mcp_playwright_browser_snapshot()
```

Expected: HTTP 401 or 403 response. The board data is NOT returned.

### A4. Sign in as workspace MEMBER (not in board_members) and try to access PRIVATE board

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000" })
mcp_playwright_browser_click({ element: "Email input", ref: "<email-input-ref>" })
mcp_playwright_browser_type({ text: "member@example.com" })
mcp_playwright_browser_click({ element: "Password input", ref: "<password-input-ref>" })
mcp_playwright_browser_type({ text: "password" })
mcp_playwright_browser_click({ element: "Sign in button", ref: "<sign-in-ref>" })
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>" })
mcp_playwright_browser_snapshot()
```

Expected: HTTP 403 with `error.code = "board-access-denied"`. The MEMBER is not in `board_members` so access is denied.

### A5. Verify PRIVATE board lists also return 403 for the excluded member

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>/lists" })
mcp_playwright_browser_snapshot()
```

Expected: HTTP 403 — list data is not returned.

---

## Test B — WORKSPACE Board Accessible to All Workspace Members

### B1. Sign in as admin and change the board visibility to WORKSPACE

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000" })
// Sign in as admin@example.com (steps same as A1)
mcp_playwright_browser_navigate({ url: "http://localhost:3000/boards/<board-id>" })
mcp_playwright_browser_snapshot()
```

Open board settings and change visibility to WORKSPACE:

```
mcp_playwright_browser_click({ element: "Board settings button", ref: "<settings-ref>" })
mcp_playwright_browser_snapshot()
mcp_playwright_browser_click({ element: "Visibility selector", ref: "<visibility-ref>" })
mcp_playwright_browser_snapshot()
mcp_playwright_browser_click({ element: "Workspace option", ref: "<workspace-option-ref>" })
mcp_playwright_browser_snapshot()
```

Expected: Visibility changes to WORKSPACE. Board settings show "Workspace" as the selected option.

Alternatively, update via API:

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>" })
// PATCH with body: { "visibility": "WORKSPACE" }
mcp_playwright_browser_snapshot()
```

### B2. Sign in as workspace MEMBER and access the WORKSPACE board

```
// Sign out from admin, sign in as member@example.com
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>" })
mcp_playwright_browser_snapshot()
```

Expected: HTTP 200 with `data.visibility = "WORKSPACE"`. The MEMBER can access the board.

### B3. Verify WORKSPACE board lists are accessible to the MEMBER

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>/lists" })
mcp_playwright_browser_snapshot()
```

Expected: HTTP 200 with a `data` array of lists.

### B4. Verify WORKSPACE board is NOT accessible unauthenticated

```
// Sign out
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/auth/logout" })
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>" })
mcp_playwright_browser_snapshot()
```

Expected: HTTP 401 or 403 — WORKSPACE boards require authentication.

---

## Test C — PUBLIC Board Accessible Without Authentication

### C1. Admin changes board visibility to PUBLIC

```
// Sign in as admin, patch the board visibility to PUBLIC
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>" })
// Use PATCH body: { "visibility": "PUBLIC" }
mcp_playwright_browser_snapshot()
```

### C2. Access PUBLIC board without authentication

```
// Sign out first
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/auth/logout" })
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>" })
mcp_playwright_browser_snapshot()
```

Expected: HTTP 200 with `data.visibility = "PUBLIC"`. No authentication required.

---

## Test D — PRIVATE Board Accessible to MEMBER Added via board_members

### D1. Admin adds the MEMBER to the PRIVATE board

First change visibility back to PRIVATE:

```
// Sign in as admin
// PATCH /api/v1/boards/<board-id> with { "visibility": "PRIVATE" }
mcp_playwright_browser_snapshot()
```

Add the member explicitly (once board member management API is available in Iteration 3):

```
// POST /api/v1/boards/<board-id>/members with { "userId": "<member-user-id>", "role": "MEMBER" }
mcp_playwright_browser_snapshot()
```

### D2. MEMBER can now access the PRIVATE board

```
// Sign in as member@example.com
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>" })
mcp_playwright_browser_snapshot()
```

Expected: HTTP 200 — now that there is a `board_members` row, the MEMBER can access the board.

---

## Acceptance Criteria

| # | Criterion | Pass / Fail |
|---|-----------|-------------|
| 1 | Unauthenticated GET on a PRIVATE board returns 401/403 | |
| 2 | Authenticated workspace MEMBER without a board_members row gets 403 on PRIVATE board | |
| 3 | Authenticated workspace MEMBER without a board_members row gets 403 on PRIVATE board /lists | |
| 4 | Workspace ADMIN gets 200 on PRIVATE board (bypasses board_members check) | |
| 5 | All workspace members get 200 on WORKSPACE board | |
| 6 | Unauthenticated request gets 401/403 on WORKSPACE board | |
| 7 | Unauthenticated request gets 200 on PUBLIC board | |
| 8 | Workspace MEMBER explicitly added to board_members gets 200 on PRIVATE board | |