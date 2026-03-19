# Playwright MCP Tests — Scheduled Commands

## Setup

Navigate to a board with the Automation panel available. Open the Automation panel by clicking
the bolt icon in the board header. Click the **Schedule** tab.

---

## Test 1: Schedule tab renders SchedulePanel (not "Coming soon")

1. Open the Automation panel.
2. Click the **Schedule** tab.
3. Assert that the text "Coming soon" is NOT visible.
4. Assert that the heading "Quick-start templates" is visible.

---

## Test 2: Quick-start templates are displayed

1. Open the Automation panel → Schedule tab.
2. Assert that 3 template cards are visible:
   - "Weekly board cleanup"
   - "Overdue flagging"
   - "Monthly archive"

---

## Test 3: Clicking a scheduled quick-start template opens ScheduledCommandBuilder pre-populated

1. Open the Automation panel → Schedule tab.
2. Click the "Weekly board cleanup" template card.
3. Assert that the ScheduledCommandBuilder modal is now visible (Step 1 heading visible).
4. Assert that the frequency selector shows "Weekly".
5. Assert that the day picker shows "Mon".
6. Assert that the hour picker shows "09" and minute shows "00".
7. Press the "Next" button to proceed to Step 2.
8. Assert that at least one action is pre-populated (archive all cards action visible).
9. Press "Next" to proceed to Step 3 (Name & Save).
10. Assert the name field contains "Weekly board cleanup".

---

## Test 4: Clicking a due-date quick-start template opens DueDateCommandBuilder pre-populated

1. Open the Automation panel → Schedule tab.
2. Click the "Overdue flagging" template card.
3. Assert that the DueDateCommandBuilder modal is visible (Step 1 heading visible).
4. Assert that the timing selector shows "On the due date".
5. Press "Next" to proceed to Step 2.
6. Assert that actions are pre-populated (add red label + add comment).

---

## Test 5: Create a weekly scheduled command from scratch (≤ 4 steps)

1. Open the Automation panel → Schedule tab.
2. If no scheduled commands exist, click "Create a scheduled command" in the empty state.
   Otherwise, click the "+ Add" button next to "Scheduled Commands".
3. **Step 1 — Schedule:**
   - Select frequency: "Weekly".
   - Select day: "Wednesday".
   - Set hour: "10", minute: "30".
   - Click "Next".
4. **Step 2 — Actions:**
   - Click "Add action".
   - Select "list.sort_by_due_date" from the action picker.
   - Click "Next".
5. **Step 3 — Name & Save:**
   - Assert that the auto-generated name contains "Wednesday" and "10:30".
   - Click "Save".
6. Assert that the new automation appears in the "Scheduled Commands" list with summary text
   "Every Wednesday at 10:30".

---

## Test 6: Schedule summary text is human-readable

1. Open the Automation panel → Schedule tab.
2. For each existing SCHEDULED automation in the list, verify its summary row is not blank
   and contains recognizable time/day information (e.g. "Every", "at", "month").

---

## Test 7: Enable/disable a scheduled command

1. Open the Automation panel → Schedule tab.
2. Hover over an existing scheduled command row to reveal action buttons.
3. Click the toggle button (CheckCircle / XCircle icon).
4. Assert the toggle icon changes to reflect the new state.
5. Reload the panel and assert the persisted state matches.

---

## Test 8: Delete a scheduled command (two-click confirm)

1. Open the Automation panel → Schedule tab.
2. Hover over a scheduled command row.
3. Click the trash icon once — assert the button changes to a red confirmation state.
4. Click the trash icon again to confirm deletion.
5. Assert the item is removed from the list.

---

## Test 9: Close builder without saving returns to Schedule tab

1. Open the Automation panel → Schedule tab.
2. Click "Create a scheduled command".
3. Click the × / Cancel button inside the builder.
4. Assert the SchedulePanel (list/empty state) is visible again.
5. Assert no new automation was created (list count unchanged).

---

## Test 10: Empty state shown when no schedule automations exist

1. Ensure no SCHEDULED or DUE_DATE automations exist on the board.
2. Open the Automation panel → Schedule tab.
3. Assert that the empty state copy is visible:
   "No scheduled commands yet"
4. Assert that "Create a scheduled command" and "Create a due date command" buttons are visible.
