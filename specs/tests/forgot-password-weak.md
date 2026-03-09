# Unit: Weak Password Rejected on Reset

## Goal
Verify that the reset-password endpoint enforces password strength rules
and rejects passwords that don't meet the minimum requirements.

## Test Cases

### Case 1: Password too short (< 8 chars)
- POST `/api/v1/auth/reset-password` with valid token + `{ password: 'Abc1' }`
- Expected: `422 { name: 'password-too-weak' }`

### Case 2: No letter in password
- POST with valid token + `{ password: '12345678' }`
- Expected: `422 { name: 'password-too-weak' }`

### Case 3: No number in password
- POST with valid token + `{ password: 'abcdefgh' }`
- Expected: `422 { name: 'password-too-weak' }`

### Case 4: Valid password
- POST with valid token + `{ password: 'ValidPass1' }`
- Expected: `200 { data: { reset: true } }`

### Case 5: Client-side mismatch
- On the ResetPasswordPage, enter mismatching password/confirm-password
- Expected: inline error "Passwords do not match." before any API call
