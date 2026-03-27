> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Sprint 119 — Containers in Light Mode

## Overview
Verifies that after the container-level semantic token migration, the topbar container
renders correctly in light mode — using light surfaces, readable text, and a ghost-styled
logout button — and continues to work correctly in dark mode.

## Setup
- Navigate to the application and log in as a test user.
- Ensure dark mode is active initially (default app state).

---

## Test 1 — TopbarContainer renders with light surface in light mode

**Steps:**
1. Log in and observe the application is in dark mode.
2. Click the ThemeToggle button to switch to light mode.
3. Locate the topbar (`header` or the top strip containing the app name).

**Expected:**
- The topbar background is a light surface colour (`--bg-surface: #ffffff`), not dark grey.
- The bottom border of the topbar is a light grey (`--border: #e2e8f0`), not white/transparent.
- The app name text is dark and readable (matching `--text-base: #0f172a`), not white.

---

## Test 2 — Logout button in TopbarContainer uses ghost styling in light mode

**Steps:**
1. Ensure light mode is active (from Test 1 or switch again).
2. Locate the "Log out" button in the topbar (visible when logged in).

**Expected:**
- The "Log out" button uses ghost styling: transparent background, muted text colour.
- The button text is readable against the light topbar background.
- No dark `bg-gray-*` or `text-white` styling is visible on the button.

---

## Test 3 — TopbarContainer renders correctly in dark mode

**Steps:**
1. Switch back to dark mode using the ThemeToggle button.
2. Inspect the topbar.

**Expected:**
- The topbar background is a dark surface (`--bg-surface: #1e293b`).
- The bottom border is subtle (`--border: #334155`).
- The app name text is light (`--text-base: #f1f5f9`) and readable against the dark background.
- The "Log out" button text is muted but readable.

---

## Test 4 — Theme persistence after page reload

**Steps:**
1. Switch to light mode.
2. Reload the page.
3. Inspect the topbar.

**Expected:**
- The topbar continues to render with light surface colours after reload (theme preference was persisted).
- No flash of dark styling before the light theme is applied.