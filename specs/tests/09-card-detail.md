# 09. Card Detail

**Prerequisites:** Flow 08 (Add Cards) completed. `Test Card 1` exists in `To Do`.  
**Continues from:** Board view.  
**Ends with:** Card detail modal for `Test Card 1` is open.

---

## Steps

1. Click on `Test Card 1` card tile.
   - **Expected:** Card detail modal opens.

2. Verify the following sections are visible in the modal:
   - Card title (`Test Card 1`)
   - Description area (empty or placeholder text)
   - Members section
   - Labels section
   - Checklist section (or "Add checklist" button)
   - Due Date picker (or "Add due date" button)
   - Start Date picker (or "Add start date" button)
   - Attachments section
   - Comments / activity feed at the bottom

3. Verify the modal header shows the list name `To Do` (breadcrumb or subtitle).

4. Verify the close button (✕) is present and pressing **Escape** closes the modal.
   - **Expected:** Modal closes; board is visible.

5. Reopen the modal by clicking `Test Card 1` again.
   - **Expected:** Modal opens in the same state.

---

## Notes

- Leave the modal open to continue to flow **10-edit-card-description**.
