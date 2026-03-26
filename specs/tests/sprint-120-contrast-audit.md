# Sprint 120 — Text & Contrast Full Audit (Playwright MCP Test)

## Prerequisites
- App running at http://localhost:5173
- Test user: email `test@example.com`, password `password123`
- Board named "Test Board" exists in the workspace

---

## Test Suite 1: Login Page Contrast

### Test 1.1 — Login page in light mode
1. Navigate to `http://localhost:5173/login`
2. Evaluate in browser: `document.documentElement.classList.remove('dark')`
3. Assert page heading text is visible (not white-on-white)
4. Assert form labels are visible
5. Assert input placeholder text is visible
6. Assert "Forgot password?" link is visible

### Test 1.2 — Login page in dark mode
1. Navigate to `http://localhost:5173/login`
2. Evaluate in browser: `document.documentElement.classList.add('dark')`
3. Assert page heading text is visible
4. Assert form labels are visible
5. Assert input placeholder text is visible

---

## Test Suite 2: Workspace Dashboard Contrast

### Test 2.1 — Workspace sidebar in light mode
1. Log in as test user
2. Navigate to `/workspaces`
3. Remove `dark` class from `<html>`
4. Assert sidebar board names are visible
5. Assert section labels are visible

### Test 2.2 — Workspace sidebar in dark mode
1. Navigate to `/workspaces`
2. Add `dark` class to `<html>`
3. Assert sidebar board names are still visible

---

## Test Suite 3: Board View Contrast

### Test 3.1 — Board in light mode
1. Navigate to board view
2. Remove `dark` from `<html>`
3. Assert list headers are visible
4. Assert card titles are visible
5. Assert label chips text is visible (check against chip background)
6. Assert "Add a list" button text is visible

### Test 3.2 — Board in dark mode
1. Navigate to board view
2. Add `dark` to `<html>`
3. Assert list headers are visible
4. Assert card titles are visible
5. Assert "Add a list" button is visible

---

## Test Suite 4: Card Detail Modal Contrast

### Test 4.1 — Card modal in light mode
1. Click a card to open the modal
2. Remove `dark` from `<html>`
3. Assert modal title is visible
4. Assert section headings are visible
5. Assert "Description" placeholder text is visible
6. Assert checklist items (if any) are visible
7. Assert activity feed entries are visible (actor name, timestamp, description)
8. Assert label chips text is visible against chip color

### Test 4.2 — Card modal in dark mode
1. Keep modal open
2. Add `dark` to `<html>`
3. Assert same elements are still visible
4. Assert no white-on-white or invisible text

---

## Test Suite 5: Theme Toggle While Modal Open

### Test 5.1 — Real-time theme switching
1. Open a card modal
2. Remove `dark` from `<html>` (light mode)
3. Assert card title is visible
4. Add `dark` to `<html>` (dark mode)
5. Assert card title is still visible
6. Assert no layout shifts or broken styles

---

## Test Suite 6: Error & Success States Contrast

### Test 6.1 — Error message contrast (light mode)
1. Navigate to login page
2. Remove `dark` from `<html>`
3. Submit form with invalid credentials
4. Assert error message text is visible (using `text-danger` token, should be red)
5. Assert error message has sufficient contrast against background

### Test 6.2 — Error message contrast (dark mode)
1. Same steps with `dark` class on `<html>`
2. Assert error message is still clearly visible

---

## Test Suite 7: Input Placeholder Contrast

### Test 7.1 — Input placeholders in light mode
1. Navigate to login page
2. Remove `dark` from `<html>`
3. Assert email input placeholder is visible (should be `text-subtle` = slate-400)
4. Assert password input placeholder is visible

### Test 7.2 — Input placeholders in dark mode
1. Add `dark` to `<html>`
2. Assert email input placeholder is visible (should be slate-500 in dark mode)

---

---

## Test Suite 8: Notifications Panel Contrast

### Test 8.1 — Notifications in light mode
1. Click the notification bell icon to open the panel
2. Remove `dark` from `<html>`
3. Assert notification title text is readable (dark text on light surface)
4. Assert notification body text is readable
5. Assert timestamps ("2 min ago") are visible (muted grey, not invisible)
6. Assert the "Mark all read" link is readable
7. Assert the notification count badge (red circle with number) is visible

### Test 8.2 — Notifications in dark mode
1. Keep panel open, add `dark` to `<html>`
2. Assert all notification text remains readable (light text on dark surface)
3. Assert the notification count badge remains readable
4. Assert timestamps remain visible in dark mode

---

## Test Suite 9: Profile & Settings Pages Contrast

### Test 9.1 — Profile page in light mode
1. Navigate to the user profile or settings page
2. Remove `dark` from `<html>`
3. Assert section headings are readable
4. Assert field labels ("Display Name", "Email", etc.) are readable
5. Assert read-only metadata values are readable
6. Assert any destructive action text (e.g. "Delete account") uses the danger/red semantic colour

### Test 9.2 — Profile page in dark mode
1. Add `dark` to `<html>`
2. Assert all field labels and values remain readable in dark mode
3. Assert section headings are readable

---

## Test Suite 10: Automation / Plugin / Extension Panels Contrast

### Test 10.1 — Automation panel in both modes
1. Open the Automation panel on a board
2. Remove `dark` from `<html>`
3. Assert panel title and description text are readable
4. Assert automation list items (title, description, schedule text) are readable
5. Add `dark` to `<html>`
6. Assert all text remains readable in dark mode

### Test 10.2 — Plugin panel in both modes
1. Open the Plugin/Extension panel
2. Remove `dark` from `<html>`
3. Assert plugin names, descriptions, and table cell content are readable
4. Assert install/uninstall button labels are readable
5. Add `dark` to `<html>`
6. Assert all text remains readable in dark mode

---

## Verification Commands (run in terminal)

After all fixes are applied, verify zero non-exception hardcoded colors remain:

```bash
# Should return only [theme-exception] tagged lines or colored-background buttons/chips
grep -rn 'text-white\b' src/ --include="*.tsx" --include="*.ts" | grep -v 'theme-exception'

# Should return zero results
grep -rn 'text-red-[0-9]' src/ --include="*.tsx" | grep -v 'theme-exception'
grep -rn 'text-green-[0-9]' src/ --include="*.tsx" | grep -v 'theme-exception'
grep -rn 'text-gray-[0-9]' src/ --include="*.tsx" | grep -v 'theme-exception'

# Should return zero results (non-exception bg-white and bg-gray)
grep -rn 'bg-gray-[0-9]' src/ --include="*.tsx" | grep -v 'theme-exception'
grep -rn '\bbg-white\b' src/ --include="*.tsx" | grep -v 'theme-exception'

# Check for stale dark: paired variants that should have been removed
grep -rn 'dark:bg-slate-[0-9]\|dark:bg-gray-[0-9]' src/ --include="*.tsx" | grep -v 'theme-exception'
```
