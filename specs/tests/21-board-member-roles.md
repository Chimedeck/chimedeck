# 21. Board Member Roles

**Prerequisites:** Flow 19 completed. `TEST_CREDENTIALS.user.email` is a `MEMBER` of `Test Board`.  
**Continues from:** Board view (Members panel).  
**Ends with:** User's role has been changed to `VIEWER` and back to `MEMBER`.

---

## Steps

1. Open the **Members** panel on the board.
   - **Expected:** Panel shows admin (`ADMIN`) and the invited user (`MEMBER`).

2. Click the role badge next to `TEST_CREDENTIALS.user.email`.
   - **Expected:** A role dropdown appears with options: `ADMIN`, `MEMBER`, `VIEWER`.

3. Select **VIEWER**.
   - **Expected:** Role badge updates to `VIEWER`.

4. Log out and log in as `TEST_CREDENTIALS.user.email` / `TEST_CREDENTIALS.user.password`.

5. Navigate to `Test Board` (`{TEST_CREDENTIALS.baseUrl}/boards/$boardId`).
   - **Expected:** Board is visible. The `Add a card` button is hidden or disabled (VIEWER cannot create cards).

6. Log out and log back in as `TEST_CREDENTIALS.admin.email` / `TEST_CREDENTIALS.admin.password`.

7. Open the Members panel and change the user's role back to **MEMBER**.
   - **Expected:** Role badge shows `MEMBER`.

---

## Notes

- Continue to flow **22-guest-access**.
