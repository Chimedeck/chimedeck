> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Email Verification — Full Flow

**Type:** Playwright end-to-end  
**Sprint:** 23 — Email Verification via AWS SES

## Setup

- `EMAIL_VERIFICATION_ENABLED=true`
- `SES_ENABLED=false` (console logging mode)

## Steps: Register → Verify → Login

1. Navigate to `http://localhost:5173/signup`
2. Fill in name, email, and password fields
3. Click "Create account"
4. Assert the heading "Verify your email" is visible
5. Assert the message contains the registered email
6. Assert no redirect to `/workspaces` (user is not authenticated)
7. Check server console logs for a line matching `[email:console]` containing the verification token URL
8. Extract the token from the logged URL
9. Navigate to `http://localhost:5173/verify-email?token=<token>`
10. Assert the success message "Email verified! You can now log in." is visible
11. Assert the user is redirected to `/workspaces` within 2 seconds
12. Confirm user is now authenticated (header/sidebar visible)

## Error path: Expired/Invalid token

1. Navigate to `http://localhost:5173/verify-email?token=invalidtoken123`
2. Assert the error message "This link is invalid or has expired." is visible
3. Assert the "Resend verification email" button is visible
4. Click "Resend verification email"
5. Assert the success message "A new verification email has been sent." appears

## Login with unverified account

1. Register a new user (verification enabled)
2. Attempt to log in before verifying email
3. Navigate to `http://localhost:5173/login`
4. Enter credentials and click "Sign in"
5. Assert a 403 response with `email-not-verified` error (network tab)
6. Assert the login page remains visible (no redirect)