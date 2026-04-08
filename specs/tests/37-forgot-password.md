# 37. Forgot Password

**Prerequisites:** An account exists for `TEST_CREDENTIALS.user.email`.  
**Continues from:** Logged-out state (log out first if needed).  
**Ends with:** Password has been reset; user can log in with the new password.

---

## Steps

### Request Reset

1. Log out if currently logged in.

2. Navigate to `{TEST_CREDENTIALS.baseUrl}` and click **Log in**.

3. Click **Forgot password?** (below the login form).
   - **Expected:** A form appears asking for an email address.

4. Enter `TEST_CREDENTIALS.user.email` and submit.
   - **Expected:** A confirmation message appears: e.g. `Check your email for a password reset link.`

### Unknown Email

5. Submit the form again but with `unknown@nonexistent.example.com`.
   - **Expected:** The same generic confirmation message (not an error revealing whether the email exists — prevents user enumeration).

### Complete Reset via API

6. Trigger the reset token retrieval via the admin API:
   ```http
   GET {TEST_CREDENTIALS.baseUrl}/api/v1/admin/password-reset-token?email={TEST_CREDENTIALS.user.email}
   Authorization: Bearer $adminToken
   ```
   - **Expected:** `200 OK` with `data.token` (the reset token).

7. Navigate to the reset URL:
   ```
   {TEST_CREDENTIALS.baseUrl}/reset-password?token={data.token}
   ```
   - **Expected:** A "Set new password" form appears.

8. Enter a new password `NewPass1!` in both fields and submit.
   - **Expected:** Success message. The app may redirect to the login page.

### Verify New Password Works

9. Log in with `TEST_CREDENTIALS.user.email` and password `NewPass1!`.
   - **Expected:** Login succeeds.

### Expired Token Test

10. Log out. Request another reset for `TEST_CREDENTIALS.user.email`.

11. Navigate to the reset URL with an expired/invalid token:
    ```
    {TEST_CREDENTIALS.baseUrl}/reset-password?token=invalidtoken123
    ```
    - **Expected:** Error message: `This link has expired` or `Invalid reset link`.

---

## Notes

- After this flow, `TEST_CREDENTIALS.user.email` has password `NewPass1!`. Update TEST_CREDENTIALS if permanent.
- Continue to flow **38-change-email**.
