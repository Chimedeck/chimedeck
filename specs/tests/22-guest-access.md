# 22. Guest Access Control

**Prerequisites:** Flow 21 completed. Logged in as admin.  
**Continues from:** Board view.  
**Ends with:** Guest user access verified; logged back in as admin.

---

## Steps

### Invite Guest

1. Open the **Members** panel and click **Invite member**.

2. Enter `TEST_CREDENTIALS.guest.email` with role **VIEWER** (guest) and send.
   - **Expected:** Guest appears in the member list with `VIEWER` role.

### Verify Guest Permissions

3. Log out. Log in as `TEST_CREDENTIALS.guest.email` / `TEST_CREDENTIALS.guest.password`.

4. Navigate to `Test Board` (`{TEST_CREDENTIALS.baseUrl}/boards/$boardId`).
   - **Expected:** Board is visible in read-only mode.

5. Verify the guest **cannot**:
   - See the **Add a card** button (or it is disabled).
   - Edit card titles inline.
   - Access board settings.

6. Verify the guest **can**:
   - Open a card detail modal and read its contents.
   - View the activity feed.

### Revoke Guest Access

7. Log out. Log in as `TEST_CREDENTIALS.admin.email` / `TEST_CREDENTIALS.admin.password`.

8. Open the Members panel, find the guest user, and click **Remove** (or set role to remove access).
   - **Expected:** Guest no longer appears in the member list.

---

## Notes

- Continue to flow **23-search**.
