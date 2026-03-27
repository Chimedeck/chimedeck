> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 79 — Iteration 4: Board Settings Visibility Selector

Tests that the Visibility Selector appears for board admins, allows changing visibility, and is hidden for non-admins.

## Prerequisites

- App running at http://localhost:3000
- At least two user accounts:
  - **Admin user**: board ADMIN (e.g. admin@example.com / password)
  - **Member user**: board MEMBER (e.g. member@example.com / password)
- A test board exists that both users are members of (admin user is ADMIN, member user is MEMBER)

---

## Test 1 — Visibility selector is visible to board ADMINs

### Steps

1. Navigate to the login page
   ```
   mcp_playwright_browser_navigate url="http://localhost:3000"
   ```

2. Log in as the admin user
   ```
   mcp_playwright_browser_snapshot
   # Fill email field
   mcp_playwright_browser_click selector="[data-testid='email-input']"
   mcp_playwright_browser_type text="admin@example.com"
   mcp_playwright_browser_click selector="[data-testid='password-input']"
   mcp_playwright_browser_type text="password"
   mcp_playwright_browser_click selector="[type='submit']"
   ```

3. Navigate to the test board
   ```
   mcp_playwright_browser_snapshot
   # Click the test board card
   mcp_playwright_browser_click selector="[data-testid='board-card']"
   ```

4. Open board settings
   ```
   mcp_playwright_browser_snapshot
   # Click the "⋯" or settings button in the board header
   mcp_playwright_browser_click selector="[aria-label='Open board menu']"
   # Then click 'Settings' or the settings icon
   mcp_playwright_browser_click selector="[data-testid='open-settings']"
   ```

5. Verify the visibility selector is rendered
   ```
   mcp_playwright_browser_snapshot
   # Expect the "Visibility" heading and the three radio options to be present
   ```

### Expected Outcome

- The Board Settings panel opens
- A "VISIBILITY" label is shown with three radio options: Private, Workspace, Public
- The current visibility is pre-selected

---

## Test 2 — Admin can change board visibility

### Steps (continuing from Test 1, settings panel open as admin)

1. Click the "Public" radio option
   ```
   mcp_playwright_browser_click selector="input[name='board-visibility'][value='PUBLIC']"
   ```

2. Wait briefly for the API call to complete
   ```
   mcp_playwright_browser_snapshot
   ```

3. Close and reopen board settings to verify the change persisted
   ```
   mcp_playwright_browser_click selector="[aria-label='Close settings panel']"
   mcp_playwright_browser_click selector="[data-testid='open-settings']"
   mcp_playwright_browser_snapshot
   ```

### Expected Outcome

- The "Public" radio is checked after clicking
- Reopening settings shows "Public" still selected (persisted via API)
- No error toast is shown

---

## Test 3 — Visibility selector is hidden for non-admin board members

### Steps

1. Log out the admin user
   ```
   mcp_playwright_browser_navigate url="http://localhost:3000"
   mcp_playwright_browser_snapshot
   mcp_playwright_browser_click selector="[data-testid='user-menu']"
   mcp_playwright_browser_click selector="[data-testid='logout']"
   ```

2. Log in as the member user
   ```
   mcp_playwright_browser_navigate url="http://localhost:3000"
   mcp_playwright_browser_snapshot
   mcp_playwright_browser_click selector="[data-testid='email-input']"
   mcp_playwright_browser_type text="member@example.com"
   mcp_playwright_browser_click selector="[data-testid='password-input']"
   mcp_playwright_browser_type text="password"
   mcp_playwright_browser_click selector="[type='submit']"
   ```

3. Navigate to the same test board
   ```
   mcp_playwright_browser_snapshot
   mcp_playwright_browser_click selector="[data-testid='board-card']"
   ```

4. Open board settings
   ```
   mcp_playwright_browser_snapshot
   mcp_playwright_browser_click selector="[aria-label='Open board menu']"
   mcp_playwright_browser_click selector="[data-testid='open-settings']"
   ```

5. Verify the visibility selector is NOT rendered
   ```
   mcp_playwright_browser_snapshot
   # "VISIBILITY" label and radio inputs should NOT be present in the panel
   ```

### Expected Outcome

- The Board Settings panel opens without the Visibility section
- Background picker and Plugins button are still visible (non-admin features)
- No "VISIBILITY" heading or radio inputs in the DOM for the member user

---

## Test 4 — API error on visibility change rolls back selection

### Steps (as admin user)

1. Simulate a network failure by throttling or using browser devtools to block `/api/v1/boards/:id`

2. In the settings panel, click a different visibility option
   ```
   mcp_playwright_browser_click selector="input[name='board-visibility'][value='PRIVATE']"
   ```

3. Observe the optimistic update, then the rollback when the API returns an error
   ```
   mcp_playwright_browser_snapshot
   ```

### Expected Outcome

- The radio briefly shows the new selection (optimistic update)
- After the API error, the radio reverts to the previous selection
- No crash; panel remains open