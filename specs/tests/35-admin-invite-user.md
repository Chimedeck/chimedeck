# 35. Admin — Invite External User

**Prerequisites:** Flow 03 (Login) completed. Logged in as admin.  
**Continues from:** Any page.  
**Ends with:** A new external user account created; credential sheet shown and copied.

---

## Steps

### Open Invite Dialog

1. Click **Invite External User** in the sidebar (or `{TEST_CREDENTIALS.baseUrl}/admin/invite`).
   - **Expected:** A modal opens with title `Invite External User` and description `Create an account for…`.

2. Verify the close button (✕) is present.

### Fill Form

3. Fill in:
   - **Email:** `external+{timestamp}@example.com`
   - **Display name:** `External Tester`

4. Select password mode **Generate automatically**.
   - **Expected:** Password field is hidden; the system will generate a password.

5. Ensure the **Send welcome email** toggle is on.

6. Ensure the **Auto-verify email** toggle is on.

### Submit

7. Click **Create account**.
   - **Expected:** Modal transitions to a credential sheet showing:
     - `New account created`
     - `Email:` (the address entered)
     - `Password:` (the generated password, masked with a reveal toggle)
     - `Login URL:` — must show `TEST_CREDENTIALS.baseUrl` as the base

8. Click **Copy to clipboard** (or each field's copy button).
   - **Expected:** `Copied!` feedback. Clipboard contains the credentials.

9. Click **Done** to close.
   - **Expected:** Modal closes.

### Verify Account Exists

10. API check:
    ```http
    GET {TEST_CREDENTIALS.baseUrl}/api/v1/admin/users
    Authorization: Bearer $adminToken
    ```
    - **Expected:** The new user's email appears in the user list with `verified: true`.

---

## Notes

- Continue to flow **36-admin-email-verification**.
