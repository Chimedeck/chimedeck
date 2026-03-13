# Sprint 80 — Iteration 9: Guest Client Permission Guards + Auth-Aware Route Guards

Verifies that GUEST users:
- Cannot see board settings or member management controls on a board
- Can still create, edit, and delete cards on boards they are granted access to
- Are redirected away from the workspace members route (`/workspace/:id`)

Server: http://localhost:3000

---

## Prerequisites

- A workspace exists with at least two users:
  - **Alice** (workspace ADMIN) — email `alice@example.com`, password `password123`
  - **Bob** (workspace GUEST) — email `bob@example.com`, password `password123`
- Alice has invited Bob as a workspace GUEST via the Guests tab in the Board Members Panel on a board called **"Project Alpha"**.
- Bob has been granted access to "Project Alpha" with board role MEMBER.
- Bob does NOT have access to any other boards.

---

## Test 1 — GUEST cannot see board settings or member controls

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/login" })
```

Log in as Bob (the GUEST user):
```
mcp_playwright_browser_snapshot()
// Fill in credentials
mcp_playwright_browser_fill({ selector: "input[name='email']", value: "bob@example.com" })
mcp_playwright_browser_fill({ selector: "input[name='password']", value: "password123" })
mcp_playwright_browser_click({ selector: "button[type='submit']" })
```

Wait for redirect to workspaces list, then navigate to the board:
```
mcp_playwright_browser_snapshot()
// Find and click on a workspace that has "Project Alpha"
// Then navigate to the board (via /workspaces/:workspaceId/boards or direct link)
mcp_playwright_browser_navigate({ url: "http://localhost:3000/boards/<project-alpha-board-id>" })
mcp_playwright_browser_snapshot()
```

**Assert**: The board header does NOT contain:
- The member avatar stack (no avatar circles)
- The `···` (ellipsis) settings menu button

```
mcp_playwright_browser_snapshot()
// Verify no element with aria-label "Board settings" is present
// Verify no MemberAvatarStack is visible
```

Expected: No settings button and no member avatar stack appear in the board header.

---

## Test 2 — GUEST cannot open board settings or members panel

While still logged in as Bob on the "Project Alpha" board:

```
mcp_playwright_browser_snapshot()
// Confirm there is no button with aria-label "Board settings"
// Confirm there is no button with aria-label "Board members" or similar
```

Attempt to verify that BoardSettings and BoardMembersPanel are not rendered:
```
mcp_playwright_browser_snapshot()
// No dialog with aria-label "Board Settings" or "Board Members" should appear
```

Expected: The panels cannot be opened because the controls to open them are hidden.

---

## Test 3 — GUEST can create a card

While still logged in as Bob on the "Project Alpha" board:

```
mcp_playwright_browser_snapshot()
// Find the first list and click the "Add card" / "+ Add" button
mcp_playwright_browser_click({ selector: "[aria-label='Add card']" })
// Or look for a "+ Add a card" link in the first list
mcp_playwright_browser_snapshot()
// Type a card title
mcp_playwright_browser_fill({ selector: "textarea[placeholder*='card title'], input[placeholder*='card title']", value: "Guest test card" })
mcp_playwright_browser_click({ selector: "button[type='submit'], button:has-text('Add card')" })
mcp_playwright_browser_snapshot()
```

Expected: A new card titled "Guest test card" appears in the list.

---

## Test 4 — GUEST can edit a card

Click on the newly created "Guest test card" to open the card modal:
```
mcp_playwright_browser_click({ selector: "[data-testid='card-Guest test card'], [aria-label*='Guest test card']" })
mcp_playwright_browser_snapshot()
// Edit the card title or description
mcp_playwright_browser_fill({ selector: "textarea[aria-label*='description'], [data-testid='card-description']", value: "Updated by guest" })
mcp_playwright_browser_snapshot()
// Save or close
mcp_playwright_browser_keyboard({ key: "Escape" })
mcp_playwright_browser_snapshot()
```

Expected: Card edits are saved without error.

---

## Test 5 — GUEST can delete a card

Right-click or use the card menu on "Guest test card" to delete it:
```
mcp_playwright_browser_snapshot()
// Open card context menu or delete button
mcp_playwright_browser_click({ selector: "[aria-label='Delete card'], button:has-text('Delete')" })
mcp_playwright_browser_snapshot()
// Confirm deletion if a dialog appears
mcp_playwright_browser_click({ selector: "button:has-text('Delete'), button:has-text('Confirm')" })
mcp_playwright_browser_snapshot()
```

Expected: The card is removed from the board.

---

## Test 6 — GUEST is redirected away from workspace members route

Still logged in as Bob, attempt to navigate directly to the workspace members page:
```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/workspace/<workspace-id>" })
mcp_playwright_browser_snapshot()
```

Expected: Bob is **redirected** to `/workspaces/<workspace-id>/boards` (or `/workspaces` if the workspace ID cannot be resolved).  
The workspace members/settings page is NOT rendered for Bob.

Verify the current URL is NOT `/workspace/<workspace-id>`:
```
mcp_playwright_browser_snapshot()
// URL should be /workspaces/:id/boards or /workspaces
// No member management UI should be visible
```

---

## Test 7 — Regular member still sees controls (regression check)

Log out as Bob, log in as Alice:
```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/login" })
mcp_playwright_browser_fill({ selector: "input[name='email']", value: "alice@example.com" })
mcp_playwright_browser_fill({ selector: "input[name='password']", value: "password123" })
mcp_playwright_browser_click({ selector: "button[type='submit']" })
mcp_playwright_browser_snapshot()
// Navigate to the same board
mcp_playwright_browser_navigate({ url: "http://localhost:3000/boards/<project-alpha-board-id>" })
mcp_playwright_browser_snapshot()
```

Expected:
- The `···` settings menu button **is visible** in the board header for Alice.
- The member avatar stack **is visible** for Alice.
- Alice can click `···` and see "Board settings" option.
- Alice can navigate to `/workspace/<workspace-id>` without being redirected.

```
mcp_playwright_browser_click({ selector: "button[aria-label='Board settings']" })
mcp_playwright_browser_snapshot()
// Board settings menu should be open with "Board settings", "Archive", "Delete board"
```
