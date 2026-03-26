# Test: Sprint 119 — Shared Components Light Mode Rendering

## Overview
Verifies that shared components (CommandPalette, Toast, Input, MentionInput, ThemeToggle) render
correctly with semantic design tokens in both light and dark mode, with no hardcoded dark
panels visible when the user switches to light mode.

## Setup
- Navigate to the application and log in as a valid user.
- Ensure a board with at least one card exists.

---

## Test 1 — ThemeToggle renders in light mode without dark styling

**Steps:**
1. Click the ThemeToggle button to switch to light mode.
2. Inspect the ThemeToggle button element.

**Expected:**
- The `<html>` element does not have the `dark` class.
- The ThemeToggle button has no dark-specific Tailwind classes (`dark:` prefixed).
- The button background on hover is a light surface colour (not slate-800 or similar dark colour).
- The button icon colour adapts correctly and is visible against the light background.

---

## Test 2 — CommandPalette opens with light surface in light mode

**Steps:**
1. Ensure the app is in light mode (from Test 1 or by toggling).
2. Press Cmd+K (or Ctrl+K) to open the CommandPalette.

**Expected:**
- The CommandPalette panel has a light surface background (not dark slate-800).
- The search input text is dark/readable against the light panel background.
- The placeholder text is visible (muted, not invisible white-on-white).
- Scope tab buttons (All / Boards / Cards) are visible with readable labels.
- The active scope tab uses the primary brand colour background with inverse text.
- The inactive scope tabs use a muted text colour with a light hover background.
- The border separating the header and tabs from the results is a light border colour.
- The footer hint shows keyboard shortcuts (↑↓, ↵, Esc) with readable text on a light background.

---

## Test 3 — CommandPalette search results show section headers in light mode

**Steps:**
1. With the CommandPalette open in light mode, type at least 2 characters to trigger search.

**Expected:**
- Loading state text is visible (muted colour on light background, not invisible).
- Section headers ("Boards", "Cards") use a subtle muted colour — not dark slate.
- Empty state messages are readable (muted on light background).
- Error messages (if present) use the danger semantic colour — not hardcoded red-500.

---

## Test 4 — Input component renders readable labels and placeholders in light mode

**Steps:**
1. Navigate to a page containing an `<Input>` component (e.g., the login page or a form modal).
2. Ensure light mode is active.

**Expected:**
- Input labels are visible (muted text colour on light background).
- Input field has a light overlay background (not dark glass `bg-white/5`).
- Placeholder text is visible in a subtle colour.
- Input border is a standard border colour (not near-invisible `border-white/20`).
- Focus ring uses the primary brand colour.

---

## Test 5 — Input validation error colour uses semantic token

**Steps:**
1. On a form with an `<Input>` component, trigger a validation error (submit empty required field or similar).
2. Ensure light mode is active.

**Expected:**
- The error message below the input uses the semantic danger colour — readable on light background.
- The input border turns the danger colour to highlight the error.
- No raw `text-red-400` or `border-red-500` hardcoded classes are present on these elements.

---

## Test 6 — Toast notifications render on light surfaces

**Steps:**
1. Trigger a toast notification (perform an action that produces an info or error toast).
2. Ensure light mode is active.

**Expected:**
- The toast card has a surface background that is visible on the light page (not invisibly light).
- The toast message text is readable (base text colour on surface background).
- The dismiss button (×) is visible in a muted colour.
- For error toasts: the red border accent is present and visible.
- For conflict toasts: the yellow border accent is present and visible.
- For info toasts: the border uses the standard border token.

---

## Test 7 — MentionInput dropdown renders on light surfaces

**Steps:**
1. Open a card detail modal and click into the comment editor.
2. Type `@` followed by one or more characters to trigger mention suggestions.
3. Ensure light mode is active.

**Expected:**
- The mention dropdown has a surface background (not dark slate-800).
- The border around the dropdown uses the standard border token — visible on light.
- Suggestion rows show avatar or initials, nickname (@user), and full name with readable text.
- The highlighted/hovered suggestion row uses the overlay surface background token.
- Avatar initials fallback uses the primary brand colour background with inverse text.
- Nickname text uses the base text colour; full-name text uses the muted text colour.

---

## Test 8 — Page wrapper uses semantic background in light mode

**Steps:**
1. Ensure light mode is active.
2. Inspect the top-level page wrapper element (`min-h-screen` div).

**Expected:**
- The page wrapper background is the base background token (light in light mode).
- The page-level text colour is the base text token (dark in light mode).
- No hardcoded `bg-gray-900` or `text-white` classes are present on the page wrapper.

---

## Test 9 — Components render correctly in dark mode (regression check)

**Steps:**
1. Switch back to dark mode using the ThemeToggle.
2. Open the CommandPalette (Cmd+K).
3. Inspect a Toast notification and the MentionInput dropdown.

**Expected:**
- The CommandPalette panel has a dark surface background.
- The input text is light/readable against the dark panel.
- The Toast card has a dark surface background with readable text.
- The MentionInput dropdown has a dark surface background.
- All interactive elements remain accessible and visible in dark mode.
