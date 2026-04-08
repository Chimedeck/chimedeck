# 07. Manage Lists

**Prerequisites:** Flow 06 (Create Board) completed. On `Test Board`.  
**Continues from:** Board view (no lists yet).  
**Ends with:** Three lists — `To Do`, `In Progress`, `Done` — visible on the board. A list has been renamed successfully.

---

## Steps

1. Click **Add a list** (or **+ Add list**).
   - **Expected:** An inline input appears.

2. Type `To Do` and press **Enter** (or click **Add List**).
   - **Expected:** "To Do" list column appears on the board.

3. Click **Add a list** again and type `In Progress`, confirm.
   - **Expected:** "In Progress" column appears to the right.

4. Click **Add a list** again and type `Done`, confirm.
   - **Expected:** "Done" column appears to the right.

5. Double-click (or click the edit icon on) the `To Do` list header to rename it.

6. Change the name to `Backlog` and confirm.
   - **Expected:** Column header now reads `Backlog`.

7. Rename it back to `To Do` and confirm.
   - **Expected:** Column header reads `To Do` again.

---

## Notes

- Store the `To Do` list ID as `$listId` for later flows.
- Continue to flow **08-add-cards** — still on the board.
