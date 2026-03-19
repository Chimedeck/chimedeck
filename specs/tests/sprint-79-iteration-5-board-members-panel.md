# Sprint 79 — Iteration 5: Board Members Panel Tests

## Overview

These tests verify the Board Members Panel:
- An admin can add a workspace member to a board
- An admin can change a member's role
- An admin can remove a member
- The last-admin guard prevents removing the final ADMIN

Prerequisite: Two users exist — User A (board creator/admin) and User B (workspace member, not yet on board).
The board's Members Panel must be reachable. (Trigger via a "Members" button in the board header or settings — wired in a later iteration; for now open the panel directly by rendering `BoardMembersPanel`.)

---

## Test 1: Board Members Panel is visible to board admin

```
mcp_playwright_browser_navigate { "url": "http://localhost:3000" }
```
Log in as User A (the board admin).
```
mcp_playwright_browser_snapshot {}
```
Navigate to a board you created:
```
mcp_playwright_browser_navigate { "url": "http://localhost:3000/boards/<boardId>" }
mcp_playwright_browser_snapshot {}
```
Open the board settings or members panel (via any trigger that renders `BoardMembersPanel`).

**Expected:** The panel slides in with a "Board Members" heading and an "Add member" section.

---

## Test 2: Add a workspace member to the board

In the "Add member" typeahead input, type the name or email of User B.
```
mcp_playwright_browser_click { "element": "Search workspace members input" }
mcp_playwright_browser_type { "text": "user-b-name-or-email" }
mcp_playwright_browser_snapshot {}
```
**Expected:** A dropdown appears listing User B.

Click User B in the dropdown.
```
mcp_playwright_browser_click { "element": "User B dropdown option" }
mcp_playwright_browser_snapshot {}
```
**Expected:** User B appears in the member list below the input. The typeahead input is cleared.

---

## Test 3: Change a member's role

Find User B's row in the member list. Change the role dropdown from "Member" to "Viewer".
```
mcp_playwright_browser_click { "element": "Change role for User B select" }
mcp_playwright_browser_select_option { "element": "Change role for User B select", "value": "VIEWER" }
mcp_playwright_browser_snapshot {}
```
**Expected:** User B's role in the list shows "Viewer". A PATCH request is fired to `/api/v1/boards/:boardId/members/:userId`.

---

## Test 4: Remove a member

Click the remove (✕) button on User B's row.
```
mcp_playwright_browser_click { "element": "Remove User B button" }
mcp_playwright_browser_snapshot {}
```
**Expected:** User B no longer appears in the member list. A DELETE request is fired to `/api/v1/boards/:boardId/members/:userId`.

---

## Test 5: Last-admin guard — cannot remove the only admin

Ensure User A is the only ADMIN on the board (User B was removed in Test 4).

The remove button on User A's row should be disabled.
```
mcp_playwright_browser_snapshot {}
```
**Expected:**
- User A's row has a ✕ button that is visually dimmed / `disabled`.
- Hovering shows tooltip "Cannot remove the last board admin".
- Clicking the button does nothing (no DELETE request is fired).

---

## Test 6: Non-admin member sees read-only list

Log in as User B (workspace member, not a board admin).
```
mcp_playwright_browser_navigate { "url": "http://localhost:3000" }
```
Open the board members panel on a board where User B is a MEMBER.
```
mcp_playwright_browser_snapshot {}
```
**Expected:**
- The "Add member" section is not visible.
- Existing members are listed but there are no role dropdowns or remove buttons.

---

## Test 7: Typeahead excludes already-added members and guests

While logged in as User A (admin), open the Add member input and type a few characters.
```
mcp_playwright_browser_click { "element": "Search workspace members input" }
mcp_playwright_browser_type { "text": "a" }
mcp_playwright_browser_snapshot {}
```
**Expected:**
- Members already on the board do NOT appear in the typeahead dropdown.
- Workspace members with GUEST role do NOT appear in the typeahead dropdown.
