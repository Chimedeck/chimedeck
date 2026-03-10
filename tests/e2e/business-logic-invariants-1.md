# Business Logic Invariants — E2E Tests

> Tests for Sprint 56 invariants:
> 1. Archived board mutations are blocked (403 `board-is-archived`)
> 2. Workspace must always have at least one OWNER (422 `workspace-must-have-one-owner`)

---

## Setup

```
Navigate to http://localhost:5173
```

---

## Part 1 — Archived Board Read-Only Guard

### 1.1 — Register and create a workspace + board

```
Click "Sign up"
Fill in name "Test User", email "invariant-test@example.com", password "Password123!"
Click "Create account"
```

```
Click "Create workspace"
Fill in workspace name "Invariant WS"
Click "Create"
```

```
Click "Create board"
Fill in board name "Archived Board"
Click "Create"
```

Note the board URL (contains the board ID). We need this board's ID.

### 1.2 — Create a list and a card on the board

```
On the board page, click "Add a list"
Fill in list title "Test List"
Press Enter or click "Add list"
```

```
Click "Add a card" in the "Test List" column
Fill in card title "Test Card"
Press Enter or click "Add card"
```

### 1.3 — Archive the board

```
Click the board settings menu (three-dot icon or "..." near the board title)
Click "Archive board" or "Archive"
Confirm archival in the confirmation dialog
```

Verify the board shows an "Archived" badge or banner.

### 1.4 — Verify PATCH /cards/:id returns 403 board-is-archived

```
Using the API (via curl or browser dev tools):
PATCH /api/v1/cards/<cardId>
Body: { "title": "Should fail" }
Expected response: 403 { "error": { "code": "board-is-archived", "message": "This board is archived and cannot be modified." } }
```

Alternatively navigate to the card detail modal on the archived board:

```
Click on "Test Card" to open the card detail modal
Try to edit the card title by clicking on it and typing a new title
Press Enter or click away
```

Verify that the card title reverts (edit is rejected) and an error message is shown.

### 1.5 — Verify POST /lists/:listId/cards returns 403 board-is-archived

```
On the archived board page, try to click "Add a card" in "Test List"
```

Verify that the add-card form either doesn't open or shows an error when submitted.

```
Using the API:
POST /api/v1/lists/<listId>/cards
Body: { "title": "New card on archived board" }
Expected response: 403 { "error": { "code": "board-is-archived" } }
```

### 1.6 — Verify POST /cards/:id/comments returns 403 board-is-archived

```
Using the API:
POST /api/v1/cards/<cardId>/comments
Body: { "content": "This should fail" }
Expected response: 403 { "error": { "code": "board-is-archived" } }
```

### 1.7 — Verify GET requests still work on archived boards

```
Navigate to the archived board URL
```

Verify the board loads with all lists and cards visible (read is allowed).

```
Using the API:
GET /api/v1/boards/<boardId>/lists
Expected response: 200 with lists array
```

---

## Part 2 — Workspace ≥1 Owner Invariant

### 2.1 — Navigate to workspace settings

```
Navigate to the workspace settings for "Invariant WS"
Click "Members" tab
```

Verify the current user is shown as OWNER.

### 2.2 — Verify DELETE last owner returns 422

```
Using the API:
DELETE /api/v1/workspaces/<workspaceId>/members/<currentUserId>
Expected response: 422 { "error": { "code": "workspace-must-have-one-owner", "message": "A workspace must always have at least one Owner. Promote another member first." } }
```

The member should NOT be removed from the workspace.

### 2.3 — Verify PATCH role change for last owner returns 422

```
Using the API:
PATCH /api/v1/workspaces/<workspaceId>/members/<currentUserId>
Body: { "role": "ADMIN" }
Expected response: 422 { "error": { "code": "workspace-must-have-one-owner" } }
```

The role should remain OWNER.

### 2.4 — Verify role change works when another OWNER exists

```
Invite a second user via:
POST /api/v1/workspaces/<workspaceId>/invitations
Body: { "email": "second-owner@example.com", "role": "OWNER" }
```

(Or register a second user and add them as OWNER via the workspace members UI.)

```
In workspace settings, click the role selector for the second OWNER
Change role to "ADMIN"
```

Verify the role change succeeds (second OWNER demoted to ADMIN).

```
Now change the first (original) OWNER's role to "ADMIN"
```

Verify this also fails with 422 (since after the second member was demoted, the first is again the only OWNER).

### 2.5 — Verify removing the last owner is blocked in the UI

```
In workspace settings, click the remove button ("×" or "Remove") next to the OWNER member
```

Verify that either:
- The remove button is disabled for the last OWNER, OR
- A click shows an error "A workspace must always have at least one Owner"

---

## Cleanup

```
Navigate to account settings
Delete the test account "invariant-test@example.com" if a cleanup option exists
```

---

## Expected API Response Shapes

### 403 — board-is-archived

```json
{
  "error": {
    "code": "board-is-archived",
    "message": "This board is archived and cannot be modified."
  }
}
```

### 422 — workspace-must-have-one-owner

```json
{
  "error": {
    "code": "workspace-must-have-one-owner",
    "message": "A workspace must always have at least one Owner. Promote another member first."
  }
}
```
