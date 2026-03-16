# Sprint 80 · Iteration 8 — Guest Workspace View

## Overview

Verify that a user with workspace role **GUEST** sees a scoped workspace
experience:

- Only boards they have been explicitly granted access to appear in the board
  grid.
- A **"guest"** badge is visible on the active workspace name in the sidebar
  switcher.
- A **"guest"** badge is visible on the Boards nav link in the sidebar.
- A **"guest access"** badge is visible in the board list page heading.
- A **"guest"** badge appears on each board card.
- The **Create Board** button is hidden.
- The **Members** link is hidden from the sidebar.
- Navigating directly to `/workspace/:id` (Members page) shows a 403/access
  restricted notice rather than the member list.

---

## Prerequisites

- The app is running at `http://localhost:3000`.
- A workspace **Acme** exists with at least two boards: `Project Alpha` and
  `Project Beta`.
- A user account `guest@example.com` exists with workspace role `GUEST` and
  board access granted only to `Project Alpha`.
- A regular member account `member@example.com` (role MEMBER) exists in the
  same workspace — used to confirm default behaviour is unaffected.

---

## Test Steps

### 1 — Log in as GUEST user

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/login" })
mcp_playwright_browser_snapshot()
// Fill in guest credentials
mcp_playwright_browser_click({ element: "Email input", ref: "<email-input-ref>" })
mcp_playwright_browser_type({ text: "guest@example.com" })
mcp_playwright_browser_click({ element: "Password input", ref: "<password-input-ref>" })
mcp_playwright_browser_type({ text: "<guest-password>" })
mcp_playwright_browser_click({ element: "Sign in button", ref: "<submit-ref>" })
mcp_playwright_browser_wait_for_url({ url: "**/workspaces**" })
```

### 2 — Verify workspace switcher shows guest badge

```
mcp_playwright_browser_snapshot()
// Expect: the workspace name "Acme" is displayed with a "guest" badge next to it
// in the sidebar switcher button.
// Assert the badge element with text "guest" is visible inside the switcher.
mcp_playwright_browser_click({ element: "Workspace switcher button", ref: "<switcher-ref>" })
mcp_playwright_browser_snapshot()
// Workspace list dropdown should open normally.
mcp_playwright_browser_press_key({ key: "Escape" })
```

### 3 — Navigate to workspace boards

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/workspaces/<workspace-id>/boards" })
mcp_playwright_browser_snapshot()
```

**Expected:**
- Page heading reads **"Boards"** with a **"guest access"** badge beside it.
- **"Create Board"** button is **not** present.
- Only **`Project Alpha`** card is visible (not `Project Beta`).
- The `Project Alpha` card has a **"guest"** badge in its top-right corner.

```
// Assert "guest access" badge is visible in the heading
mcp_playwright_browser_snapshot()
// Assert no "Create Board" button
// Assert exactly 1 board card
// Assert "guest" badge on the board card
```

### 4 — Verify Members link is hidden in sidebar

```
mcp_playwright_browser_snapshot()
// Assert sidebar nav does NOT contain a "Members" link.
// The boards nav link should have a "guest" badge.
```

### 5 — Direct navigation to workspace Members page returns 403 notice

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/workspace/<workspace-id>" })
mcp_playwright_browser_snapshot()
```

**Expected:**
- Page shows an **"Access Restricted"** panel.
- Text states guest users cannot view workspace members.
- Member list and invite button are **not** visible.

```
// Assert "Access Restricted" heading is visible
// Assert "Guest users cannot view workspace members" text is visible
// Assert no member list table/rows
```

### 6 — Guest can still open a granted board

```
mcp_playwright_browser_navigate({ url: "http://localhost:3000/workspaces/<workspace-id>/boards" })
mcp_playwright_browser_snapshot()
mcp_playwright_browser_click({ element: "Project Alpha board card", ref: "<board-card-ref>" })
mcp_playwright_browser_wait_for_url({ url: "**/boards/**" })
mcp_playwright_browser_snapshot()
// Assert the board page for Project Alpha is shown.
```

### 7 — Log out; log in as regular MEMBER — verify normal view

```
mcp_playwright_browser_click({ element: "User menu button", ref: "<user-menu-ref>" })
mcp_playwright_browser_click({ element: "Log out menu item", ref: "<logout-ref>" })
mcp_playwright_browser_wait_for_url({ url: "**/login**" })

// Log in as member@example.com
mcp_playwright_browser_click({ element: "Email input", ref: "<email-input-ref>" })
mcp_playwright_browser_type({ text: "member@example.com" })
mcp_playwright_browser_click({ element: "Password input", ref: "<password-input-ref>" })
mcp_playwright_browser_type({ text: "<member-password>" })
mcp_playwright_browser_click({ element: "Sign in button", ref: "<submit-ref>" })
mcp_playwright_browser_wait_for_url({ url: "**/workspaces**" })

mcp_playwright_browser_navigate({ url: "http://localhost:3000/workspaces/<workspace-id>/boards" })
mcp_playwright_browser_snapshot()
```

**Expected (regular MEMBER):**
- Page heading reads **"Boards"** with **no** guest badge.
- **"Create Board"** button **is** visible.
- Both `Project Alpha` and `Project Beta` cards are visible with **no** "guest"
  badges.
- Sidebar shows the **Members** link.
- Workspace switcher shows workspace name with **no** guest badge.

---

## Assertions Summary

| Scenario | Expected |
|---|---|
| GUEST — sidebar switcher | "guest" badge next to workspace name |
| GUEST — sidebar Boards link | "guest" badge on Boards nav item |
| GUEST — sidebar Members link | **hidden** |
| GUEST — board grid heading | "guest access" badge visible |
| GUEST — Create Board button | **hidden** |
| GUEST — board cards | only granted boards; "guest" badge on each |
| GUEST — Members page (`/workspace/:id`) | "Access Restricted" notice shown |
| MEMBER — board grid | all boards; no guest badges; Create Board visible |
| MEMBER — sidebar Members link | **visible** |
