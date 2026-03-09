# Test: Change Email — Full Flow

**Type:** Playwright end-to-end  
**Sprint:** 40 — Change Email (with Re-verification)

## Steps (EMAIL_VERIFICATION_ENABLED=true)

1. Log in with a valid account
2. Navigate to `/settings/profile`
3. Locate the "Change email address" section
4. Fill the "New email address" field with a fresh unused address
5. Fill the "Current password" field with the correct password
6. Click "Request email change"
7. Assert the `EmailChangePending` banner appears, showing the new email address
8. Check console / SES logs for the confirmation email link containing `confirm-email-change?token=`
9. Navigate to the confirmation URL
10. Assert the page shows "Email updated! Please log in with your new address."
11. Assert the page redirects to `/login` after ~1.5 s
12. Log in with the **new** email — assert login succeeds
13. Assert the old email is **no longer** valid for login
