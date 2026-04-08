# 11. Labels, Due Date, Start Date & Checklist

**Prerequisites:** Flow 10 completed. Card detail modal for `Test Card 1` is open.  
**Continues from:** Card detail modal.  
**Ends with:** Card has a label `Bug`, a due date, a start date, and a checklist with one checked item.

---

## Steps

### Labels

1. Click **Labels** (or the label icon) in the card sidebar/actions area.
   - **Expected:** Label picker opens.

2. Click **Create a new label**, enter the name `Bug`, choose a colour (e.g. red), and save.
   - **Expected:** Label `Bug` appears in the picker.

3. Click the `Bug` label to apply it to the card.
   - **Expected:** `Bug` label chip appears on the card (in the modal header and on the board tile).

4. Close the label picker.

### Due Date

5. Click **Due Date** in the card sidebar.
   - **Expected:** A date picker opens.

6. Select a date 7 days from today.
   - **Expected:** Due date is shown on the card (e.g. `Due: Jan 3`).

7. Close the date picker.

### Start Date

8. Click **Start Date** in the card sidebar.
   - **Expected:** A date picker opens.

9. Select today's date.
   - **Expected:** Start date is shown on the card.

### Checklist

10. Click **Add checklist** (or the checklist icon) in the card sidebar.
    - **Expected:** A checklist titled `Tasks` (or similar) appears in the card body.

11. Click **Add an item** in the checklist. Type `First task` and press **Enter**.
    - **Expected:** Checklist item appears unchecked.

12. Click the checkbox next to `First task`.
    - **Expected:** Item is checked off; progress bar or counter updates (e.g. `1/1`).

---

## Notes

- All applied fields (label, dates, checklist) should be visible on the `Test Card 1` tile on the board.
- Leave the modal open for flow **12-card-attachments**.
