# 24. Board Views — Table

**Prerequisites:** Flow 08 (Add Cards) completed. On `Test Board`.  
**Continues from:** Board (kanban) view.  
**Ends with:** Table view verified; card opened from table. Returned to kanban view.

---

## Steps

1. Locate the view switcher in the board header (icons for Kanban, Table, Calendar, Timeline).

2. Click the **Table** view icon.
   - **Expected:** Board switches to a table layout. Cards appear as rows with columns: `Title`, `List`, `Members`, `Labels`, `Due Date`, `Start Date`, `Value`.

3. Verify `Test Card 1` and `Test Card 2` appear as rows.

4. Verify column headers match the expected labels.

5. Click a column header (e.g. `Due Date`) to sort.
   - **Expected:** Rows reorder. Clicking again reverses sort. Clicking a third time clears sort.

6. Click the card title `Test Card 1` in the table row.
   - **Expected:** Card detail modal opens for `Test Card 1`.

7. Close the modal.

8. Verify the empty state message if all cards are archived (not applicable here — just confirm rows are present).

---

## Notes

- Continue to flow **25-board-views-calendar** — stay in the board's view switcher.
