# Sidebar Collapsible Drawer — Playwright MCP Test Scenarios

Tests covering desktop collapsible sidebar, icon-only rail, tooltip behavior, and persistence after reload (Sprint 85).

---

## Prerequisites

- User is authenticated and on any private page (e.g., `/workspaces/:id/boards`).
- Viewport is desktop (≥ 768px wide).
- `localStorage` key `sidebar_collapsed` may be pre-set for persistence tests.

---

## Scenario 1: Desktop sidebar is expanded by default

**Given** the user loads the app for the first time (no `sidebar_collapsed` in localStorage)  
**When** the app loads on a desktop viewport  
**Then**:
- `[data-testid="sidebar"]` is visible
- `[data-testid="sidebar"]` has `data-collapsed="false"`
- `[data-testid="sidebar"]` computed width is `256px` (w-64)
- Nav labels (e.g., "Boards", "Members", "All Workspaces") are visible as text
- `[data-testid="sidebar-toggle"]` is visible

---

## Scenario 2: Sidebar collapses on toggle click

**Given** the sidebar is expanded  
**When** the user clicks `[data-testid="sidebar-toggle"]`  
**Then**:
- `[data-testid="sidebar"]` has `data-collapsed="true"`
- `[data-testid="sidebar"]` computed width transitions to `64px` (w-16)
- Nav labels ("Boards", "Members", etc.) are no longer visible
- Nav icons are still visible (e.g., `RectangleStackIcon`, `UsersIcon`)
- `[data-testid="sidebar-toggle"]` shows a right-facing chevron icon

---

## Scenario 3: Sidebar expands on second toggle click

**Given** the sidebar is collapsed (`data-collapsed="true"`)  
**When** the user clicks `[data-testid="sidebar-toggle"]`  
**Then**:
- `[data-testid="sidebar"]` has `data-collapsed="false"`
- `[data-testid="sidebar"]` computed width is `256px`
- Nav labels reappear
- `[data-testid="sidebar-toggle"]` shows a left-facing chevron icon

---

## Scenario 4: Collapsed state persists after page reload

**Given** the user collapses the sidebar (clicks toggle, `data-collapsed="true"`)  
**When** the user reloads the page (`location.reload()`)  
**Then**:
- `[data-testid="sidebar"]` has `data-collapsed="true"` immediately after load
- `localStorage.getItem('sidebar_collapsed')` equals `"true"`
- Sidebar width is `64px` (icon-only rail), no labels visible

---

## Scenario 5: Expanded state persists after page reload

**Given** the user expands the sidebar (toggle to expanded, `data-collapsed="false"`)  
**And** `localStorage.setItem('sidebar_collapsed', 'false')` is set  
**When** the user reloads the page  
**Then**:
- `[data-testid="sidebar"]` has `data-collapsed="false"`
- Sidebar width is `256px` and labels are visible

---

## Scenario 6: Icon-only rail shows tooltip on icon hover (collapsed state)

**Given** the sidebar is collapsed (`data-collapsed="true"`)  
**When** the user hovers over a nav icon (e.g., the Boards icon)  
**Then**:
- A tooltip element with `role="tooltip"` appears near the icon
- The tooltip text matches the nav item label (e.g., "Boards")
- The tooltip disappears when the pointer leaves the icon

---

## Scenario 7: Tooltips are not shown when sidebar is expanded

**Given** the sidebar is expanded (`data-collapsed="false"`)  
**When** the user hovers over any nav item  
**Then**:
- No tooltip element with `role="tooltip"` is visible
- Labels are directly visible inline in the nav items

---

## Scenario 8: Toggle button is keyboard-accessible

**Given** the sidebar is expanded  
**When** the user tabs to `[data-testid="sidebar-toggle"]` and presses Enter  
**Then**:
- Sidebar collapses (`data-collapsed="true"`)
- Focus remains on the toggle button
- `aria-label` of the toggle button reads "Collapse sidebar" before toggle and "Expand sidebar" after toggle

