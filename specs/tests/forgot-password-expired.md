# Unit: Expired Token Rejected

## Goal
Verify that a password reset token past its 1-hour expiry is rejected
with the correct error name.

## Test Cases

### Case 1: Expired token
- Insert a user with `password_reset_token = 'expiredtoken'` and
  `password_reset_token_expires_at = now - 2 hours`
- POST `/api/v1/auth/reset-password` with `{ token: 'expiredtoken', password: 'ValidPass1' }`
- Expected: `400 { name: 'invalid-or-expired-token' }`

### Case 2: Token from future (clock skew edge case)
- Token expiry set to now - 1 second
- Expected: same 400 rejection

### Case 3: Non-existent token
- POST with a random 64-char hex token not in the DB
- Expected: `400 { name: 'invalid-or-expired-token' }`
