# Log Panel E2E Tests

## Prerequisites
- At least one automation exists on the board with prior run history seeded
- Board-wide automation quota data is available from the API

---

## Test: Log tab renders QuotaBar and run log table

### Steps
1. Navigate to a board that has automation run history
2. Click the automation header button (BoltIcon) to open the Automation panel
3. Click the "Log" tab

### Expected
- The Log tab becomes active (blue underline)
- A QuotaBar is visible showing "X / Y runs used this month · resets in N days"
- A progress bar is rendered inside the QuotaBar
- The run log table is visible with header columns: Automation, Card, Triggered by, When
- At least one run row is visible

---

## Test: QuotaBar color thresholds

### Steps
1. Seed a board whose usedRuns / maxRuns = 85% (above 80%, below 95%)
2. Open the Automation panel → Log tab

### Expected
- The progress bar has `bg-amber-500` class (amber color)
- An ExclamationTriangleIcon is visible next to the quota text

### Steps (variant: above 95%)
1. Seed a board whose usedRuns / maxRuns >= 95%
2. Open the Automation panel → Log tab

### Expected
- The progress bar has `bg-red-500` class (red color)
- ExclamationTriangleIcon has `text-red-400` class

---

## Test: Run log row expand / collapse

### Steps
1. Open the Automation panel → Log tab
2. Locate a run row in the table
3. Click the ChevronDownIcon button on the right of a row

### Expected
- The row expands to show an inline RunLogDetail section
- If the run has an error, a red "Error" section is visible with the error message
- A "Context" section shows the context JSON in a monospace block
- Clicking ChevronUpIcon collapses the detail row back

---

## Test: Pagination

### Steps
1. Seed a board with > 50 automation runs
2. Open the Automation panel → Log tab

### Expected
- Pagination controls "← Prev" and "Next →" are visible at the bottom of the table
- Page counter shows "1 / N" where N > 1
- Clicking "Next →" loads the next page of results
- "← Prev" is disabled on page 1
- "Next →" is disabled on the last page

---

## Test: Empty state

### Steps
1. Open the Automation panel → Log tab on a board with no automation runs

### Expected
- The table body shows "No runs recorded yet." message
- No pagination controls are visible

---

## Test: Status icons per run status

### Steps
1. Ensure the board has runs with SUCCESS, PARTIAL, and FAILED statuses
2. Open Log tab

### Expected
- SUCCESS rows show a green CheckCircleIcon
- PARTIAL rows show an amber ExclamationCircleIcon
- FAILED rows show a red XCircleIcon

---

## Test: Automation type chips

### Steps
1. Ensure the board has runs from RULE, CARD_BUTTON, and SCHEDULED automations
2. Open Log tab

### Expected
- RULE runs show a BoltIcon chip labelled "Rule"
- CARD_BUTTON/BOARD_BUTTON runs show a PlayIcon chip labelled "Card button" / "Board button"
- SCHEDULED/DUE_DATE runs show a ClockIcon chip labelled "Schedule" / "Due date"

---

## Test: Card link opens card modal

### Steps
1. Locate a run row in the Log tab that has a card name (not "Board-wide")
2. Click the card name link

### Expected
- The card detail modal opens for that card

---

## Test: Board-wide runs show "Board-wide" label

### Steps
1. Locate a run that was triggered board-wide (no specific card)

### Expected
- The Card column shows "Board-wide" text (grey, not a link)

---

## Test: Real-time row prepend on automation_ran WebSocket event

### Steps
1. Open the Automation panel → Log tab on a board with at least one automation
2. Observe the current first row in the run log table (note its automation name and timestamp)
3. Trigger an automation (e.g. click a board button or move a card to fire a rule)
4. Wait up to 3 seconds without refreshing the page

### Expected
- A new row appears at the top of the run log table without any page reload
- The new row shows the correct automation name and a "just now" relative time
- The new row has a status icon matching the run result (SUCCESS → green, PARTIAL → amber, FAILED → red)
- The run count chip on the corresponding automation row in the Rules / Buttons / Schedule tab increments by 1

---

## Test: Run-count chip on Rules tab

### Steps
1. Open the Automation panel → Rules tab
2. Identify an automation that has never been run (runCount = 0)

### Expected
- The automation row shows a grey run-count chip with "0"

### Steps (variant: after a run)
1. Trigger the automation once
2. Wait for the automation_ran WS event

### Expected
- The grey chip changes to green and shows "1" (or the incremented total)

---

## Test: Run-count chip on Buttons tab

### Steps
1. Open the Automation panel → Buttons tab
2. Identify a card or board button

### Expected
- Each button row shows a run-count chip (grey if 0, green if > 0)
- After clicking "Run" on a board button, the chip increments in real time

---

## Test: Run-count chip on Schedule tab

### Steps
1. Open the Automation panel → Schedule tab
2. Identify a scheduled or due-date command

### Expected
- Each schedule item row shows a run-count chip (grey if 0, green if > 0)
- After a scheduled run fires, the chip increments without refreshing

---

## Test: Real-time rows deduplicated on reconnect

### Steps
1. Open Log tab with several rows visible
2. Simulate WS disconnect and reconnect (e.g. close and re-open the panel)
3. Check the run log table

### Expected
- No duplicate rows appear for runs that were already shown before the reconnect
- The prependedRuns list is cleared when the panel is closed and re-opened

