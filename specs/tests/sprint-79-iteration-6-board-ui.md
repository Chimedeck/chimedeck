> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 79 Iteration 6 — Workspace Board Grid Visibility Badge + Board Header Avatar Stack

## Overview
Verify that each board card in the workspace grid shows a visibility badge (PRIVATE/WORKSPACE/PUBLIC),
and that the board header's member avatar stack opens the Board Members Panel on click.

## Prerequisites
- Local dev server running at http://localhost:3000
- At least one workspace with multiple boards of different visibility settings
- At least one board with multiple board members

---

## Test 1: Visibility Badge on Board Cards

### Steps

1. Navigate to the workspace boards grid:
```
mcp_playwright_browser_navigate({ url: "http://localhost:3000" })
```

2. Log in as a workspace member if not already authenticated.

3. Navigate to the workspace boards list page (e.g. `/workspaces/<workspaceId>/boards`).

4. Take a snapshot to observe the board cards:
```
mcp_playwright_browser_snapshot({})
```

5. Verify each board card shows a visibility badge.
   - PRIVATE boards should show a badge labelled "Private" with a lock icon (🔒) and a dark/slate background.
   - WORKSPACE boards should show a badge labelled "Workspace" with a group icon (👥) and a blue background.
   - PUBLIC boards should show a badge labelled "Public" with a globe icon (🌐) and a green background.

6. Confirm the badge is visible within the title row of the card alongside the state chip (ACTIVE/ARCHIVED).

### Expected Result
- Every board card displays a correctly coloured and labelled visibility badge.
- The badge has an accessible `aria-label` (e.g. "Board visibility: Private").

---

## Test 2: Member Avatar Stack in Board Header

### Steps

1. Navigate to a board that has at least 2 members:
```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/boards/<boardId>" })
```

2. Take a snapshot of the board header:
```
mcp_playwright_browser_snapshot({})
```

3. Verify the board header shows an avatar stack (coloured circles with member initials).
   - Up to 5 avatars are visible; if more than 5 members, a "+N" overflow badge is shown.
   - If the board has no members yet, a "+ Add members" text link is shown instead.

4. Click the avatar stack / "Add members" button:
```
mcp_playwright_browser_click({ element: "Board members button", ref: "<ref from snapshot>" })
```

5. Take a snapshot to confirm the Board Members Panel has opened:
```
mcp_playwright_browser_snapshot({})
```

6. Verify the panel displays:
   - A "Board Members" heading.
   - The list of existing board members with their roles.
   - An "Add member" typeahead input (if the current user is ADMIN or OWNER).

### Expected Result
- Clicking the avatar stack opens the Board Members Panel as a slide-in overlay.
- The panel lists current board members and allows admins to add/remove members.

---

## Test 3: Avatar Stack Overflow Indicator

### Steps

1. Navigate to a board that has more than 5 board members.

2. Take a snapshot of the board header:
```
mcp_playwright_browser_snapshot({})
```

3. Verify that exactly 5 avatars are shown, followed by a "+N" overflow badge where N equals the remaining member count.

### Expected Result
- No more than 5 individual avatars are shown.
- The overflow badge accurately reflects the hidden member count.

---

## Test 4: Empty Member Stack Shows "Add Members" Prompt

### Steps

1. Navigate to a board where the current user is the only member.

2. Take a snapshot of the board header.

3. Verify the avatar stack area shows a "+ Add members" text prompt (no avatars rendered).

4. Click the prompt to open the members panel and confirm it is empty (only the current user shown) with the add-member input available.

### Expected Result
- The avatar area gracefully handles zero/one member with a clear call-to-action.