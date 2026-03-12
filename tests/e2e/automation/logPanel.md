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
