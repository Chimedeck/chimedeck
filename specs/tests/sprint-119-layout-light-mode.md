# Test: Sprint 119 — Layout & Auth Pages in Light Mode

## Overview
Verifies that after the semantic token migration the sidebar, top navigation bar, and
related layout elements render correctly in light mode — no dark panels visible, all
text is readable, and surfaces match the light-mode design tokens.

## Setup
- Navigate to the application and log in as a test user.
- Ensure dark mode is active initially (default).
- Switch to light mode using the ThemeToggle button.

---

## Test 1 — Sidebar renders with light surface in light mode

**Steps:**
1. Switch to light mode using the ThemeToggle button.
2. Locate the sidebar (`[data-testid="sidebar"]`).

**Expected:**
- The sidebar background is light (white or off-white, matching `--bg-base: #f8fafc`). No dark
  slate-900 / slate-800 panels are visible.
- The sidebar border on the right is a light grey (`--border: #e2e8f0`), not the dark slate-700.
- Navigation link text is dark and readable (not white or invisible on a white background).

---

## Test 2 — Top navigation bar renders with light surface in light mode

**Steps:**
1. Confirm light mode is active (from Test 1 or by switching again).
2. Inspect the mobile topbar and desktop topbar divs.

**Expected:**
- The top bar background is white or light (`--bg-surface: #ffffff`), not a dark colour.
- The bottom border of the top bar is light grey (`--border: #e2e8f0`).
- The app name text in the mobile topbar is dark/readable.
- The hamburger icon button is visible with muted text colour, not invisible against background.

---

## Test 3 — Active navigation item is highlighted in light mode

**Steps:**
1. Confirm light mode is active.
2. Navigate to the Boards page so a nav item becomes active.
3. Inspect the active NavItem in the sidebar.

**Expected:**
- The active nav item has a light sunken background (`--bg-sunken: #e2e8f0`), visible against
  the sidebar background.
- The active nav item text is dark/readable.
- Inactive nav items show muted text colour (`--text-muted: #64748b`).

---

## Test 4 — Workspace switcher dropdown renders on light surface

**Steps:**
1. Confirm light mode is active.
2. Click the workspace switcher button in the sidebar.

**Expected:**
- The dropdown appears with a light background (`--bg-surface: #ffffff`).
- The dropdown border is light grey (`--border: #e2e8f0`).
- Workspace name text is dark and readable (`--text-base: #0f172a`).
- Hover states on workspace items show a light overlay (`--bg-overlay: #f1f5f9`), not dark.

---

## Test 5 — User menu renders on light surface in light mode

**Steps:**
1. Confirm light mode is active.
2. Click the user avatar / user menu button at the bottom of the sidebar.

**Expected:**
- The user menu dropdown has a light background (`--bg-surface: #ffffff`).
- The border is light grey.
- Menu items (Profile Settings, API Tokens, Logout) are dark and readable.
- Hover states show a light background, not dark.

---

## Test 6 — 404 Not Found page renders correctly in light mode

**Steps:**
1. Confirm light mode is active.
2. Navigate to a non-existent route (e.g., `/does-not-exist`).

**Expected:**
- The page background is light (`--bg-base: #f8fafc`), not dark grey.
- The "404" heading is visible in a muted colour (`--text-subtle: #94a3b8`).
- The "Page not found" text is readable in muted text colour.
- The "Back to workspaces" link is visible in the link colour (`--text-link: #2563eb`).

---

## Test 7 — Sidebar and top bar render correctly in dark mode (regression)

**Steps:**
1. Switch back to dark mode using the ThemeToggle button.
2. Inspect the sidebar and top bar.

**Expected:**
- The sidebar background is dark (`--bg-base: #0f172a` in dark mode).
- The top bar background is dark (`--bg-surface: #1e293b` in dark mode).
- Navigation text is light and readable (`--text-base: #f1f5f9` in dark mode).
- No light backgrounds are visible in the sidebar or top bar.
