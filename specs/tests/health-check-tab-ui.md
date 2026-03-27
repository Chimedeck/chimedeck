> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Health Check Tab UI — E2E Tests

> Playwright MCP markdown tests for the Health Check Tab UI (Sprint 116).
> Covers: open tab (empty state), add preset service, add custom URL, manual refresh,
> auto-refresh countdown, timer pause on tab switch, remove service, feature-flag gating,
> amber dot for slow probes, red dot for timeouts.

---

## Setup

### Register and authenticate as a board member

- Navigate to `http://localhost:5173`
- If not logged in, go to `/register`
- Fill in name field with `HC UI Test User`
- Fill in email field with `hc-ui-test@test.local`
- Fill in password field with `Password123!`
- Submit the registration form
- Verify the dashboard page loads

### Create a workspace and board

- Navigate to `http://localhost:5173`
- Click "Create workspace" or find the workspace creation button
- Fill in the workspace name with `HC UI Test Workspace`
- Submit to create the workspace
- Click "Create board" or equivalent
- Fill in board name with `HC UI Test Board`
- Submit to create the board
- Note the board ID from the URL (format: `/boards/<boardId>`)
- Store it as `boardId`

---

## Test 1 (AC-1): Opening the Health Check tab shows empty state when no services exist

- Navigate to `http://localhost:5173/boards/<boardId>`
- Verify the board header tab bar is visible
- Verify a tab labelled `"Health Check"` is present in the tab bar
- Click the `"Health Check"` tab
- Verify the URL changes to include `?tab=health-check`
- Verify the Health Check panel is visible
- Verify there are no service rows rendered
- Verify an empty state illustration or icon is displayed (e.g. HeartIcon)
- Verify the text `"No services monitored yet"` is visible
- Verify the text `"Add a service URL to start tracking its availability."` is visible
- Verify an `"+ Add your first service"` call-to-action button is visible inside the empty state area

---

## Test 2 (AC-2): Board member adds a preset service — entry appears and auto-probe fires

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Verify the Health Check tab panel is active
- Click the `"+ Add"` button in the Health Check header
- Verify the Add Service modal opens
- Verify a mode segmented control with `"Preset service"` and `"Custom URL"` options is visible
- Verify `"Preset service"` mode is selected by default
- Verify a preset dropdown is rendered and contains at least one option
- Click the preset dropdown and select the first available option (e.g. `"Stripe API"`)
- Verify the name field is auto-filled with the preset service name (e.g. `"Stripe API"`)
- Verify the URL field is populated and is read-only (not editable)
- Click the `"Add"` or `"Confirm"` submit button
- Verify the modal closes
- Verify a new row appears at the bottom of the service list with the preset service name (e.g. `"Stripe API"`)
- Verify the row's status dot is initially gray (`bg-gray-300`) indicating it has never been probed
- Verify the response time column shows `"—"` for the new row
- Wait up to 15 seconds for the background auto-probe to complete
- Verify the status dot changes from gray to green (`bg-green-500`), amber (`bg-amber-400`), or red (`bg-red-500`) once the probe result arrives
- Verify the response time column is updated from `"—"` to a value (e.g. `"120 ms"`, `"Timeout"`, or `"Error"`)
- Store the new row's service name as `presetServiceName`

---

## Test 3 (AC-3): Board member adds a custom URL — entry appears with gray dot, then updates

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Click the `"+ Add"` button in the Health Check header
- Verify the Add Service modal opens
- Click the `"Custom URL"` mode option in the segmented control
- Verify the URL text input field is now visible and editable
- Verify the name text input field is visible and editable
- Fill in the URL field with `https://httpbin.org/status/200`
- Verify the name field is auto-filled with the hostname (e.g. `"httpbin.org"`) as a default
- Clear the name field and type `My Custom API`
- Click the `"Add"` or `"Confirm"` submit button
- Verify the modal closes
- Verify a new row labelled `"My Custom API"` appears in the service list
- Verify the URL cell shows `"https://httpbin.org/status/200"` in subdued text
- Verify the status dot is initially gray
- Wait up to 15 seconds for the auto-probe to complete
- Verify the status dot updates to green, amber, or red
- Store the new row's element or identifier as `customRowEntry`

