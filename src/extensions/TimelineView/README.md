# TimelineView

Sprint 54 — Timeline / Gantt View for boards.

## Structure

```
src/extensions/TimelineView/
├── TimelineView.tsx          # Root container: toolbar (Today + zoom), header, swimlane rows
├── TimelineHeader.tsx        # Scrollable horizontal date axis (adapts to zoom level)
├── TimelineRow.tsx           # One swimlane per list; bar area + unscheduled chips
├── TimelineZoomControl.tsx   # Day / Week / Month zoom toggle
├── types.ts                  # TypeScript types for all TimelineView components
├── README.md                 # This file
└── __tests__/
    └── TimelineView.playwright.ts  # Playwright E2E tests
```

> **Sprint 54 Iteration 7** will add `TimelineBar.tsx` and `useTimelineDrag.ts` for bar
> rendering and drag/resize interactions. See the `TODO` comment in `TimelineRow.tsx`.

## Integration

`TimelineView` is registered for the `TIMELINE` view type in `BoardPage.tsx`:

```tsx
import TimelineView from '../../../TimelineView/TimelineView';

// In the view switcher render block:
} : activeView === 'TIMELINE' ? (
  <TimelineView
    cards={Object.values(cards)}
    lists={lists}
    onCardClick={handleCardClick}
    addToast={addToast}
  />
```

## Props (`TimelineViewProps`)

| Prop         | Type                                              | Description                         |
|--------------|---------------------------------------------------|-------------------------------------|
| `cards`      | `Card[]`                                          | All cards for the board             |
| `lists`      | `Record<string, List>`                            | All lists, keyed by id              |
| `onCardClick`| `(cardId: string) => void`                        | Opens the card detail modal         |
| `addToast`   | `(msg: string, variant?) => void` *(optional)*    | Show error/success toast messages   |

## Swimlane Logic

- One **swimlane** per list in list order.
- A card is **scheduled** if it has *both* `start_date` and `due_date`.
  - Scheduled cards appear as bars in the swimlane (bars implemented in Iteration 7).
- A card is **unscheduled** if it is missing `start_date` or `due_date`.
  - Unscheduled cards appear as chips below the swimlane bar area.

## Zoom Levels

| Level  | Day width | Header label       |
|--------|-----------|--------------------|
| `day`  | 60 px     | "Mon 10" (per day) |
| `week` | 14 px     | "Mar 10" (per week)|
| `month`| 4 px      | "Mar 2026" (per month)|

Default zoom is `week`.

## Today Button

Clicking **Today** scrolls the timeline so the current date is centred in the viewport.
The zoom level controls also auto-scroll to today when changed.

## Test IDs

| Selector                                      | Element                        |
|-----------------------------------------------|--------------------------------|
| `data-testid="timeline-view"`                 | Root container                 |
| `data-testid="timeline-today-button"`         | Today scroll button            |
| `data-testid="timeline-zoom-control"`         | Zoom toggle group              |
| `data-testid="timeline-zoom-day"`             | Day zoom button                |
| `data-testid="timeline-zoom-week"`            | Week zoom button               |
| `data-testid="timeline-zoom-month"`           | Month zoom button              |
| `data-testid="timeline-header"`               | Date axis header               |
| `data-testid="timeline-today-column"`         | Today's column in the header   |
| `data-testid="timeline-row-{listId}"`         | Swimlane row for a list        |
| `data-testid="timeline-lane-label-{listId}"`  | Sticky list label in swimlane  |
| `data-testid="timeline-bar-area-{listId}"`    | Bar area inside swimlane       |
| `data-testid="timeline-unscheduled-row-{listId}"` | Unscheduled chips row      |
| `data-testid="timeline-unscheduled-chip-{cardId}"` | Chip for unscheduled card |