---

## Scenario 9: Collapsed sidebar nav items are accessible

**Given** the sidebar is collapsed  
**When** inspecting nav link elements  
**Then**:
- Each nav link has an `aria-label` matching its text label (e.g., `aria-label="Boards"`)
- Collapsed icon-only buttons are keyboard-navigable via Tab
- Pressing Enter on a nav link navigates to the correct route

---

## Scenario 10: Workspace switcher shows avatar in collapsed mode

**Given** the sidebar is collapsed and the user has an active workspace  
**When** the user views the workspace switcher area  
**Then**:
- The full workspace name text is not visible
- A compact workspace initial avatar button is shown
- Hovering shows a tooltip with the full workspace name

---

## Scenario 11: User menu shows avatar-only in collapsed mode

**Given** the sidebar is collapsed  
**When** the user views the user menu area at the bottom of the sidebar  
**Then**:
- The user's display name / nickname text is not visible
- Only the user avatar (image or initial) is visible
- Hovering shows a tooltip with the user's display name
- Clicking the avatar opens the user menu popup

---

## Scenario 12: Sidebar does not affect mobile layout

**Given** the viewport is mobile (< 768px width)  
**When** the page loads  
**Then**:
- The desktop sidebar (`[data-testid="sidebar"]`) is hidden (not rendered or `display: none`)
- The mobile hamburger topbar is visible
- `localStorage.getItem('sidebar_collapsed')` has no effect on mobile layout

---

---

## Scenario 13: Mobile hamburger opens the drawer

**Given** the viewport is mobile (< 768px width)  
**And** the user is on a private page  
**When** the user clicks `[data-testid="mobile-sidebar-toggle"]`  
**Then**:
- `[role="dialog"][aria-label="Navigation"]` becomes visible
- The drawer slides in from the left (translate-x transition)
- `[data-testid="mobile-sidebar-toggle"]` has `aria-expanded="true"`
- `[data-testid="mobile-sidebar-toggle"]` has `aria-controls="mobile-sidebar"`
- Focus moves to the first focusable element inside the drawer

---

## Scenario 14: Mobile backdrop click closes the drawer

**Given** the mobile drawer is open  
**When** the user clicks `[data-testid="mobile-sidebar-backdrop"]`  
**Then**:
- The drawer slides out to the left (`-translate-x-full`)
- `[role="dialog"]` is no longer interactive (`aria-hidden="true"` on wrapper)
- `[data-testid="mobile-sidebar-toggle"]` has `aria-expanded="false"`

---

## Scenario 15: Escape key closes the mobile drawer

**Given** the mobile drawer is open and focus is inside the drawer  
**When** the user presses the `Escape` key  
**Then**:
- The drawer closes (slides out to the left)
- Focus returns to the page content

---

## Scenario 16: Tab key cycles focus within the mobile drawer (focus trap)

**Given** the mobile drawer is open  
**When** the user presses `Tab` from the last focusable element in the drawer  
**Then**:
- Focus wraps to the first focusable element inside the drawer (not leaving the drawer)

**When** the user presses `Shift+Tab` from the first focusable element  
**Then**:
- Focus wraps to the last focusable element inside the drawer

---

## Scenario 17: Clicking a nav item in the mobile drawer closes it

**Given** the mobile drawer is open  
**When** the user clicks a nav item (e.g., "Boards")  
**Then**:
- Navigation to the target route occurs
- The drawer closes (slides out)

---

## Scenario 18: Mobile drawer has correct ARIA attributes

**Given** the mobile drawer is open  
**When** inspecting the drawer container element  
**Then**:
- `role="dialog"` is present
- `aria-modal="true"` is present
- `aria-label="Navigation"` is present
- The hamburger button has `aria-expanded="true"` while open

---

## Scenario 19: Escape does NOT close desktop sidebar

