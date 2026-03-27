> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Playwright MCP Test: Admin Auto-Verify Email — UI

## Overview

These tests cover the "Mark email as verified" checkbox in `InviteExternalUserModal` and the email
verification status label in `CredentialSheet`.

**Feature flag dependency**: The checkbox is only rendered when `EMAIL_VERIFICATION_ENABLED` is
`true`. Tests that assert checkbox presence must ensure the flag is enabled.

---

## Test 1 — Checkbox defaults to checked when EMAIL_VERIFICATION_ENABLED is true

```
navigate to /login
log in as admin user (admin@example.com / adminpassword)
navigate to workspace dashboard
click "Invite External User" button in sidebar
assert: modal opens with title "Invite External User"
assert: checkbox with label "Mark email as verified" is present
assert: checkbox is checked by default
```

---

## Test 2 — Submit with checkbox checked → CredentialSheet shows "Email verified"

```
navigate to /login
log in as admin user
navigate to workspace dashboard
click "Invite External User" button in sidebar
fill in email: "verified-user@example.com"
fill in display name: "Verified User"
ensure "Mark email as verified" checkbox is checked (it should be by default)
click "Create account"
assert: CredentialSheet is visible with title "New account created"
assert: element with data-testid="email-verification-status" has text "Email verified"
assert: element has green styling (bg-green-900/30 class or equivalent)
```

---

## Test 3 — Submit with checkbox unchecked → CredentialSheet shows "Email not verified"

```
navigate to /login
log in as admin user
navigate to workspace dashboard
click "Invite External User" button in sidebar
fill in email: "unverified-user@example.com"
fill in display name: "Unverified User"
uncheck "Mark email as verified" checkbox
click "Create account"
assert: CredentialSheet is visible with title "New account created"
assert: element with data-testid="email-verification-status" has text "Email not verified"
assert: element has yellow styling (bg-yellow-900/30 class or equivalent)
```

---

## Test 4 — Checkbox is hidden when EMAIL_VERIFICATION_ENABLED is false

```
configure server: set EMAIL_VERIFICATION_ENABLED = false (or use a test seed that sets flag to false)
navigate to /login
log in as admin user
navigate to workspace dashboard
click "Invite External User" button in sidebar
assert: "Mark email as verified" checkbox is NOT present in the DOM
```

---

## Test 5 — autoVerifyEmail is forwarded in the API request

```
navigate to /login
log in as admin user
navigate to workspace dashboard
intercept POST /api/v1/admin/users
click "Invite External User" button in sidebar
fill in email: "api-check@example.com"
fill in display name: "API Check User"
ensure "Mark email as verified" checkbox is checked
click "Create account"
assert: intercepted request body contains { autoVerifyEmail: true }
```

---

## Notes

- `data-testid="auto-verify-email-checkbox"` is set on the checkbox input for reliable selection.
- `data-testid="email-verification-status"` is set on the status paragraph in CredentialSheet.
- The checkbox only appears in the form; it is not shown in CredentialSheet.
- When `EMAIL_VERIFICATION_ENABLED` is false, `autoVerifyEmail` is omitted from the request body.