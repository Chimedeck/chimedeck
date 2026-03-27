> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 78 – Iteration 1: board_members Migration & Board Creation Auto-Insert

Verify that after a board is created the creator automatically appears in the board's member list with the ADMIN role.

---

## Prerequisites

- Server running at `http://localhost:3000`
- At least one existing workspace
- A logged-in user session (workspace MEMBER or above)
- Database migration `0040_board_members` has been applied

---

## Test Steps

### 1. Navigate to the application and sign in

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000" })
mcp_playwright_browser_snapshot()
```

Expected: Login page or dashboard is visible.

```
// Fill in credentials and submit if not already logged in
mcp_playwright_browser_click({ element: "Email input", ref: "<email-input-ref>" })
mcp_playwright_browser_type({ text: "testuser@example.com" })
mcp_playwright_browser_click({ element: "Password input", ref: "<password-input-ref>" })
mcp_playwright_browser_type({ text: "password" })
mcp_playwright_browser_click({ element: "Sign in button", ref: "<sign-in-ref>" })
mcp_playwright_browser_snapshot()
```

Expected: User is redirected to workspace dashboard.

---

### 2. Create a new board

Navigate to an existing workspace dashboard.

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000" })
mcp_playwright_browser_snapshot()
```

Click **Create Board** (or equivalent button).

```
mcp_playwright_browser_click({ element: "Create Board button", ref: "<create-board-ref>" })
mcp_playwright_browser_snapshot()
```

Fill in the board title and submit.

```
mcp_playwright_browser_click({ element: "Board title input", ref: "<title-input-ref>" })
mcp_playwright_browser_type({ text: "Sprint 78 Test Board" })
mcp_playwright_browser_click({ element: "Submit / Create button", ref: "<submit-ref>" })
mcp_playwright_browser_snapshot()
```

Expected: The new board appears in the workspace grid or redirects to the board view.

---

### 3. Confirm board creation via API and check board_members

Open browser dev-tools or use the following API call to get the board ID:

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/workspaces/<workspace-id>/boards" })
mcp_playwright_browser_snapshot()
```

Expected: JSON response contains the newly created board. Note its `id` value (e.g. `<board-id>`).

---

### 4. Verify the creator is an ADMIN in board_members via API

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/api/v1/boards/<board-id>/members" })
mcp_playwright_browser_snapshot()
```

Expected JSON shape:

```json
{
  "data": [
    {
      "board_id": "<board-id>",
      "user_id": "<creator-user-id>",
      "role": "ADMIN"
    }
  ]
}
```

Verify:
- The `data` array contains exactly one entry for the newly created board.
- The entry's `user_id` matches the logged-in creator.
- The entry's `role` is `"ADMIN"`.

---

### 5. Verify via direct API call (alternative — using the board settings UI if available)

If a Board Members panel is accessible via the board UI:

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/boards/<board-id>" })
mcp_playwright_browser_snapshot()
```

Look for a **Members** section or avatar stack in the board header.

```
mcp_playwright_browser_click({ element: "Members / Avatar Stack", ref: "<members-ref>" })
mcp_playwright_browser_snapshot()
```

Expected: Creator appears in the members list with the label **Admin**.

---

## Acceptance Criteria

| # | Criterion | Pass / Fail |
|---|-----------|-------------|
| 1 | Board is created successfully (201 response or board appears in UI) | |
| 2 | `board_members` table has one row for the new board | |
| 3 | That row has `user_id` matching the creator | |
| 4 | That row has `role = 'ADMIN'` | |
| 5 | If board or member insert fails, neither record is persisted (transaction rollback) | |