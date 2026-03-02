# Test: Auth — Sign Up

**Type:** Playwright end-to-end  
**Sprint:** 16 — Authentication UI

## Happy path

1. Navigate to `http://localhost:5173/signup`
2. Assert the heading "Create an account" is visible
3. Fill the "Full name" field with `Test User`
4. Fill the "Email" field with a unique address, e.g. `newuser+<timestamp>@example.com`
5. Fill the "Password" field with `password1`
6. Fill the "Confirm password" field with `password1`
7. Click the "Create account" button
8. Assert the URL changes to `/workspaces`

## Validation — empty submit

1. Navigate to `http://localhost:5173/signup`
2. Click "Create account" without filling any field
3. Assert "Full name is required" is visible
4. Assert "Email is required" is visible
5. Assert "Password is required" is visible
6. Assert "Please confirm your password" is visible

## Validation — password rules

1. Fill the password field with `short` (less than 8 characters)
2. Tab away — assert "Password must be at least 8 characters" is visible
3. Fill the password field with `longpassword` (no digit)
4. Tab away — assert "Password must contain at least one number" is visible

## Validation — password mismatch

1. Fill password with `password1` and confirm with `different1`
2. Tab away from confirm field — assert "Passwords do not match" is visible

## API error — email already taken

1. Sign up with an email that is already registered
2. Assert the error "An account with this email already exists" is visible below the form
3. Assert the URL is still `/signup`

## Link to login

1. Navigate to `/signup`
2. Click the "Sign in" link
3. Assert the URL changes to `/login`
