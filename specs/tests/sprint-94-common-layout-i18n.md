# Sprint 94 — Common + Layout i18n — Playwright MCP Test Plan

## Overview

Verify that all UI copy in `src/common/` and `src/layout/` components renders from
`src/common/translations/en.json` and that no hardcoded English strings remain across
all extensions updated in Sprints 93–94.

---

## Prerequisites

- Dev server running at `http://localhost:3000`
- At least one board with cards exists
- A logged-in admin/member session

---

## Test 1: Sidebar Navigation — Labels from Translations

### Steps

1. Navigate to `http://localhost:3000`.
2. Inspect the left sidebar (`<nav aria-label="Main navigation">`).
3. Confirm the nav element's `aria-label` is **"Main navigation"** (not "Sidebar").
4. Confirm the sidebar collapse/expand button shows `aria-label="Collapse sidebar"` when expanded.
5. Click the collapse button; confirm `aria-label` changes to **"Expand sidebar"**.
6. Confirm nav items show the correct labels from translations: **"Boards"**, **"Members"**, **"All Workspaces"**, **"Plugin Docs"**.
7. If admin user is present, confirm the invite button shows **"Invite External User"**.

### Expected Values (from `src/common/translations/en.json`)

| Key | Expected text |
|-----|---------------|
| `Layout.sidebarAriaLabel` | `Main navigation` |
| `Sidebar.expandAriaLabel` | `Expand sidebar` |
| `Sidebar.collapseAriaLabel` | `Collapse sidebar` |
| `Sidebar.pluginDocsLabel` | `Plugin Docs` |
| `Sidebar.inviteExternalUser` | `Invite External User` |
| `Sidebar.guestBadge` | `guest` |

---

## Test 2: Top Bar — Open Sidebar Aria Label

### Steps

1. On a mobile viewport (or resize browser to < 768 px), navigate to `http://localhost:3000`.
2. Inspect the hamburger button in the top bar.
3. Confirm `aria-label="Open sidebar"` is rendered on the button.

### Expected Values

| Key | Expected text |
|-----|---------------|
| `Layout.openSidebarAriaLabel` | `Open sidebar` |

---

## Test 3: Mobile Sidebar Drawer — Aria Label

### Steps

1. On mobile viewport, click the hamburger button to open the sidebar drawer.
2. Inspect the dialog element `role="dialog"`.
3. Confirm `aria-label="Navigation"` is set on the dialog.

### Expected Values

| Key | Expected text |
|-----|---------------|
| `Layout.mobileDrawerAriaLabel` | `Navigation` |

---

## Test 4: Search Nav Item and Command Palette

### Steps

1. Click the **Search** nav item in the sidebar.
2. Confirm the label reads **"Search"** (from `Sidebar.searchLabel`).
3. Confirm the aria-label of the button reads **"Search (⌘K)"** (from `Sidebar.searchAriaLabel`).
4. Press `Cmd+K` / `Ctrl+K` to open the command palette.
5. Confirm the dialog `aria-label` is **"Search"**.
6. Confirm the scope tab list `aria-label` is **"Search scope"**.
7. Confirm scope tabs show: **"All"**, **"Boards"**, **"Cards"**.
8. Type a single character and confirm the hint reads **"Type at least 2 characters to search."**.
9. Type a valid query and confirm the **"Searching…"** state appears.
10. Clear results and confirm the empty state text for each scope (e.g., **"No results found."**).
11. Confirm the footer shows **"navigate"**, **"open"**, **"Press Esc to close"** fragments.

### Expected Values

| Key | Expected text |
|-----|---------------|
| `Sidebar.searchLabel` | `Search` |
| `Sidebar.searchAriaLabel` | `Search (⌘K)` |
| `CommandPalette.ariaLabel` | `Search` |
| `CommandPalette.scopeTabsAriaLabel` | `Search scope` |
| `CommandPalette.allScopeLabel` | `All` |
| `CommandPalette.boardScopeLabel` | `Boards` |
| `CommandPalette.cardScopeLabel` | `Cards` |
| `CommandPalette.tooShort` | `Type at least 2 characters to search.` |
| `CommandPalette.searching` | `Searching…` |
| `CommandPalette.allScopeEmpty` | `No results found.` |
| `CommandPalette.footerNavigate` | `navigate` |
| `CommandPalette.footerOpen` | `open` |
| `CommandPalette.footerEscClose` | `to close` |

---

## Test 5: Theme Toggle Aria Label

### Steps

1. Locate the theme toggle button (sun/moon icon) in the top bar.
2. In dark mode, confirm `aria-label="Switch to light mode"`.
3. Click the button to switch to light mode; confirm `aria-label="Switch to dark mode"`.

### Expected Values

| Key | Expected text |
|-----|---------------|
| `Common.switchToLightMode` | `Switch to light mode` |
| `Common.switchToDarkMode` | `Switch to dark mode` |

---

## Test 6: Spinner — Loading Aria Label

### Steps

1. Navigate to a page that triggers a loading spinner (e.g., first page load or workspace switching).
2. Inspect the spinner element `role="status"`.
3. Confirm `aria-label="Loading…"`.

### Expected Values

| Key | Expected text |
|-----|---------------|
| `Common.loadingLabel` | `Loading…` |

---

## Test 7: Toast — Dismiss Button Aria Label

### Steps

1. Trigger a toast notification (e.g., save a change or cause an error).
2. Locate the dismiss (×) button inside the toast.
3. Confirm `aria-label="Dismiss notification"` is present.
4. Confirm the toast region container has `aria-label="Notifications"`.

### Expected Values

| Key | Expected text |
|-----|---------------|
| `Common.dismissNotification` | `Dismiss notification` |
| `Common.toastRegionAriaLabel` | `Notifications` |

---

## Test 8: Error Boundary Fallback

### Steps

1. Simulate a React error (or inspect the ErrorBoundary component directly).
2. Confirm the fallback renders **"Something went wrong. Please reload."** (not a hardcoded string).

### Expected Values

| Key | Expected text |
|-----|---------------|
| `Common.errorBoundaryFallback` | `Something went wrong. Please reload.` |

---

## Test 9: Mention Suggestions Aria Label

### Steps

1. Open a card modal and focus the description textarea.
2. Type `@` followed by at least one character.
3. When the suggestion dropdown appears, inspect the `<ul role="listbox">`.
4. Confirm `aria-label="Mention suggestions"` (from `Mention.ariaList`).

### Expected Values

| Key | Expected text |
|-----|---------------|
| `Mention.ariaList` | `Mention suggestions` |

---

## Test 10: Final Smoke — Zero Hardcoded English Strings

### Steps

Run the following greps from the repository root to confirm zero hardcoded strings remain
in any extension or shared component:

```bash
# Should return no results
grep -rn 'aria-label="[A-Z]' src/common/components/ src/layout/ --include="*.tsx"
grep -rn 'aria-label="[A-Z]' src/extensions/ --include="*.tsx"

# Check for obvious standalone English phrases in JSX
grep -rn '"Cancel"\|"Close"\|"Save"\|"Loading"\|"Confirm"' src/common/ src/layout/ src/extensions/ --include="*.tsx" | grep -v "translations\[" | grep -v "//"
```

**Expected:** All commands return empty output (exit 1 / no matches).
