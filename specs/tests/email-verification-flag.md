# Test: Email Verification — Feature Flag Off

**Type:** Unit / integration  
**Sprint:** 23 — Email Verification via AWS SES

## Setup

- `EMAIL_VERIFICATION_ENABLED=false` (default)
- `SES_ENABLED=false`

## Steps: Flag disabled — existing flows unchanged

1. Register a new user via `POST /api/v1/auth/register`
   - Assert HTTP 201 response
   - Assert response body contains `accessToken` and `user` fields
   - Assert `requiresVerification` is NOT present
2. Log in with the new user via `POST /api/v1/auth/token`
   - Assert HTTP 200 response
   - Assert `accessToken` is returned
3. Confirm no verification email was logged to console
4. Confirm the user's `email_verified` column is `true` in the database (backfilled / set to true on insert)

## Steps: Flag enabled — SES_ENABLED=false routes to console

1. Set `EMAIL_VERIFICATION_ENABLED=true`, `SES_ENABLED=false`
2. Register a new user via `POST /api/v1/auth/register`
   - Assert HTTP 201 response with `{ data: { requiresVerification: true } }`
   - Assert NO `accessToken` in response
3. Assert server console logs contain `[email:console]` with the verification URL
4. Attempt login before verification
   - Assert HTTP 403 with `{ name: 'email-not-verified' }`
5. Use the token from the console log, call `GET /api/v1/auth/verify-email?token=<token>`
   - Assert HTTP 200 with `accessToken` and `user`
6. Log in again after verification
   - Assert HTTP 200 with `accessToken`

## Resend rate limit

1. With `EMAIL_VERIFICATION_ENABLED=true` and an unverified user token
2. Call `POST /api/v1/auth/resend-verification` 3 times — each should return 200
3. Call it a 4th time — assert HTTP 429 with `{ name: 'rate-limit-exceeded' }`
