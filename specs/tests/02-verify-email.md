# 02. Email Verification

**Prerequisites:** Flow 01 (Sign Up) completed. User is logged in but email is unverified.  
**Continues from:** Post-registration screen.  
**Ends with:** User's email is verified and the verification banner is dismissed.

---

## Steps

1. Observe the verification banner on the dashboard (e.g. "Please verify your email address").
   - **Expected:** Banner is visible at the top of the page.

2. Click **Resend verification email** inside the banner.
   - **Expected:** A confirmation message appears ("Verification email sent").

3. Trigger email verification via the admin API (simulates clicking the link in the email):
   ```http
   POST {TEST_CREDENTIALS.baseUrl}/api/v1/admin/users/verify-email
   Authorization: Bearer $adminToken
   Content-Type: application/json

   { "email": "$newUserEmail" }
   ```
   - **Expected:** `200 OK` with `data.verified: true`.

4. Reload the page.
   - **Expected:** The verification banner is gone. The account is fully active.

---

## Notes

- `$adminToken` is obtained by logging in as `TEST_CREDENTIALS.admin.email` / `TEST_CREDENTIALS.admin.password` (see TEST_CREDENTIALS.md).
- If the email-verification feature flag is disabled on this environment, skip to flow **03-login**.
