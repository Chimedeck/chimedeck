> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Unit: Unknown Email Returns sent:true (No Enumeration)

## Goal
Verify that POSTing to `/api/v1/auth/forgot-password` with an email that
has no registered account still returns 200 with `{ data: { sent: true } }`.

## Test Cases

### Case 1: Unregistered email
- POST `/api/v1/auth/forgot-password` with `{ email: 'notregistered@example.com' }`
- Expected: `200 { data: { sent: true } }`
- No email should be sent / logged
- No change to the database

### Case 2: Registered email
- POST `/api/v1/auth/forgot-password` with a registered email
- Expected: `200 { data: { sent: true } }`
- Reset token stored in DB
- Email logged to console (SES_ENABLED=false)

Both cases must return identical responses to prevent user enumeration.