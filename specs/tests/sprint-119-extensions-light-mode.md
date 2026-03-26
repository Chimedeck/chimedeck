# Test: Sprint 119 — Extensions Light Mode Rendering (Attachments, Labels, Mentions)

## Overview
Verifies that the Attachments panel, Labels section, and Mentions dropdown inside the card
detail modal render correctly with semantic design tokens in both light and dark themes.
After the Sprint 119 extensions token migration no hardcoded dark panel colours should be
visible when the app is in light mode.

## Setup
- Log in as a valid user.
- Ensure a workspace with at least one board exists.
- Ensure the board has at least one card with: a file attachment, at least one label assigned,
  and at least one member who can be mentioned in a comment.

---

## Test 1 — Attachments panel renders correctly in light mode

**Steps:**
1. Toggle to light mode using the ThemeToggle button in the header.
2. Open a board and click a card that has at least one attachment to open the card detail modal.
3. Locate the Attachments section in the card sidebar or modal body.

**Expected:**
- The Attachments section header is readable (dark text on a light surface — not white text).
- The "Attach File" button uses the secondary button style: light surface with border and readable label.
- Each attachment item row has a light background (bg-bg-surface) — not dark slate-700/800.
- File names and metadata text (size, date) are readable on the light surface.
- The attachment action buttons (Delete, Rename, Insert to comment) are visible with readable icons/labels.
- The "Attach a link" trigger text is muted-coloured — not white or invisible.
- No `bg-slate-*`, `bg-gray-[6-9]00` or `dark:` Tailwind classes are applied to attachment elements.

---

## Test 2 — Attachments panel renders correctly in dark mode

**Steps:**
1. Toggle to dark mode using the ThemeToggle button.
2. Open a card detail modal with attachments as in Test 1.

**Expected:**
- The Attachments section header is readable (light text on a dark surface).
- The "Attach File" button is visible against the dark background.
- Attachment item rows have a dark surface background.
- File names and metadata remain readable.
- All visual contrast ratios are acceptable — no invisible text.

---

## Test 3 — Attach-a-link form renders correctly in light mode

**Steps:**
1. Switch to light mode.
2. Open a card detail modal and click the "Attach a link" trigger.

**Expected:**
- The URL input field has a light background (bg-bg-surface) with visible placeholder text.
- The input border is the semantic border colour — not invisible.
- The "Attach" (primary) and "Cancel" (secondary) buttons are clearly styled and readable.
- If an internal card URL is typed, the card preview chip has a light surface (bg-bg-surface/60) with readable board name, list name, and card title.
- Label chips inside the card preview keep their data-driven background colour with `// [theme-exception]` logic — they are readable over the preview chip background.

---

## Test 4 — Labels section renders correctly in light mode

**Steps:**
1. Switch to light mode.
2. Open a card with at least one label assigned.
3. Locate the Labels section in the card detail modal (sidebar or header chips).

**Expected:**
- Label chips retain their data-driven background colour (red, green, blue, etc.) — these are intentional theme exceptions.
- The label name text inside each chip is readable (typically white or dark, chosen for contrast).
- The Labels section heading/wrapper has a light surface background — not dark.
- The "Edit labels" or label picker trigger button is visible with readable text and icon.

---

## Test 5 — Label picker opens correctly in light mode

**Steps:**
1. In light mode, click the "Edit labels" button on a card detail modal.
2. Observe the label picker dropdown/popover.

**Expected:**
- The label picker panel has a light surface background (bg-bg-surface or bg-bg-overlay) — not dark slate.
- Existing label rows have readable names and coloured swatches.
- The search/filter input (if present) has a visible border and readable placeholder.
- The "Create label" or "Add label" option uses the primary or ghost button style — readable.
- Checkmarks or selection indicators are visible on selected labels.

---

## Test 6 — Labels section renders correctly in dark mode

**Steps:**
1. Switch to dark mode.
2. Open a card with at least one label and inspect the Labels section.

**Expected:**
- Label chips keep their data-driven colours (theme exceptions) and remain readable.
- Section heading and wrapper use dark surface backgrounds.
- Label picker (if opened) renders with dark surface correctly.

---

## Test 7 — Mentions dropdown renders correctly in light mode

**Steps:**
1. Switch to light mode.
2. Open a card detail modal and navigate to the comment editor.
3. Type `@` followed by at least one character to trigger the mention dropdown.

**Expected:**
- The mention suggestion list has a light surface background (bg-bg-surface) — not dark slate-800.
- The border around the list uses the semantic border colour — not slate-700.
- Each suggestion row (avatar + nickname + full name) is readable on the light background.
- The highlighted/selected row uses a subtle highlight background — not an invisible or too-dark shade.
- The avatar images or initials placeholder render without a dark ring that clashes with light background.

---

## Test 8 — Mentions dropdown renders correctly in dark mode

**Steps:**
1. Switch to dark mode.
2. Open a card comment editor and type `@` to trigger the mention dropdown.

**Expected:**
- The mention suggestion list has a dark surface background.
- Suggestion text and avatars remain readable on the dark background.
- The highlighted row uses an elevated dark highlight.

---

## Test 9 — Card modal background and layout in light mode

**Steps:**
1. Switch to light mode.
2. Open any card detail modal.

**Expected:**
- The modal overlay backdrop is a semi-transparent dark shade (`bg-black/50`) — this is intentional and expected.
- The modal content panel itself has a light surface background (bg-bg-base or bg-bg-surface) — not dark.
- The modal title, description area, and all sidebar sections display dark text on light backgrounds.
- The close button (X) in the modal header is visible and styled as a ghost icon button.
- No floating panels inside the modal (checklist, members, dates, custom fields) show a dark background that clashes with the light modal.

---

## Test 10 — No hardcoded dark classes in extension panels (visual regression)

**Steps:**
1. In light mode, open a card detail modal.
2. Using browser DevTools, inspect the DOM of the Attachments section, label chips area, and comment editor.

**Expected:**
- No element inside the card modal has a class matching `bg-slate-[6-9]00`, `bg-gray-[6-9]00`, or `bg-zinc-[6-9]00`.
- No element has a class matching `text-white` (except within intentional theme-exception elements).
- No element has a `dark:` prefixed Tailwind class in its `className` attribute.
- All backgrounds, text colours, and borders derive from semantic CSS custom properties (e.g., `--color-bg-surface`, `--color-text-base`).
