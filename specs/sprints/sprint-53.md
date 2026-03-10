# Sprint 53 — Calendar View

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 08 (Card Extended Fields — due dates), Sprint 52 (View Switcher)  
> **References:** [requirements §4.5 — Calendar View, U-CAL-01/02/03](../architecture/requirements.md)

---

## Goal

Implement the Calendar view for a board. Cards with a `due_date` are rendered on the relevant day in a monthly/weekly calendar grid. Users can drag a card to a different day to change its due date directly from the calendar (U-CAL-03).

---

## Scope

### 1. No new API endpoints required

The Calendar view is driven entirely by the existing flat cards list. `GET /api/v1/boards/:id/cards` returns all cards with `due_date`; the view filters and positions them on the calendar client-side.

To update a card's due date by dragging, use the existing `PATCH /api/v1/cards/:id` with `{ "due_date": "..." }`.

---

### 2. `src/extensions/CalendarView/` (new)

```
src/extensions/CalendarView/
  CalendarView.tsx            # Root: month/week toggle + grid
  CalendarMonthGrid.tsx       # 6-week month grid (U-CAL-01: monthly view)
  CalendarWeekGrid.tsx        # 7-column week grid (U-CAL-02: weekly view)
  CalendarDayCell.tsx         # One day cell — renders card chips
  CalendarCardChip.tsx        # Compact card chip: title + label colour dot
  useCalendarDrag.ts          # Drag-to-reschedule hook (HTML5 drag or dnd-kit)
  types.ts
```

---

### 3. CalendarView features (U-CAL-01 / U-CAL-02 / U-CAL-03)

#### U-CAL-01 — Monthly calendar

- Default view when Calendar tab is selected
- Displays the current month; prev/next navigation arrows
- Each day cell shows chips for cards whose `due_date` falls on that day
- Cells with more than 3 cards show a "+N more" overflow chip that expands on click

#### U-CAL-02 — Weekly calendar

- Toggle button in the Calendar toolbar switches to a 7-column week view
- Shows a finer time-of-day dimension is **not required** — cards are simply listed per day column
- Navigate prev/next week

#### U-CAL-03 — Drag to change due date

- Cards in both month and week views are draggable between day cells
- Dropping a card on a new day fires `PATCH /api/v1/cards/:id` with the new `due_date`
- Optimistic update: card moves instantly; reverts on API error

#### Cards without a due date

Cards without a `due_date` do not appear in the calendar. A toolbar note reads: "Cards without a due date are not shown."

---

### 4. Integration with View Switcher (Sprint 52)

Register `CalendarView` in the view switcher component so the `CALENDAR` view type renders `<CalendarView />`.

---

## Acceptance Criteria

- [ ] Selecting "Calendar" in the view switcher renders `CalendarView`
- [ ] Monthly grid shows the current month with correct day layout
- [ ] Cards with `due_date` appear on the correct day cells
- [ ] "+N more" overflow expands on click
- [ ] Prev/next month navigation works
- [ ] Weekly view toggle shows the 7-column week grid
- [ ] Dragging a card chip to another day updates `due_date` via `PATCH /cards/:id` and moves the chip
- [ ] Failed `PATCH` reverts the card chip to its original day and shows an error toast
- [ ] Cards without `due_date` do not appear; toolbar note is visible
