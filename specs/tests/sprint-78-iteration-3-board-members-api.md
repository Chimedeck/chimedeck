# Sprint 78 — Iteration 3: Board Member Management API Test

Tests for the board member CRUD endpoints (`GET/POST/PATCH/DELETE /api/v1/boards/:id/members`)
and the guest/member workspace boards filter (`GET /api/v1/workspaces/:id/boards`).

Server: http://localhost:3000

---

## Prerequisites

Three workspace users are needed:
- **Alice** — workspace ADMIN (owns the workspace)
- **Bob** — workspace MEMBER
- **Carol** — workspace VIEWER
- **Guest User** — a user who will be invited as a board guest

Alice owns a board called **Test Board** with visibility `PRIVATE`.

---

## Test 1: Add a Board Member (POST /api/v1/boards/:id/members)

### Step 1 — Log in as Alice

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/login" })
mcp_playwright_browser_snapshot()
```

Fill in Alice's credentials and submit the login form.

```
mcp_playwright_browser_click({ element: "email input" })
mcp_playwright_browser_type({ text: "alice@example.com" })
mcp_playwright_browser_click({ element: "password input" })
mcp_playwright_browser_type({ text: "password" })
mcp_playwright_browser_click({ element: "Sign in button" })
mcp_playwright_browser_snapshot()
```

### Step 2 — Navigate to Alice's workspace

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000" })
mcp_playwright_browser_snapshot()
```

Open the workspace, then note the workspace ID and board ID from the URL.

### Step 3 — Add Bob as a board MEMBER via API

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000" })
```

Using the logged-in session, POST to the board members endpoint:

```
POST /api/v1/boards/<boardId>/members
Content-Type: application/json
{ "userId": "<bobUserId>", "role": "MEMBER" }
```

**Expected response (201):**
```json
{
  "data": {
    "id": "<bobUserId>",
    "email": "bob@example.com",
    "name": "Bob",
    "role": "MEMBER"
  }
}
```

### Step 4 — Verify Bob appears in the board members list

```
GET /api/v1/boards/<boardId>/members
```

**Expected response (200):**
```json
{
  "data": [
    { "id": "<aliceUserId>", "role": "ADMIN", ... },
    { "id": "<bobUserId>", "role": "MEMBER", ... }
  ]
}
```

---

## Test 2: Update Board Member Role (PATCH /api/v1/boards/:id/members/:userId)

### Step 1 — Promote Bob to ADMIN

```
PATCH /api/v1/boards/<boardId>/members/<bobUserId>
Content-Type: application/json
{ "role": "ADMIN" }
```

**Expected response (200):**
```json
{
  "data": {
    "id": "<bobUserId>",
    "role": "ADMIN"
  }
}
```

### Step 2 — Try to demote the last remaining ADMIN

After Bob and Alice are both ADMINs, demote Bob back to MEMBER (succeeds because Alice remains):

```
PATCH /api/v1/boards/<boardId>/members/<bobUserId>
Content-Type: application/json
{ "role": "MEMBER" }
```

**Expected response (200):** Updated member with `role: "MEMBER"`.

### Step 3 — Try to demote Alice (last ADMIN) — should fail

```
PATCH /api/v1/boards/<boardId>/members/<aliceUserId>
Content-Type: application/json
{ "role": "MEMBER" }
```

**Expected response (409):**
```json
{
  "name": "last-board-admin",
  "data": { "message": "Cannot demote the last board admin..." }
}
```

---

## Test 3: Remove a Board Member (DELETE /api/v1/boards/:id/members/:userId)

### Step 1 — Remove Bob from the board

```
DELETE /api/v1/boards/<boardId>/members/<bobUserId>
```

**Expected response (200):**
```json
{
  "data": { "boardId": "<boardId>", "userId": "<bobUserId>", "removed": true }
}
```

### Step 2 — Verify Bob no longer appears in the board members list

```
GET /api/v1/boards/<boardId>/members
```

**Expected:** Bob is absent from the `data` array; only Alice appears.

### Step 3 — Try to remove Alice (last ADMIN) — should fail

```
DELETE /api/v1/boards/<boardId>/members/<aliceUserId>
```

**Expected response (409):**
```json
{
  "name": "last-board-admin",
  "data": { "message": "Cannot remove the last board admin..." }
}
```

---

## Test 4: GUEST Cannot Add/Remove Board Members

### Step 1 — Invite Guest User to the board

As Alice (ADMIN), invite the guest user:

```
POST /api/v1/boards/<boardId>/guests
Content-Type: application/json
{ "userId": "<guestUserId>" }
```

**Expected response (201):** Guest access record created.

### Step 2 — Log in as Guest User

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/login" })
```

Fill in the guest user's credentials and log in.

### Step 3 — Attempt to add a member as guest (should fail)

```
POST /api/v1/boards/<boardId>/members
Content-Type: application/json
{ "userId": "<carolUserId>", "role": "MEMBER" }
```

**Expected response (403):** Insufficient role error.

---

## Test 5: Guest Workspace Boards Filter (GET /api/v1/workspaces/:id/boards)

### Step 1 — Create a second board (WORKSPACE visibility)

As Alice (ADMIN):

```
POST /api/v1/workspaces/<workspaceId>/boards
Content-Type: application/json
{ "title": "Public Workspace Board", "visibility": "WORKSPACE" }
```

### Step 2 — List boards as GUEST

While logged in as the Guest User:

```
GET /api/v1/workspaces/<workspaceId>/boards
```

**Expected:** Only `Test Board` (the PRIVATE board they were invited to) appears.
The `Public Workspace Board` is NOT in the response — guests only see their granted boards.

### Step 3 — List boards as regular MEMBER (Bob)

Log in as Bob, then:

```
GET /api/v1/workspaces/<workspaceId>/boards
```

**Expected:** Both boards appear — `Test Board` is not visible to Bob unless he has a `board_members` entry, but `Public Workspace Board` (WORKSPACE visibility) is always visible.

After adding Bob to `Test Board` via POST /members, he should also see `Test Board` in the list.

---

## Test 6: GUEST Cannot See Workspace Member List

While logged in as Guest User:

```
GET /api/v1/workspaces/<workspaceId>/members
```

**Expected response (403):**
```json
{
  "error": { "code": "insufficient-role", "message": "Requires at least VIEWER role" }
}
```

---

## Cleanup

- Remove the guest from the board.
- Delete the test boards.
- Log out all test users.
