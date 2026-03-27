# 06. Create Board

**Prerequisites:** Flow 05 (Create Workspace) completed. Inside `Test Workspace`.  
**Continues from:** Workspace view (empty boards list).  
**Ends with:** Board `Test Board` is open in the browser. `$boardId` is stored.

---

## Steps

1. Click **+ Create board** (or the "New board" button inside the workspace).
   - **Expected:** Board creation form appears.

2. Fill in:
   - **Title:** `Test Board`
   - **Visibility:** `Workspace` (default — workspace members can see it)

3. Click **Create** (or **Save**).
   - **Expected:** Redirected to the new board view. Board shows an empty column area.

4. Store the board ID from the URL (e.g. `{TEST_CREDENTIALS.baseUrl}/boards/$boardId`) as `$boardId`.

---

## Notes

- Continue to flow **07-manage-lists** — already on the board.