**Given** the viewport is desktop (≥ 768px width)  
**And** the desktop sidebar is visible  
**When** the user presses the `Escape` key  
**Then**:
- The desktop sidebar remains visible (`data-collapsed` attribute unchanged)
- No drawer/overlay interaction occurs

---

## Scenario 20: localStorage does not affect mobile drawer state

**Given** the viewport is mobile (< 768px width)  
**And** `localStorage.setItem('sidebar_collapsed', 'true')` is set  
**When** the page loads  
**Then**:
- The mobile drawer is closed by default (not influenced by localStorage)
- The desktop sidebar would be collapsed on a desktop viewport, but on mobile the drawer is unaffected

---

## Scenario 21: Mobile drawer shows fully expanded sidebar (no collapse rail)

**Given** the mobile drawer is open  
**When** inspecting the sidebar within the drawer  
**Then**:
- Nav labels (e.g., "Boards", "Members") are visible as text
- The collapse toggle button (`[data-testid="sidebar-toggle"]`) is NOT visible inside the drawer
- The sidebar uses full-width expanded layout

---

---

## Viewport Matrix

The following table defines the expected sidebar/topbar behaviour at each canonical breakpoint. Tests should set the viewport before each row.

| Viewport | Width | Desktop sidebar visible | Mobile topbar visible | Topbar height | Drawer available |
|----------|-------|------------------------|----------------------|---------------|-----------------|
| Mobile S | 375px | ❌ (hidden) | ✅ | 56px (h-14) | ✅ |
| Mobile L | 425px | ❌ (hidden) | ✅ | 56px (h-14) | ✅ |
| Tablet   | 768px | ✅ (md breakpoint) | ❌ (hidden) | 56px (h-14) | ❌ |
| Laptop   | 1024px | ✅ | ❌ | 56px (h-14) | ❌ |
| Desktop  | 1280px | ✅ | ❌ | 56px (h-14) | ❌ |
| Wide     | 1920px | ✅ | ❌ | 56px (h-14) | ❌ |

---

## Scenario 22: Board page renders correctly with expanded desktop sidebar

**Given** the viewport is desktop (≥ 768px) and the sidebar is expanded  
**When** the user navigates to `/boards/:boardId`  
**Then**:
- The sidebar (`[data-testid="sidebar"]`) is visible with width `256px`
- The board content area fills the remaining horizontal space (flex-1)
- No horizontal scrollbar appears on the AppShell root
- The board kanban canvas scrolls independently within the content area
- No content is obscured behind the sidebar

---

## Scenario 23: Board page renders correctly with collapsed desktop sidebar

**Given** the viewport is desktop (≥ 768px) and the sidebar is collapsed  
**When** the user navigates to `/boards/:boardId`  
**Then**:
- The sidebar (`[data-testid="sidebar"]`) has width `64px`
- The board content area gains the extra `192px` of horizontal space
- No layout overflow or horizontal scroll appears at the AppShell level
- Board column labels and cards are still fully readable

---

## Scenario 24: Card modal opens correctly with collapsed sidebar

**Given** the desktop sidebar is collapsed  
**And** the user is on a board page  
**When** the user clicks on a card (or navigates to `?card=:id`)  
**Then**:
- The card modal opens and is centred over the content area (not obscured by the sidebar)
- The sidebar remains collapsed in the background
- The modal overlay covers the full viewport

---

## Scenario 25: Board page scrolls correctly on mobile (drawer closed)

**Given** the viewport is mobile (375px wide)  
**And** the mobile drawer is closed  
**When** the user navigates to `/boards/:boardId`  
**Then**:
- The board takes the full viewport width
- The kanban canvas can scroll horizontally within the main content area
- The topbar remains fixed at the top (does not scroll away)

---

## Scenario 26: TopBar is consistent across board and card pages

