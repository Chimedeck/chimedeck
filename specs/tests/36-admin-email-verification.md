# 36. Admin — Manual Email Verification

**Prerequisites:** Flow 01 (Sign Up) completed with a user whose email is unverified. Logged in as admin.  
**Continues from:** Admin users or dashboard.  
**Ends with:** Target user's email is verified via the admin UI.

---

## Steps

1. Navigate to the admin users list (e.g. `{TEST_CREDENTIALS.baseUrl}/admin/users`).
   - **Expected:** A table of users is shown.

2. Find the test user created in flow 01 (`$newUserEmail`) whose email is unverified.
   - **Expected:** The row shows an `Unverified` badge or similar indicator.

3. Click **Verify email** (or the verify action) for that user.
   - **Expected:** The badge updates to `Verified`. No page reload required.

4. Log out. Log in as `$newUserEmail` using the password set during sign-up.

5. Verify the verification banner is absent from the dashboard.
   - **Expected:** User is fully verified and can access all features.

6. Log out. Log back in as `TEST_CREDENTIALS.admin.email` / `TEST_CREDENTIALS.admin.password`.

---

## Notes

- Continue to flow **37-forgot-password**.
