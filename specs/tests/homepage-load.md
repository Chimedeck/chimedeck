# Test: Homepage Load

## Feature
Homepage rendering and basic navigation.

## Base URL
Use the `BASE_URL` environment variable (default: `http://localhost:5173`).

## Pre-conditions
- Development server is running at `BASE_URL`.

---

## Scenario Steps

### Step 1 – Navigate to the homepage
- Open `{BASE_URL}` in the browser.
- **Expected:** Page loads without a network error or blank screen.

### Step 2 – Verify page title
- Check the page `<title>`.
- **Expected:** Title is not empty and contains the project/brand name.

### Step 3 – Verify main navigation is visible
- Locate the primary navigation bar (header / nav element).
- **Expected:** Navigation bar is visible.

### Step 4 – Verify a login / sign-up link exists
- Look for a "Log in" or "Sign up" link in the navigation.
- **Expected:** At least one auth-related link is present and clickable.

### Step 5 – Click the login link
- Click the "Log in" link.
- **Expected:** Browser navigates to the login page (URL contains `/login` or similar).

---

## Pass Criteria
All 5 steps complete without errors and all expected conditions are met.

## Fail Criteria
Any step that does not meet its expected condition causes the test to fail.
Report the failing step number, the actual result, and any console errors observed.
