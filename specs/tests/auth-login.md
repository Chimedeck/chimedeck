> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Auth — Login

**Type:** Playwright end-to-end  
**Sprint:** 16 — Authentication UI

## Steps

1. Navigate to `http://localhost:5173/login`
2. Assert the heading "Welcome back" is visible
3. Assert the "Email" label and input are present
4. Assert the "Password" label and input are present
5. Fill the email field with `test@example.com`
6. Fill the password field with `password123`
7. Click the "Sign in" button
8. Assert the URL changes to `/workspaces`
9. Assert the user avatar or display name is visible in the header

## Error path

1. Navigate to `http://localhost:5173/login`
2. Fill the email field with `wrong@example.com`
3. Fill the password field with `badpassword`
4. Click the "Sign in" button
5. Assert the error message "Invalid email or password" is visible below the form
6. Assert the URL does **not** change (still `/login`)

## Password visibility toggle

1. Navigate to `http://localhost:5173/login`
2. Assert the password field type is `password`
3. Click the show-password toggle button (aria-label "Show password")
4. Assert the password field type changes to `text`
5. Click the toggle again (aria-label "Hide password")
6. Assert the field type reverts to `password`

## Keyboard navigation

1. Navigate to `http://localhost:5173/login`
2. Tab through all interactive elements — assert focus order: email → password → show-toggle → Sign in → Continue with Google → Continue with GitHub → Sign up link
3. With email and password filled, press Enter on the Sign in button — assert form submits