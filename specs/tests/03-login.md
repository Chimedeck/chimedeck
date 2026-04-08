# 03. Login

**Prerequisites:** An account exists for `TEST_CREDENTIALS.admin.email`.  
**Continues from:** Logged-out state (or start here if bypassing flows 01–02).  
**Ends with:** Logged in as admin, on the main dashboard.

---

## Steps

1. Navigate to `{TEST_CREDENTIALS.baseUrl}`.
   - **Expected:** Login page or home page loads.

2. Click **Log in** if not already on the login form.

3. Fill in:
   - **Email:** `TEST_CREDENTIALS.admin.email`
   - **Password:** `TEST_CREDENTIALS.admin.password`

4. Click **Log in** / **Sign in**.
   - **Expected:** Redirect to the main dashboard or workspace view. The user's name/avatar is visible in the top bar.

5. Confirm no error messages are shown.

---

## Notes

- If already logged in (continuing from flow 02), skip this flow.
- Store the session cookie / token as `$adminToken` for API calls in later flows.
