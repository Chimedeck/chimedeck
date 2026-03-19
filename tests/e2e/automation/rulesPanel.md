# Automation Rules Panel — Playwright MCP Tests

## Setup

- Base URL: `http://localhost:5173`
- Before each test: log in as a test user and navigate to a board that has no automations.

---

## Test 1: Open the Automation panel via the BoltIcon button

**Steps:**

1. Navigate to `/boards/:boardId` (a valid board the test user owns).
2. Locate the `BoltIcon` button in the board header toolbar (aria-label "Open automation panel" or title "Automation").
3. Click it.

**Expected:**

- A slide-in drawer with the title "Automation" appears on the right side of the screen.
- The "Rules" tab is selected by default.
- The empty state ("No automation rules yet") is visible.

---

## Test 2: Create a rule with one trigger and one action

**Precondition:** Automation panel is open on the Rules tab; no existing rules.

**Steps:**

1. Click the "Create rule" button in the empty state.
2. Verify the RuleBuilder sub-panel is visible with a "New rule" heading.
3. Click the trigger dropdown ("Select a trigger…").
4. Type a search query to filter the list (e.g., "card").
5. Select the first matching trigger type from the dropdown.
6. Verify the trigger picker now shows the selected trigger's label.
7. If dynamic config fields appear, fill in the first required field.
8. Click "Add action".
9. Select the first action type from the ActionPicker dropdown.
10. If a "Configure…" link appears for the action, click it and fill in the first required field.
11. Fill in the "Rule name" input at the bottom with "E2E Test Rule".
12. Click "Save rule".

**Expected:**

- The RuleBuilder closes and the Rules list is shown.
- "E2E Test Rule" appears as the first item in the list.
- The rule row shows the trigger type label and "1 action".
- The enable/disable toggle shows the rule as enabled (green CheckCircleIcon).

---

## Test 3: Toggle enable/disable on a rule

**Precondition:** At least one rule ("E2E Test Rule") exists in the Rules list.

**Steps:**

1. In the "E2E Test Rule" row, click the enable/disable toggle button (currently showing enabled / green).

**Expected:**

- The icon changes to the disabled state (XCircleIcon, grey) immediately (optimistic update).
- No error message is shown.

**Steps (re-enable):**

2. Click the toggle again.

**Expected:**

- The icon returns to the enabled state (green CheckCircleIcon).

---

## Test 4: Delete a rule with confirmation

**Precondition:** "E2E Test Rule" exists in the Rules list.

**Steps:**

1. In the "E2E Test Rule" row, click the delete button (TrashIcon).
2. Observe that the button changes to a red "confirm" state (click again to confirm).
3. Click the delete button a second time.

**Expected:**

- "E2E Test Rule" is removed from the list immediately.
- No error message is shown.
- If this was the last rule, the empty state ("No automation rules yet") is displayed.

---

## Test 5: Cancel rule creation

**Precondition:** Automation panel is open on the Rules tab.

**Steps:**

1. Click "Create rule".
2. The RuleBuilder is shown.
3. Click the back arrow (ArrowLeftIcon) or "Cancel" button.

**Expected:**

- The RuleBuilder closes.
- The Rules list (or empty state) is visible again.
- No new rule was created.

---

## Test 6: "Coming soon" tabs

**Steps:**

1. Open the Automation panel.
2. Click the "Buttons" tab.
3. Click the "Schedule" tab.
4. Click the "Log" tab.

**Expected:**

- Each unimplemented tab shows a "Coming soon" message.
- No error or broken UI state.

---

## Test 7: Reorder actions via drag-and-drop

**Precondition:** RuleBuilder is open. At least two actions have been added.

**Steps:**

1. Click "Add action" and select "Action A" (first action type).
2. Click "Add action" and select "Action B" (second action type).
3. Drag the second action item's drag handle (Bars2Icon) above the first action item.

**Expected:**

- The action list updates: "Action B" is now first, "Action A" is second.
- The visual order persists when "Save rule" is clicked and the rule is reopened for editing.
