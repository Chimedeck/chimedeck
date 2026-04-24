# 14. Move Card

**Prerequisites:** Flow 08 (Add Cards) completed. `Test Card 1` and `Test Card 2` are in `To Do`.  
**Continues from:** Board view (close the card modal first if open).  
**Ends with:** `Test Card 1` is in `In Progress`. `Test Card 2` remains in `To Do`.

---

## Steps

### Drag-and-Drop

1. Close the card detail modal if it is open (press **Escape**).
   - **Expected:** Board view is showing all three lists.

2. Drag `Test Card 1` from the `To Do` column and drop it into the `In Progress` column.
   - **Expected:** `Test Card 1` appears in `In Progress`. `To Do` now contains only `Test Card 2`.

### Drag-and-Drop (Long Distance with Horizontal Scroll)

1. Ensure the board has at least 6 columns (create temporary lists if needed).
   - **Expected:** A far-right target list exists outside the initial viewport.

2. Drag `Test Card 1` from `In Progress` toward the far-right list while horizontally scrolling the board during drag.
   - **Expected:** The insertion indicator stays visible and the currently selected destination column shows a highlighted border.

3. Drop `Test Card 1` into that far-right list.
   - **Expected:** The card is moved to the far-right list.

4. Drag `Test Card 1` back to `In Progress`.
   - **Expected:** The card returns to `In Progress` and the destination column border highlight tracks the active target.

### Move via Card Menu

1. Open `Test Card 1` by clicking it.
   - **Expected:** Card detail modal opens; breadcrumb shows `In Progress`.

2. Close the modal.

3. Right-click (or click the card's **⋮** menu) on `Test Card 1` to open the card action menu.

4. Select **Move** → choose list `Done` → confirm.
   - **Expected:** `Test Card 1` moves to `Done`.

5. Repeat step 3-4 to move the card back to `In Progress`.
   - **Expected:** `Test Card 1` is back in `In Progress`.

---

## Notes

- After this flow `Test Card 1` is in `In Progress`, `Test Card 2` is in `To Do`.
- Continue to flow **15-card-short-url**.
