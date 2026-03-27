> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 80 – Iteration 7: Guest Invite Flow (Guests Tab in Board Members Panel)

## Overview
Verify that a board admin can open the Board Members Panel, navigate to the Guests tab,
invite a guest by email, see error messages for workspace members, and view the guest list.

## Prerequisites
- The app is running at http://localhost:3000
- A workspace with at least two users exists:
  - **Admin user**: `admin@example.com` / `password123`
  - **Workspace member**: `member@example.com` (MEMBER role in the workspace)
- The admin user has created a board named "Test Board" in the workspace

---

## Test 1 – Guests tab is visible for board admins

### Steps

```
mcp_playwright_browser_navigate("http://localhost:3000")
mcp_playwright_browser_snapshot()
```
> Log in as `admin@example.com`.

```
mcp_playwright_browser_click(ref="<login-email-input>")
mcp_playwright_browser_type(ref="<login-email-input>", text="admin@example.com")
mcp_playwright_browser_click(ref="<login-password-input>")
mcp_playwright_browser_type(ref="<login-password-input>", text="password123")
mcp_playwright_browser_click(ref="<login-submit-button>")
mcp_playwright_browser_snapshot()
```

> Navigate to the workspace page and open "Test Board".

```
mcp_playwright_browser_click(ref="<test-board-card>")
mcp_playwright_browser_snapshot()
```

> Click the member avatar stack in the board header to open the Board Members Panel.

```
mcp_playwright_browser_click(ref="<member-avatar-stack>")
mcp_playwright_browser_snapshot()
```

### Expected
- The Board Members Panel slides in.
- Two tabs are visible: **Members** and **Guests**.

---

## Test 2 – Invite a new guest by email

### Steps (continue from Test 1)

> Click the Guests tab.

```
mcp_playwright_browser_click(ref="<guests-tab-button>")
mcp_playwright_browser_snapshot()
```

### Expected
- The Guests tab is active.
- An email input labelled "Guest email address" is visible.
- An "Invite" button is visible.
- The guest list shows "No guests yet."

> Enter a new email address (not an existing workspace user) and submit.

```
mcp_playwright_browser_click(ref="<guest-email-input>")
mcp_playwright_browser_type(ref="<guest-email-input>", text="newguest@external.com")
mcp_playwright_browser_click(ref="<invite-button>")
mcp_playwright_browser_snapshot()
```

### Expected
- A success message "newguest@external.com invited as a guest." appears.
- The guest list now shows one entry: **newguest** / newguest@external.com.
- A **Remove** button is visible next to the guest row.

---

## Test 3 – Inviting an existing workspace member shows an error

### Steps (continue from Test 2)

> Type the email of the workspace member into the invite field.

```
mcp_playwright_browser_click(ref="<guest-email-input>")
mcp_playwright_browser_type(ref="<guest-email-input>", text="member@example.com")
mcp_playwright_browser_click(ref="<invite-button>")
mcp_playwright_browser_snapshot()
```

### Expected
- An error message is displayed: "This user is already a workspace member and cannot be invited as a guest."
- No new guest appears in the list.

---

## Test 4 – Inviting the same guest a second time shows a duplicate error

### Steps (continue from Test 3)

> Invite `newguest@external.com` again.

```
mcp_playwright_browser_click(ref="<guest-email-input>")
mcp_playwright_browser_type(ref="<guest-email-input>", text="newguest@external.com")
mcp_playwright_browser_click(ref="<invite-button>")
mcp_playwright_browser_snapshot()
```

### Expected
- An error message is displayed: "This user is already a guest on this board."
- The guest list still shows one entry.

---

## Test 5 – Remove a guest

### Steps (continue from Test 4)

> Click the Remove button next to `newguest@external.com`.

```
mcp_playwright_browser_click(ref="<remove-guest-button>")
mcp_playwright_browser_snapshot()
```

### Expected
- The guest is removed from the list.
- The guest list shows "No guests yet."

---

## Test 6 – Guests tab not visible for non-admin board members (read-only mode)

### Steps

> Log out and log in as a regular board member (non-ADMIN role).

```
mcp_playwright_browser_navigate("http://localhost:3000/logout")
mcp_playwright_browser_navigate("http://localhost:3000")
mcp_playwright_browser_click(ref="<login-email-input>")
mcp_playwright_browser_type(ref="<login-email-input>", text="member@example.com")
mcp_playwright_browser_click(ref="<login-password-input>")
mcp_playwright_browser_type(ref="<login-password-input>", text="password123")
mcp_playwright_browser_click(ref="<login-submit-button>")
mcp_playwright_browser_snapshot()
```

> Navigate to "Test Board" and open the Board Members Panel.

```
mcp_playwright_browser_click(ref="<test-board-card>")
mcp_playwright_browser_click(ref="<member-avatar-stack>")
mcp_playwright_browser_snapshot()
```

> Click the Guests tab.

```
mcp_playwright_browser_click(ref="<guests-tab-button>")
mcp_playwright_browser_snapshot()
```

### Expected
- The Guests tab is visible (read-only view).
- The invite email input is **not** visible.
- The guest list is visible but has no Remove buttons.