---

## Test 4 (AC-3 — error path): Switching mode in the modal clears form state

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Click the `"+ Add"` button
- Verify the Add Service modal opens with `"Preset service"` mode selected
- Select a preset from the dropdown to populate the name and URL fields
- Click the `"Custom URL"` mode option in the segmented control
- Verify the name field is cleared (empty or reset)
- Verify the URL field is cleared (empty or reset)
- Click the `"Preset service"` mode option to switch back
- Verify the form state is reset (no previously selected preset remains)
- Close the modal (click Cancel or press Escape)

---

## Test 5 (AC-3 — duplicate error): Adding a duplicate URL shows inline error

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Click the `"+ Add"` button
- Click `"Custom URL"` mode
- Fill in the URL field with `https://httpbin.org/status/200` (same URL added in Test 3)
- Fill in the name field with `Duplicate Check`
- Click the `"Add"` or `"Confirm"` submit button
- Verify the modal does NOT close
- Verify an inline error message `"This URL is already being monitored"` is visible near the URL field
- Close the modal

---

## Test 6 (AC-4): Manual Refresh button probes all services and updates "Last checked"

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Verify the Health Check tab panel is active and shows at least one service row
- Note the current value of the `"Last checked:"` timestamp text
- Click the `"↻ Refresh"` button in the Health Check header
- Verify the Refresh button shows a spinning icon and is disabled while probing
- Verify each service row's status dot shows a pulse animation while probing
- Wait up to 30 seconds for the probing to complete
- Verify the Refresh button is re-enabled and no longer spinning after probing completes
- Verify the `"Last checked:"` timestamp has changed to `"just now"` or a more recent relative time
- Verify the pulse animation on the status dots has stopped

---

## Test 7 (AC-5): Auto-refresh fires after 60 seconds and countdown resets

> **Note:** This test requires waiting ~60 seconds. The countdown display confirms the timer is running correctly without requiring a full 60-second wait for most assertions.

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Verify the Health Check tab panel is active and shows at least one service row
- Verify a countdown text is visible below the header in subdued text (e.g. `"Next check in: 59s"` or similar)
- Verify the countdown number decreases over time (check at 5s intervals for at least 3 readings)
- Wait for the countdown to reach approximately 0 (allow up to 65 seconds total)
- Verify that the auto-refresh fires: the `"Last checked:"` timestamp updates and the countdown resets to approximately `60s`
- Verify no manual interaction was required to trigger the refresh

---

## Test 8 (AC-6): Auto-refresh timer pauses when user navigates away from the tab

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Verify the countdown text is visible and decreasing
- Note the countdown value (e.g. `"Next check in: 55s"`)
- Click another board tab (e.g. `"Board"`) to switch away from the Health Check tab
- Wait 10 seconds
- Click the `"Health Check"` tab to return
- Verify the countdown value has NOT decreased by approximately 10 seconds (timer was paused)
- Verify the countdown resumes from approximately where it left off (within a few seconds tolerance)

---

## Test 9 (AC-7): Board member removes a service — row disappears from the list

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Verify at least one service row is visible (e.g. `"My Custom API"` from Test 3)
- Hover over the `"My Custom API"` row
- Verify the remove button (TrashIcon or `×`) becomes visible on hover
- Click the remove button for the `"My Custom API"` row
- Verify a confirmation dialog or prompt appears asking to confirm deletion
- Confirm the deletion
- Verify the `"My Custom API"` row is no longer visible in the service list
- Verify the DELETE request was sent to `/api/v1/boards/<boardId>/health-checks/<id>`

---

## Test 10 (AC-8): Health Check tab is not rendered when HEALTH_CHECK_ENABLED is false

> **Pre-condition:** Set environment variable `HEALTH_CHECK_ENABLED=false` and restart the server.
> If the server cannot be restarted in this test run, skip this test and mark it as a manual verification step.

