# Test: Plugin Registry Admin

## Overview
Verifies that a platform admin can view the plugin registry at /plugins, that the registry table renders correctly, that search and status filters work, that a plugin can be deactivated with inline confirmation, and that non-admins are redirected away.

## Pre-conditions
- User A is authenticated and has the `platform_admin` role (identified by `PLATFORM_ADMIN_EMAIL` env var)
- User B is authenticated as a regular (non-admin, non-platform-admin) user
- At least two active plugins exist in the plugin registry (created via `POST /api/v1/plugins` or seeded)
- One plugin has `categories: ["payments"]`, name includes "Escrow", and `is_active: true`
- A second plugin has a different category and `is_active: true`

---

## Steps

### 1. Platform admin views /plugins page and sees the registry table

1. Navigate to `/plugins` as User A (platform admin)
2. **Assert** the page heading contains "Plugin Registry"
3. **Assert** the "+ Register Plugin" button is visible (may be disabled)
4. **Assert** the table is visible with at least one row
5. **Assert** each row contains a plugin name, author email, and at least one action button ("Edit" or "Deactivate")

### 2. Active plugins are listed by default

1. Confirm the Status dropdown shows "Active" as the default selected option
2. **Assert** all visible rows represent active plugins (no "Inactive" badge on any row)

### 3. Search input filters the plugin list

1. Type "Escrow" into the search input
2. Wait 400ms for the debounce to fire
3. **Assert** only rows whose name contains "Escrow" (case-insensitive) are displayed
4. Clear the search input (empty string)
5. Wait 400ms
6. **Assert** all active plugins are shown again

### 4. Category filter narrows the list

1. Select "payments" from the Category dropdown
2. **Assert** only rows with the "payments" category chip are shown
3. Select the blank/all-categories option from the Category dropdown
4. **Assert** all active plugins are shown again

### 5. Status filter switches to Inactive view

1. Select "Inactive" from the Status dropdown
2. **Assert** the table either shows rows with an "Inactive" badge or shows the empty state ("No plugins registered yet")
3. Select "All" from the Status dropdown
4. **Assert** both active and any inactive plugins are shown (or the empty state if none exist)

### 6. Deactivate a plugin using inline confirm

1. With Status set to "Active", locate the first plugin row
2. Click the "Deactivate" button on that row
3. **Assert** an inline confirmation appears with text "Really deactivate?" and "Yes" / "No" buttons
4. Click "No"
5. **Assert** the inline confirmation disappears and the row is still present
6. Click "Deactivate" again on the same row
7. **Assert** inline confirmation appears again
8. Click "Yes"
9. **Assert** the row is removed from the table (optimistic update)
10. **Assert** the remaining rows are all still active

### 7. Deactivated plugin appears in Inactive view

1. Select "Inactive" from the Status dropdown
2. **Assert** a row for the plugin deactivated in step 6 is now visible with an "Inactive" badge

### 8. Reactivate an inactive plugin

1. With Status set to "Inactive", locate the deactivated plugin row
2. **Assert** a "Reactivate" button is visible on that row (no "Deactivate" button)
3. Click "Reactivate"
4. **Assert** the row is removed from the Inactive list (the filter refreshes)
5. Select "Active" from the Status dropdown
6. **Assert** the reactivated plugin appears in the Active list again

### 9. Edit button opens EditPluginModal

1. With Status set to "Active", click the "Edit" button on any plugin row
2. **Assert** the Edit Plugin modal appears with the plugin's current name pre-filled
3. Close the modal (click the close button or press Escape)
4. **Assert** the modal is no longer visible

### 10. Non-admin is redirected away from /plugins

1. Navigate to `/plugins` as User B (regular user)
2. **Assert** the user is redirected to `/` (the home/boards page)
3. **Assert** the "Plugin Registry" heading is NOT visible

---

## Expected Result
- Platform admins can view, search, filter, deactivate, reactivate, and edit plugins from the registry table
- The inline deactivate confirm prevents accidental deactivations
- Status and category filters correctly narrow the list
- Non-admins cannot access /plugins and are silently redirected to /
