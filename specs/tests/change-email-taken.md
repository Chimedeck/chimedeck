> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Change Email — Duplicate Email Rejected

**Type:** Unit / API  
**Sprint:** 40 — Change Email (with Re-verification)

## Steps

1. Create user A (email: `a@example.com`) and user B (email: `b@example.com`)
2. Authenticate as user A
3. POST `/api/v1/auth/change-email` with `{ email: "b@example.com", currentPassword: "..." }`
4. Assert response status is `409`
5. Assert response body contains `{ name: "email-already-in-use" }`
6. Assert no `pending_email` or `email_change_token` is stored for user A