> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 93 — TimelineView i18n: Playwright MCP Test Plan

**Goal:** Verify all TimelineView UI copy renders from `translations/en.json` and no hardcoded English strings remain.

---

## Prerequisites

- Dev server running at `http://localhost:3000`
- At least one board with lists exists
- At least one card with both `start_date` and `due_date` exists for timeline bar rendering

---

## Steps

### 1. Navigate to the app and open a board in Timeline view

1. Go to `http://localhost:3000`
2. Log in if required
3. Open any board
4. Click the "Timeline" view switcher button in the board toolbar

### 2. Verify the Timeline toolbar

- Assert the **"Today"** button is visible with text matching `translations['TimelineView.todayMarkerLabel']` ("Today")
- Assert the zoom control group has `aria-label` matching `translations['TimelineView.zoomLabel']` ("Timeline zoom level")
- Assert zoom buttons show labels:
  - "Day" → `translations['TimelineView.zoomDay']`
  - "Week" → `translations['TimelineView.zoomWeek']`
  - "Month" → `translations['TimelineView.zoomMonth']`

### 3. Verify zoom level toggle

1. Click the "Day" zoom button
2. Assert `data-testid="timeline-zoom-day"` button has `aria-pressed="true"`
3. Click the "Week" zoom button
4. Assert `data-testid="timeline-zoom-week"` button has `aria-pressed="true"`
5. Click the "Month" zoom button
6. Assert `data-testid="timeline-zoom-month"` button has `aria-pressed="true"`

### 4. Verify the "Today" scroll button

1. Click the "Today" button (`data-testid="timeline-today-button"`)
2. Assert the timeline scrolls so the current-date column is highlighted (`data-testid="timeline-today-column"`)

### 5. Verify resize handle aria-labels (scheduled card required)

If a card with `start_date` and `due_date` is visible as a bar:

1. Find `data-testid="timeline-bar-resize-left-{cardId}"`
2. Assert its `aria-label` equals `translations['TimelineView.ariaResizeStart']` ("Resize start date")
3. Find `data-testid="timeline-bar-resize-right-{cardId}"`
4. Assert its `aria-label` equals `translations['TimelineView.ariaResizeDue']` ("Resize due date")

### 6. Verify scheduled count label

If a list has scheduled cards:

1. Find the swimlane label for that list (`data-testid="timeline-lane-label-{listId}"`)
2. Assert it contains a count followed by the text `translations['TimelineView.scheduledCount']` ("scheduled")

### 7. Verify unscheduled section label

If an unscheduled row is visible for a list:

1. Find `data-testid="timeline-unscheduled-row-{listId}"`
2. Assert the label reads `translations['TimelineView.unscheduledLabel']` ("Unscheduled")

---

## Acceptance Criteria

- [ ] "Today" button renders from `translations['TimelineView.todayMarkerLabel']`
- [ ] Zoom control `aria-label` renders from `translations['TimelineView.zoomLabel']`
- [ ] Zoom level button labels ("Day", "Week", "Month") render from translations
- [ ] Resize handle `aria-label` attributes render from translations
- [ ] Scheduled count suffix renders from `translations['TimelineView.scheduledCount']`
- [ ] Unscheduled row label renders from `translations['TimelineView.unscheduledLabel']`
- [ ] No hardcoded English UI strings visible in the TimelineView
- [ ] All timeline interactions (zoom, today scroll, card drag) function identically after the refactor