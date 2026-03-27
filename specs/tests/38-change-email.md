# 38. Change Email

**Prerequisites:** Flow 03 (Login) completed. Logged in as admin.  
**Continues from:** Any page.  
**Ends with:** Admin's email change flow verified; email reverted to original.

---

## Steps

### Initiate Change

1. Navigate to profile settings (`{TEST_CREDENTIALS.baseUrl}/profile` or avatar → **Settings**).

2. Find the **Change Email** section.

3. Enter a new email: `admin-newemail+{timestamp}@example.com` and submit.
   - **Expected:** A notice appears: `A verification link has been sent to your new address.` The current email is still active until confirmed.

### Verify — Already Taken Email

4. Try entering `TEST_CREDENTIALS.user.email` (an existing account) as the new email.
   - **Expected:** Error message: `This email is already in use.`

### Complete Change via Admin API

5. Retrieve the verification token via admin API:
   ```http
   GET {TEST_CREDENTIALS.baseUrl}/api/v1/admin/email-change-token?email={TEST_CREDENTIALS.admin.email}
   Authorization: Bearer $adminToken
   ```
   - **Expected:** `200 OK` with `data.token`.

6. Navigate to the email change confirmation URL:
   ```
   {TEST_CREDENTIALS.baseUrl}/confirm-email-change?token={data.token}
   ```
   - **Expected:** New email is confirmed. A success message appears.

7. Verify the new email appears in the profile settings.

### Revert

8. Change the email back to `TEST_CREDENTIALS.admin.email` by repeating steps 2–6 with the original email.
   - **Expected:** Admin email is restored.

---

## Notes

- This is the final flow in the continuous test suite.
- All flows 01–38 can be run sequentially in a single Playwright MCP session, starting from an empty state.
