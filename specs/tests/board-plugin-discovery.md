# Test: Board Plugin Discovery & Enable Flow

## Overview
Verifies that a board admin can view the two-section Plugins dashboard (Enabled + Discover),
see the empty state when no plugins are enabled, enable a plugin from the Discover section
(which moves it to Enabled), disable an enabled plugin (which returns it to Discover),
search and filter in the Discover section, and see the correct empty state when the
global registry has no active plugins.

## Pre-conditions
- User A is authenticated and has `ADMIN` or `OWNER` role on Board B
- Board B has `boardId` known
- At least two globally active plugins exist in the registry (seeded or created via `POST /api/v1/plugins`)
  - Plugin P1 has `categories: ["payments"]`, name includes "Pay"
  - Plugin P2 has a different category, name does not include "Pay"
- Neither P1 nor P2 is currently enabled on Board B (clean slate for each test run)
- No other plugins are enabled on Board B at test start

---

## Steps

### 1. Board admin opens Plugins tab with no enabled plugins — sees empty state

1. Navigate to `/boards/:boardId/settings/plugins` as User A
2. **Assert** the page heading "Plugins" is visible
3. **Assert** the section heading "Enabled on this board" is visible
4. **Assert** the puzzle-piece empty state and text "No plugins enabled on this board yet." is visible under "Enabled on this board"
5. **Assert** the section heading "Discover Plugins" is visible
6. **Assert** at least two plugin rows (P1 and P2) appear under "Discover Plugins"

### 2. Board admin enables a plugin from Discover — it moves to Enabled section

1. Locate Plugin P1's row in the Discover section
2. Click the "Enable" button on P1
3. **Assert** P1 disappears from the Discover section (optimistic update)
4. **Assert** P1 appears in the "Enabled on this board" section with a Disable button visible
5. **Assert** P2 remains in the Discover section

### 3. Board admin disables an enabled plugin — it moves back to Discover

1. Locate Plugin P1's row in the "Enabled on this board" section
2. **Assert** a "Disable" button is visible on P1's row
3. Click the "Disable" button
4. **Assert** P1 disappears from "Enabled on this board" (optimistic update)
5. **Assert** P1 re-appears in the Discover section
6. **Assert** "No plugins enabled on this board yet." empty state is shown again

### 4. Board admin searches in Discover section — results filter

1. Type "Pay" into the search input in the Discover section
2. Wait 400ms for the debounce to fire
3. **Assert** only rows whose name matches "Pay" (case-insensitive) are shown in Discover
4. **Assert** P2 (which does not match "Pay") is NOT visible
5. Clear the search input (empty string)
6. Wait 400ms
7. **Assert** both P1 and P2 are visible again in the Discover section

### 5. Category filter narrows Discover results

1. Select "payments" from the Category dropdown in the Discover section
2. **Assert** only P1 (the "payments" plugin) is visible in the Discover section
3. **Assert** P2 (different category) is NOT visible
4. Select the blank/all-categories option
5. **Assert** both P1 and P2 are visible again

### 6. Empty Discover state when global registry has no active plugins

1. Deactivate all plugins in the registry (via `PATCH /api/v1/plugins/:id` with `{ is_active: false }` as platform admin), or use a board that has all registry plugins already enabled
2. Navigate to `/boards/:boardId/settings/plugins` (fresh board with no available plugins)
3. **Assert** the Discover section shows: "No plugins available. Ask your platform administrator to register plugins."
4. **Assert** the Discover section does NOT show any plugin rows

---

## Expected Result
- The Plugins dashboard shows two distinct sections: "Enabled on this board" and "Discover Plugins"
- Enabling a plugin moves it optimistically from Discover → Enabled
- Disabling an enabled plugin moves it back from Enabled → Discover
- The "No plugins enabled on this board yet." empty state displays when zero plugins are enabled
- The "No plugins available. Ask your platform administrator to register plugins." empty state displays when the global registry is empty (from this board's perspective)
- Search and category filter in the Discover section correctly narrow results
