# Playwright MCP Tests — Due Date Commands

## Setup

Navigate to a board with the Automation panel available. Open the Automation panel by clicking
the bolt icon in the board header. Click the **Schedule** tab.

---

## Test 1: Create a "2 days before" due date command (≤ 3 steps)

1. Open the Automation panel → Schedule tab.
2. Click the "+ Add" button next to "Due Date Commands"
   (or "Create a due date command" if the empty state is shown).
3. **Step 1 — When:**
   - Assert the heading reads "When should this run?".
   - Select timing: "Before".
   - Set offset value: "2".
   - Set offset unit: "Days".
   - Assert the summary text below reads "2 days before due date".
   - Click "Next".
4. **Step 2 — Actions + Name + Save:**
   - Click "Add action".
   - Select "card.add_label" from the action picker.
   - Configure color: "red".
   - Assert the auto-generated name contains "2 days before due".
   - Click "Save".
5. Assert the new automation appears in the "Due Date Commands" section with summary text
   "2 days before due date".

---

## Test 2: Create an "on the due date" command

1. Open the Automation panel → Schedule tab.
2. Click "+ Add" in the Due Date Commands section.
3. **Step 1 — When:**
   - Select timing: "On".
   - Assert that offset value and unit fields are hidden.
   - Assert summary text reads "On the due date".
   - Click "Next".
4. **Step 2 — Actions + Name + Save:**
   - Add at least one action.
   - Click "Save".
5. Assert the new item appears with summary "On the due date".

---

## Test 3: Create an "after due date" command

1. Open the Automation panel → Schedule tab.
2. Click "+ Add" in the Due Date Commands section.
3. **Step 1 — When:**
   - Select timing: "After".
   - Set offset value: "1".
   - Set offset unit: "Hours".
   - Assert summary text reads "1 hour after due date".
   - Click "Next".
4. Add an action, set name, click "Save".
5. Assert the row summary reads "1 hour after due date".

---

## Test 4: Due date command summary uses singular for value = 1

1. Create a due date command with offset value "1" and unit "Days".
2. Assert the summary text reads "1 day before due date" (not "1 days").

---

## Test 5: Edit an existing due date command

1. Open the Automation panel → Schedule tab.
2. Hover over an existing DUE_DATE command row.
3. Click the pencil (edit) icon.
4. Assert the DueDateCommandBuilder opens with the existing config pre-filled.
5. Change the offset value.
6. Click "Next" → verify updated summary, click "Save".
7. Assert the row in the list shows the updated summary.

---

## Test 6: Delete a due date command

1. Open the Automation panel → Schedule tab.
2. Hover over a due date command row.
3. Click the trash icon once (confirm button turns red).
4. Click again to confirm.
5. Assert the row is removed from the "Due Date Commands" list.

---

## Test 7: Due date command enable/disable toggle

1. Open the Automation panel → Schedule tab.
2. Hover over a due date command row.
3. Click the toggle icon to disable the command.
4. Assert the icon changes from green CheckCircle to XCircle.
5. Reload and verify the disabled state persists.

---

## Test 8: "Overdue flagging" template creates correct due date command

1. Open the Automation panel → Schedule tab.
2. Click the "Overdue flagging" quick-start template card.
3. Verify Step 1 shows "On the due date" selected.
4. Click "Next".
5. Verify two pre-populated actions: add red label and add comment "@card What's the status?".
6. Click "Save".
7. Verify the command appears in "Due Date Commands" with summary "On the due date".

---

## Test 9: Cancel in DueDateCommandBuilder returns to SchedulePanel

1. Open the Automation panel → Schedule tab.
2. Click "+ Add" for due date commands.
3. Click × (close/cancel) inside the builder.
4. Assert the SchedulePanel (with list/empty state) is visible.
5. Assert no new item was added.

---

## Test 10: Due date commands are isolated from scheduled commands in the list

1. Create one SCHEDULED automation and one DUE_DATE automation.
2. Open the Automation panel → Schedule tab.
3. Assert the scheduled automation appears under "Scheduled Commands" (with ClockIcon).
4. Assert the due date automation appears under "Due Date Commands" (with ExclamationCircleIcon).
5. Assert neither section shows items from the other section.
