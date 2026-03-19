# E2E Test: Card Buttons (Automation)

## Scope

Playwright MCP tests for Sprint 66 Card Buttons UI — creating, running, and managing CARD_BUTTON automations from the card detail modal.

---

## Prerequisites

- A board exists with at least one list and one card.
- The current user is a board member.
- The Automation feature flag is enabled (`AUTOMATION_ENABLED=true`).

---

## Test 1 — Card detail modal shows Automation section

**Steps:**
1. Navigate to a board.
2. Click a card to open the card detail modal.
3. Inspect the main column of the modal.

**Expected:**
- An "Automation" section heading (with BoltIcon) is visible in the card modal main column.
- An "Add button" CTA is displayed when no card buttons exist.

---

## Test 2 — Create a new card button

**Steps:**
1. Open the card detail modal.
2. Click "Add button" in the Automation section.
3. A `CardButtonBuilder` modal appears.
4. Enter the name "Send reminder".
5. Click the `StarIcon` in the icon picker grid.
6. Click "Add action" and select any available action type from the picker.
7. Click "Create button".

**Expected:**
- The builder modal closes.
- The new "Send reminder" button appears in the Automation section with the StarIcon.
- No error message is shown.

---

## Test 3 — Run a card button (success path)

**Steps:**
1. Open a card that has at least one card button ("Send reminder").
2. Click the "Send reminder" button.

**Expected:**
- The button immediately shows a spinning `ArrowPathIcon` and "Running…" text.
- The button is disabled while running (cannot be clicked again).
- After the run completes, the button briefly shows a `CheckCircleIcon` and changes to a success style (green border).
- After 3 seconds the button returns to its normal idle state.

---

## Test 4 — Run a card button (error path)

**Steps:**
1. Simulate a server error response for the run endpoint (e.g., by temporarily making the automation disabled from the panel).
2. Open the card modal and click the button.

**Expected:**
- After the failed run, the button shows an `ExclamationCircleIcon` and a red border.
- After 3 seconds the button returns to idle.

---

## Test 5 — Icon picker shows 24 icons

**Steps:**
1. Open CardButtonBuilder (click "Add button").
2. Inspect the icon picker grid.

**Expected:**
- Exactly 24 icon buttons are visible.
- Each icon is clickable.
- Clicking an icon highlights it with a blue ring (aria-pressed="true").
- The currently selected icon shows the blue ring.

---

## Test 6 — Card button builder validation

**Steps:**
1. Open CardButtonBuilder.
2. Leave the name field empty.
3. Click "Create button".

**Expected:**
- The button remains disabled (no form submission occurs).

**Steps:**
1. Enter a name but add no actions.
2. Click "Create button".

**Expected:**
- The button remains disabled.

---

## Test 7 — Card buttons are shared across cards on the same board

**Steps:**
1. Create a card button from card A's modal.
2. Open card B's modal (same board).

**Expected:**
- The card button created from card A is also visible in card B's Automation section.

---

## Test 8 — Archived card disables automation buttons

**Steps:**
1. Archive a card.
2. Open the archived card's modal.

**Expected:**
- The archived card warning banner is visible.
- All card buttons in the Automation section are disabled (cursor-not-allowed).
- "Add button" CTA is also disabled.
