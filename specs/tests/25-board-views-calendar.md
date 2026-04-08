# 25. Board Views — Calendar

**Prerequisites:** Flow 11 (Labels, Due Dates) completed. `Test Card 1` has a due date.  
**Continues from:** Board view (any view).  
**Ends with:** Calendar view verified; month navigation confirmed. Returned to kanban.

---

## Steps

1. Click the **Calendar** view icon in the board header view switcher.
   - **Expected:** Board switches to a monthly calendar layout for the current month.

2. Find the due date of `Test Card 1` on the calendar.
   - **Expected:** A card chip for `Test Card 1` is visible on its due date cell.

3. Click the card chip.
   - **Expected:** Card detail modal opens for `Test Card 1`.

4. Close the modal.

5. Click the **next month** navigation arrow (→).
   - **Expected:** Calendar advances to the next month. Cards with due dates in that month appear.

6. Click the **previous month** arrow (←) to return.
   - **Expected:** Calendar returns to the current month.

7. Verify the **No due date** note or unscheduled section — `Test Card 2` (which has no due date) should appear there or be absent from the calendar grid.

---

## Notes

- Continue to flow **26-board-views-timeline**.
