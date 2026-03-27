# 01. Sign Up

**Prerequisites:** None — this is the first step of the entire test suite.  
**Ends with:** Browser on the post-registration screen (email verification prompt or dashboard). A unique `$newUserEmail` is stored for use if needed in later flows.

---

## Steps

1. Navigate to `{TEST_CREDENTIALS.baseUrl}`.
   - **Expected:** Home / marketing page or login page loads.

2. Click the **Sign Up** (or **Create account**) button.
   - **Expected:** Registration form appears with fields for Name, Email, and Password.

3. Fill in the form:
   - **Name:** `Test User`
   - **Email:** a unique address, e.g. `test+{timestamp}@example.com` — store this as `$newUserEmail`
   - **Password:** any password meeting strength requirements (e.g. `TestPass1!`)

4. Submit the form.
   - **Expected:** Account is created. The app either shows an email-verification prompt or redirects to the main dashboard.

5. Verify the page title or heading confirms registration success (no error messages visible).

---

## Notes

- If the app shows "Email already in use", use a different timestamp suffix.
- Continue directly to flow **02-verify-email** without logging out.
