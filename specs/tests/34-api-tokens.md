# 34. API Token Settings

**Prerequisites:** Flow 03 (Login) completed. Logged in as admin.  
**Continues from:** Any page.  
**Ends with:** An API token created, copied, and revoked.

---

## Steps

### Navigate

1. Open profile/account settings and navigate to the **API Tokens** section (or `{TEST_CREDENTIALS.baseUrl}/settings/api-tokens`).
   - **Expected:** API Tokens page loads. Existing tokens (if any) are listed. A **Create token** button is visible.

### Create Token

2. Click **Create token** (or **Generate new token**).
   - **Expected:** A form or dialog appears asking for a token name.

3. Enter the name `Test Token` and confirm.
   - **Expected:** The new token value is shown **once** in a reveal dialog or inline. A **Copy** button is present.

4. Click **Copy**.
   - **Expected:** Token value is copied to clipboard. Confirm the copy with a brief `Copied!` indicator.

5. Dismiss the reveal dialog.
   - **Expected:** `Test Token` appears in the tokens list with a masked value and creation date. Full token is no longer visible.

### Use Token (API validation)

6. Make an authenticated API call using the copied token:
   ```http
   GET {TEST_CREDENTIALS.baseUrl}/api/v1/workspaces
   Authorization: Bearer <copied-token>
   ```
   - **Expected:** `200 OK` with workspace data (token is valid).

### Revoke Token

7. In the tokens list, click **Revoke** (or **Delete**) next to `Test Token`.
   - **Expected:** Confirmation prompt appears.

8. Confirm revocation.
   - **Expected:** `Test Token` removed from the list.

9. Repeat the API call from step 6 with the same token.
   - **Expected:** `401 Unauthorized` (token is no longer valid).

---

## Notes

- Continue to flow **35-admin-invite-user**.
