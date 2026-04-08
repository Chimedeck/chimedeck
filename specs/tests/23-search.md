# 23. Search

**Prerequisites:** Flow 08 (Add Cards) completed. `Test Card 1` and `Test Card 2` exist.  
**Continues from:** Board view (logged in as admin).  
**Ends with:** Search has been used to find cards and boards; filters have been applied.

---

## Steps

### Open Search

1. Press **Cmd+K** (macOS) / **Ctrl+K** (Windows/Linux) or click the Search icon in the sidebar.
   - **Expected:** Command palette / search dialog opens with an empty input.

### Search Cards

2. Type `Test Card`.
   - **Expected:** Results appear showing both `Test Card 1` and `Test Card 2` under a **Cards** section.

3. Click on `Test Card 1` in the results.
   - **Expected:** Card detail modal opens for `Test Card 1`.

4. Close the modal.

### Board-Scoped Search

5. Open search again. Switch to the **Boards** tab (or filter by type = Board).

6. Type `Test Board`.
   - **Expected:** `Test Board` appears in results.

7. Click it.
   - **Expected:** Navigated to `Test Board`.

### Type Filter

8. Open search. Type a partial string like `Test`.
   - **Expected:** Results span both cards and boards.

9. Apply the **Cards only** filter.
   - **Expected:** Only card results remain.

### No-Match State

10. Type a string that matches nothing, e.g. `xyzxyznonexistent`.
    - **Expected:** Empty state message appears (e.g. `No results found`).

---

## Notes

- Search respects board access rights — verify that PRIVATE board cards are not returned when searching as a non-member.
- Continue to flow **24-board-views-table**.
