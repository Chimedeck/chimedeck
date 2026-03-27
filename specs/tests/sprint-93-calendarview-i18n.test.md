> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Sprint 93 — CalendarView i18n

**Sprint:** 93  
**Tool:** Playwright MCP

## Setup
- Log in as an admin user
- Open or create a board that has at least one card with a due date
- Switch to Calendar view

## Steps

### 1. Switch to Calendar view and verify toolbar
1. On a board, click the view switcher and select Calendar view
2. Verify the `aria-label` on the mode toggle group reads `"Calendar mode"` (from `CalendarView.ariaMode`)
3. Verify the Month tab button label reads `"Month"` (from `CalendarView.monthView`)
4. Verify the Week tab button label reads `"Week"` (from `CalendarView.weekView`)
5. Verify the no-due-date note reads `"Cards without a due date are not shown."` (from `CalendarView.noDueDateNote`)

### 2. Month view — navigation aria-labels
1. Ensure the calendar is in Month view (Month tab active)
2. Verify the previous navigation button has `aria-label="Previous month"` (from `CalendarView.ariaPrevMonth`)
3. Verify the next navigation button has `aria-label="Next month"` (from `CalendarView.ariaNextMonth`)
4. Click prev/next and confirm the month title updates; navigation buttons retain their translated aria-labels

### 3. Week view — navigation aria-labels
1. Click the `"Week"` tab to switch to Week view
2. Verify the previous navigation button has `aria-label="Previous week"` (from `CalendarView.ariaPrevWeek`)
3. Verify the next navigation button has `aria-label="Next week"` (from `CalendarView.ariaNextWeek`)
4. Click prev/next and confirm the week range title updates; navigation buttons retain their translated aria-labels

### 4. Today aria-label on day cells
1. In Month view, locate today's date cell
2. Verify the day-number element inside today's cell has `aria-label="Today"` (from `CalendarView.todayButton`)
3. Verify that other day cells do NOT have an `aria-label` on their day-number element

### 5. Card chip aria-label
1. Locate a day cell that has a card chip visible
2. Verify the chip's `aria-label` begins with `"Card:"` (from `CalendarView.cardAriaPrefix`) followed by the card title
3. Example: a card titled "Fix login bug" should have `aria-label="Card: Fix login bug"`

### 6. Overflow "more" button
1. Navigate to a day that has more than the default number of visible chips (more than 3)
2. Verify the overflow button text is `"+N more"` where the word `"more"` comes from `CalendarView.overflowMore`
3. Click the overflow button; verify the extra cards expand
4. Verify the collapse button reads `"Show less"` (from `CalendarView.showLess`)
5. Click `"Show less"` and confirm the card list collapses back

### 7. No hardcoded strings check
1. Using browser DevTools or grep, verify no bare English strings remain in CalendarView components:
   ```
   grep -rn '"Month"\|"Week"\|"Today"\|"Previous month"\|"Next month"\|"Previous week"\|"Next week"\|"Calendar mode"\|"Cards without\|"Show less"\|"Card: "' src/extensions/CalendarView/ --include="*.tsx"
   ```
   Result should be empty.

## Acceptance Criteria
- [ ] `CalendarView.ariaMode` renders as the mode toggle group `aria-label`
- [ ] `CalendarView.monthView` and `CalendarView.weekView` render as tab button labels
- [ ] `CalendarView.noDueDateNote` renders in the toolbar
- [ ] `CalendarView.ariaPrevMonth` and `CalendarView.ariaNextMonth` render on Month view navigation buttons
- [ ] `CalendarView.ariaPrevWeek` and `CalendarView.ariaNextWeek` render on Week view navigation buttons
- [ ] `CalendarView.todayButton` renders as `aria-label` on today's day-number element
- [ ] `CalendarView.cardAriaPrefix` is used as the prefix for card chip `aria-label`
- [ ] `CalendarView.overflowMore` renders in the overflow expand button
- [ ] `CalendarView.showLess` renders in the collapse button
- [ ] No hardcoded English strings remain in any `.tsx` file under `src/extensions/CalendarView/`