- Navigate to `http://localhost:5173/boards/<boardId>`
- Verify the board header tab bar is visible
- Verify the tab labelled `"Health Check"` is NOT present in the tab bar (hidden, not just disabled)
- Attempt to navigate directly to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Verify the Health Check tab panel is NOT rendered (either redirected to default tab or tab content not shown)

---

## Test 11 (AC-9): Slow probe result shows amber dot with correct tooltip

> **Note:** This test may require a mock endpoint that responds slowly (≥ 1000 ms),
> or can be verified against a real slow endpoint if available.
> If no slow endpoint is accessible, verify amber logic using the backend probe API directly
> and confirm the UI reflects the amber `latestResult` correctly.

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Identify a service row whose latest probe result has `status: "amber"` (slow response)
  - If none exists, use the backend API to add a service whose URL is known to respond slowly,
    then probe it via `POST /api/v1/boards/<boardId>/health-checks/<id>/probe`
    and confirm the response has `status: "amber"` and `responseTimeMs >= 1000`
  - Reload the Health Check tab
- Verify the status dot for that row is amber/yellow (`bg-amber-400` or equivalent)
- Hover over the status dot for the amber row
- Verify a tooltip appears containing:
  - The HTTP status code (e.g. `"200 OK"`)
  - The response time in milliseconds (e.g. `"1 340 ms"`)
  - The word `"(slow)"` in the tooltip text
- Verify the tooltip format matches `"200 OK · Xs (slow)"` (where X is the response time)

---

## Test 12 (AC-10): Timeout probe result shows red dot with "Request timed out" tooltip

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Identify a service row whose latest probe result has `status: "red"` and `errorMessage` indicating a timeout
  - If none exists, use the backend API to add a service at an unreachable URL,
    probe it via `POST /api/v1/boards/<boardId>/health-checks/<id>/probe`,
    and confirm the response has `status: "red"` and `errorMessage` contains `"timed out"` or `"timeout"`
  - Reload the Health Check tab
- Verify the status dot for that row is red (`bg-red-500` or equivalent)
- Hover over the status dot for the red/timeout row
- Verify a tooltip appears containing the text `"Request timed out"`

---

## Test 13: Gray dot tooltip for never-probed service

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Add a new custom service via the `"+ Add"` button before the auto-probe has time to complete
  (or temporarily disable auto-probe by adding while network is offline / before any probe fires)
- Identify a row whose status dot is gray (never probed)
- Hover over the gray status dot
- Verify a tooltip appears with the text `"Not yet checked — click ↻ to probe"`

---

## Test 14: Status dot accessibility — aria-label is set correctly

- Navigate to `http://localhost:5173/boards/<boardId>?tab=health-check`
- Verify at least one service row with a green status dot is visible (after probing)
- Inspect the green status dot element
- Verify it has an `aria-label` attribute that includes `"Status: green"` and the HTTP status and timing information (e.g. `"Status: green — 200 OK, 120ms"`)
- Verify the `"Health Check"` tab button has `role="tab"`
- Inspect a remove button in any row
- Verify the remove button has an `aria-label` containing `"Remove "` followed by the service name (e.g. `"Remove Stripe API"`)
- Verify the countdown element has `aria-live="polite"`

---

## Summary of Acceptance Criteria Coverage

| AC | Test(s) |
|----|---------|
| AC-1 — Open tab; empty state when no services | Test 1 |
| AC-2 — Add preset service; auto-probe fires; dot updates | Test 2 |
| AC-3 — Add custom URL; auto-probe fires; dot updates; duplicate error | Tests 3, 4, 5 |
| AC-4 — Manual refresh; spinner; "Last checked: just now" | Test 6 |
| AC-5 — Auto-refresh fires after 60s; countdown resets | Test 7 |
| AC-6 — Tab inactive; auto-refresh timer pauses | Test 8 |
| AC-7 — Remove service; row disappears; DELETE called | Test 9 |
| AC-8 — HEALTH_CHECK_ENABLED=false; tab hidden | Test 10 |
| AC-9 — Slow probe → amber dot; tooltip shows "(slow)" | Test 11 |
| AC-10 — Timeout probe → red dot; tooltip "Request timed out" | Test 12 |