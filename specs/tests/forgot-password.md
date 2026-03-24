# E2E: Forgot Password → Reset Password → Login

## Goal
Verify the full password reset flow works end-to-end in development mode
(SES_ENABLED=false, token logged to console).

## Steps

1. Navigate to `/login`
2. Click "Forgot password?" link
3. Verify redirect to `/forgot-password`
4. Verify page title is "Forgot Password — Taskinate"
5. Enter registered email address
6. Click "Send reset link"
7. Verify success message is shown: "If an account exists for {email}, we've sent a reset link."
8. Inspect server console logs for the reset URL containing the token
9. Navigate to the reset URL from the logs
10. Verify page title is "Reset Password — Taskinate"
11. Enter a new strong password (e.g. "NewPass123")
12. Confirm the new password
13. Click "Reset password"
14. Verify redirect to `/login` with toast: "Password reset! Please log in."
15. Log in with the new password
16. Verify successful authentication

## Expected Results

- `/forgot-password` is accessible without auth
- `/reset-password?token=<valid>` is accessible without auth
- Password is updated successfully
- Old sessions are invalidated
- New password works for login