**Given** the user visits the board page and then opens a card modal  
**When** inspecting the topbar on each page  
**Then**:
- The topbar height is `56px` (`h-14`) on both desktop and mobile
- The topbar border-bottom is visible on both pages
- `[data-testid="mobile-sidebar-toggle"]` is present on mobile for both board and card pages

---

## Regression Checklist (Board/Card Pages)

| # | Regression scenario | Expected | Selectors / checks |
|---|---------------------|----------|--------------------|
| R-1 | Sidebar toggles do not cause board page to full-refresh | Page state preserved after toggle | Board data still loaded, no network refetch |
| R-2 | Collapsing sidebar does not overflow the outer `flex h-screen` container | No horizontal scrollbar on `<html>` or `<body>` | `document.documentElement.scrollWidth <= window.innerWidth` |
| R-3 | Desktop topbar stays at top during board column horizontal scroll | Topbar fixed, does not scroll | `[data-testid="topbar"]` remains at `top: 0` |
| R-4 | Card modal is accessible by keyboard when drawer is closed | Tab cycles within modal | Focus stays inside modal dialog while open |
| R-5 | Closing mobile drawer restores page scroll position | No scroll jump | `window.scrollY` unchanged after drawer close |
| R-6 | User menu in collapsed sidebar appears to the right (not clipped) | Menu visible outside sidebar | `[role="menu"]` has `getBoundingClientRect().left >= 64` when sidebar collapsed |
| R-7 | Sidebar transition does not leave ghost whitespace | No gap between sidebar and content | Layout box model consistent before/after transition |
| R-8 | Focus trap in drawer does not bleed into board canvas | Tab does not escape drawer | All focusable elements in board out of reach while drawer open |

---

## Acceptance Criteria Checklist

| ID | Criterion | Status |
|----|-----------|--------|
| AC-1 | Desktop sidebar toggles between w-64 and w-16 | ✅ Done |
| AC-2 | Collapsed rail shows icons only (no text labels) | ✅ Done |
| AC-3 | Collapsed icons show tooltips with label on hover | ✅ Done |
| AC-4 | Toggle persists to `localStorage` key `sidebar_collapsed` | ✅ Done |
| AC-5 | State is restored from `localStorage` on page reload | ✅ Done |
| AC-6 | Toggle button is keyboard-operable with correct aria-label | ✅ Done |
| AC-7 | Collapsed nav items have `aria-label` for accessibility | ✅ Done |
| AC-8 | Desktop sidebar does not affect mobile layout | ✅ Done |
| AC-9 | Mobile hamburger opens off-canvas drawer with slide-in transition | ✅ Done |
| AC-10 | Backdrop click closes mobile drawer | ✅ Done |
| AC-11 | Escape key closes mobile drawer | ✅ Done |
| AC-12 | Focus trap keeps keyboard focus inside open mobile drawer | ✅ Done |
| AC-13 | Focus moves to first focusable element when drawer opens | ✅ Done |
| AC-14 | Mobile drawer has `role=dialog`, `aria-modal=true`, `aria-label` | ✅ Done |
| AC-15 | Hamburger button has `aria-expanded` and `aria-controls` | ✅ Done |
| AC-16 | Clicking a nav item in mobile drawer closes it | ✅ Done |
| AC-17 | Mobile drawer is always fully expanded (no collapse rail) | ✅ Done |
| AC-18 | `localStorage` does not influence mobile drawer open state | ✅ Done |
| AC-19 | Escape does not affect desktop sidebar | ✅ Done |
| AC-20 | Topbar height is `56px` (h-14) on both mobile and desktop | ✅ Done |
| AC-21 | TopBar extracted to `src/layout/TopBar.tsx`; AppShell uses it | ✅ Done |
| AC-22 | User menu dropdown escapes sidebar overflow-hidden when collapsed | ✅ Done |
| AC-23 | Main content wrapper has `min-w-0` to prevent flex overflow | ✅ Done |
| AC-24 | Board/card pages render correctly in all viewport matrix rows | ✅ Done |
