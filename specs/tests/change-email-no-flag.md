> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Change Email — Immediate Change (Flag Disabled)

**Type:** Unit / API  
**Sprint:** 40 — Change Email (with Re-verification)

## Steps (EMAIL_VERIFICATION_ENABLED=false)

1. Authenticate as a user
2. POST `/api/v1/auth/change-email` with `{ email: "new@example.com", currentPassword: "..." }`
3. Assert response status is `200`
4. Assert response body is `{ data: { email: "new@example.com" } }` (no `requiresConfirmation`)
5. Assert `users` table row has `email = "new@example.com"` and all pending fields are `null`
6. Assert all refresh tokens for the user have been deleted
7. Assert no confirmation email was sent (console log is empty / SES was not called)