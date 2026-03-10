# Sprint 54 — Timeline / Gantt View

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 08 (Card Extended Fields), Sprint 46 (Board Schema Extensions — `start_date`), Sprint 52 (View Switcher)  
> **References:** [requirements §4.6 — Timeline View, U-GNT-01/02/03](../architecture/requirements.md)

---

## Goal

Implement the Timeline (Gantt-style) view for a board. Cards with both a `start_date` and a `due_date` are rendered as horizontal bars on a scrollable date-range timeline. Users can drag either end of a bar to resize it (changing `start_date` or `due_date`) and drag the bar body to shift the entire range.

---

## Scope

### 1. No new API endpoints required

Data comes from the existing cards list. Due date updates use `PATCH /api/v1/cards/:id` with `{ "start_date": "...", "due_date": "..." }`.

---

### 2. `src/extensions/TimelineView/` (new)

```
src/extensions/TimelineView/
  TimelineView.tsx              # Root: date-range header + rows
  TimelineHeader.tsx            # Scrolling date axis (days/weeks)
  TimelineRow.tsx               # One row per list; card bars inside
  TimelineBar.tsx               # Single card bar with resize handles
  useTimelineDrag.ts            # Drag/resize interaction hook
  TimelineZoomControl.tsx       # Day / Week / Month zoom toggle
  types.ts
```

---

### 3. Timeline features (U-GNT-01 / U-GNT-02 / U-GNT-03)

#### U-GNT-01 — Arrange tasks on a timeline based on start/end dates

- Cards are grouped by their parent list (one horizontal swimlane per list)
- Each card with both `start_date` and `due_date` is rendered as a coloured bar spanning from start to end
- Cards missing either date are listed below the swimlane as "unscheduled" chips; clicking them opens the card modal so the user can add dates

#### U-GNT-02 — Scroll and zoom

- The horizontal axis scrolls infinitely
- Three zoom levels: **Day** (1 px/hour), **Week** (1 px/4h), **Month** (1 px/day)
- Default zoom: Week
- "Today" button snaps the scroll position to the current date

#### U-GNT-03 — Drag to resize / move

- Dragging the left handle of a bar changes `start_date`
- Dragging the right handle changes `due_date`
- Dragging the bar body shifts both dates by the same delta
- All updates are optimistic via `PATCH /api/v1/cards/:id`; reverts on error

#### Dependency arrows (optional / future)

Not in scope for this sprint. Leave a `// TODO: dependency arrows` comment in `TimelineBar.tsx`.

---

### 4. Integration with View Switcher (Sprint 52)

Register `TimelineView` for the `TIMELINE` view type.

---

## Acceptance Criteria

- [ ] Selecting "Timeline" in the view switcher renders `TimelineView`
- [ ] Cards with `start_date` + `due_date` appear as bars in the correct swimlane
- [ ] Cards missing either date appear as "unscheduled" chips below their swimlane
- [ ] Day / Week / Month zoom levels render correctly
- [ ] "Today" button scrolls to the current date
- [ ] Dragging the left handle updates `start_date` optimistically; PATCH succeeds
- [ ] Dragging the right handle updates `due_date` optimistically; PATCH succeeds
- [ ] Dragging the bar body shifts both dates; PATCH succeeds
- [ ] Failed PATCH reverts the bar and shows an error toast
