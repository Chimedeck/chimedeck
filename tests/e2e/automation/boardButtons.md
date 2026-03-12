# E2E Test: Board Buttons (Automation)

## Scope

Playwright MCP tests for Sprint 66 Board Buttons UI — creating, running, and managing BOARD_BUTTON automations from the board header and Automation panel Buttons tab.

---

## Prerequisites

- A board exists with at least one list and several cards.
- The current user is a board member.
- The Automation feature flag is enabled (`AUTOMATION_ENABLED=true`).

---

## Test 1 — Board header shows no board buttons bar when none exist

**Steps:**
1. Navigate to a board that has no BOARD_BUTTON automations.
2. Inspect the board header toolbar.

**Expected:**
- No board button icons appear to the left of the AutomationHeaderButton (BoltIcon).
- The AutomationHeaderButton is still visible.

---

## Test 2 — Create a board button via Buttons tab

**Steps:**
1. Click the Automation header button (BoltIcon) to open the panel.
2. Click the "Buttons" tab.
3. The "Board Buttons" section is visible with an "Add" button.
4. Click "Add" under Board Buttons.
5. A `BoardButtonBuilder` modal appears.
6. Enter the name "Archive all done".
7. Click the `ArchiveBoxIcon` in the icon picker.
8. Leave scope on "board" (default).
9. Click "Add action" and select any available action type.
10. Click "Create button".

**Expected:**
- The modal closes.
- The new "Archive all done" row appears in the Board Buttons section of the Buttons tab.
- An `ArchiveBoxIcon` icon button appears in the board header to the left of the AutomationHeaderButton.

---

## Test 3 — Board button tooltip on hover

**Steps:**
1. Hover over a board button icon in the board header.

**Expected:**
- A tooltip appears above the icon showing the button's name.
- The tooltip disappears when the cursor moves away.

---

## Test 4 — Run a board button (success path)

**Steps:**
1. Click a board button icon in the header.

**Expected:**
- The icon is immediately replaced by a spinning `ArrowPathIcon`.
- The button is disabled while running.
- After the run completes, the icon briefly shows a success state (emerald colour).
- After 3 seconds the button returns to its idle state with the original icon.

---

## Test 5 — Run a board button (error path)

**Steps:**
1. Disable the automation from the Buttons tab (toggle off).
2. Re-enable it but simulate a server error for the run endpoint.
3. Click the board button in the header.

**Expected:**
- After the failed run, the button shows a red colour state.
- After 3 seconds the button returns to idle.

---

## Test 6 — Board button run endpoint respects max 50 cards

**Steps (via API, not UI):**
1. Create a board with 60 cards.
2. POST `/api/v1/boards/:boardId/automation-buttons/:automationId/run` with a board-scope button.

**Expected:**
- Response is `{ data: { runLogId: "...", cardCount: 50, status: "SUCCESS" } }`.
- Only 50 cards are processed (the endpoint caps the run at `MAX_CARDS_PER_RUN = 50`).

---

## Test 7 — Board button scope: list

**Steps:**
1. Create a board button with scope "list" and a specific listId.
2. Run it from the board header.

**Expected:**
- Only cards in the specified list are processed.
- `cardCount` in the response equals the number of non-archived cards in that list (up to 50).

---

## Test 8 — Max 5 board buttons in header; overflow indicator

**Steps:**
1. Create 6 board buttons on the board.

**Expected:**
- Only 5 icon buttons are shown in the board header.
- A "+1" overflow indicator appears to the right of the 5 visible buttons.
- Hovering over the indicator shows `"1 more board button"`.

---

## Test 9 — Buttons tab: enable/disable board button

**Steps:**
1. Open the Automation panel → Buttons tab.
2. Click the enable toggle (CheckCircleIcon) on a board button to disable it.

**Expected:**
- The icon changes to `XCircleIcon` (disabled state).
- The board button is removed from the board header bar (only enabled buttons are shown).
- The `PATCH /api/v1/boards/:boardId/automations/:automationId` call is made with `isEnabled: false`.

---

## Test 10 — Buttons tab: delete board button with confirmation

**Steps:**
1. Open the Automation panel → Buttons tab.
2. Hover over a board button row to reveal the TrashIcon.
3. Click the TrashIcon.

**Expected:**
- A "Delete" confirmation button and a "Cancel" button appear inline.
- Clicking "Cancel" hides the confirmation and does not delete the button.

**Steps (confirm delete):**
1. Click "Delete" after the confirmation appears.

**Expected:**
- The row is removed from the Board Buttons list.
- The board button icon disappears from the board header.
- The `DELETE /api/v1/boards/:boardId/automations/:automationId` endpoint is called.

---

## Test 11 — Non-board-member cannot run board button

**Steps (via API):**
1. POST `/api/v1/boards/:boardId/automation-buttons/:automationId/run` as a user who is not a member of the board.

**Expected:**
- Response: `{ error: { name: "not-a-board-member" } }` with HTTP status 403.

---

## Test 12 — Board button not found returns 404

**Steps (via API):**
1. POST `/api/v1/boards/:boardId/automation-buttons/non-existent-id/run` as a board member.

**Expected:**
- Response: `{ error: { name: "automation-not-found" } }` with HTTP status 404.
