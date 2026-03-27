# 20. Board Visibility

**Prerequisites:** Flow 19 completed. On `Test Board` as admin.  
**Continues from:** Board view.  
**Ends with:** Board visibility has been tested for `Workspace`, `Private`, and reverted to `Workspace`.

---

## Steps

1. Open board settings (click **⋮** → **Settings** or the visibility badge in the board header, e.g. `Workspace`).
   - **Expected:** Visibility selector shows current value `Workspace`.

2. Change visibility to **Private**.
   - **Expected:** The board visibility badge updates to `Private`. Non-members would no longer see this board.

3. Confirm the change is saved (page reload or API):
   ```http
   GET {TEST_CREDENTIALS.baseUrl}/api/v1/boards/$boardId
   Authorization: Bearer $adminToken
   ```
   - **Expected:** Response `data.visibility === "private"`.

4. Change visibility back to **Workspace**.
   - **Expected:** Badge updates to `Workspace`.

---

## Notes

- Continue to flow **21-board-member-roles** — still on `Test Board`.
