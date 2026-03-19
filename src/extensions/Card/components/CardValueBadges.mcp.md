# CardValue & Plugin Badges — Playwright MCP Test Spec

## Overview

Verifies that the CardValue (money/amount badge) and CardDetailPluginBadges both appear
as inline badges in the left column of the card modal — not in a sidebar.
Also serves as a full acceptance criteria check for the Sprint-81 card modal overhaul:
two-column layout, drag-resize persistence, activity sorted newest-first, meta strip,
inline description edit, bottom bar with activity toggle and Actions dropdown, no sidebar.

---

## Prerequisites

- The app is running locally.
- At least one board exists with at least one list containing a card.
- One card has an `amount` / `currency` set (a money/value field).
- At least one plugin that contributes card-detail badges is enabled (or can be stubbed).

---

## Test 1: Value and plugin badges appear in the left column

**Steps:**

1. Navigate to the board page.
2. Click on a card that has a money value set (amount + currency).
3. Wait for the card detail modal to open.
4. Inspect the **left column** of the modal (content area).
5. Scroll down past the checklist and attachments sections.

**Expected:**

- A horizontal badge row (`flex-wrap` container) is visible in the left column.
- The `CardValue` money badge (amount + currency inputs / display) is present inside this row.
- The `CardDetailPluginBadges` region is present inside the same row.
- **No** standalone "Value" heading or "Value" sidebar section exists anywhere in the modal.
- The badge row is NOT placed in a right-side sidebar.

---

## Test 2: Value badge save flow

**Steps:**

1. Open a card modal.
2. Scroll to the badge row in the left column.
3. Locate the amount input and currency input.
4. Enter a valid amount (e.g. `99.99`) and currency (e.g. `EUR`).
5. Click the **Save** button inside the badge.

**Expected:**

- The badge saves without error.
- The amount is reflected (the input shows `99.99` and currency `EUR`).
- No reload required — the update is visible immediately.

---

## Test 3: Value badge validation

**Steps:**

1. Open a card modal.
2. In the badge row's amount input, enter a negative number (e.g. `-5`).
3. Click **Save**.

**Expected:**

- An inline error message appears: "Amount must be a positive number."
- The value is not saved.

**Steps (currency validation):**

1. Enter a valid amount (e.g. `10`).
2. Enter an invalid currency code (e.g. `US` — only 2 letters).
3. Click **Save**.

**Expected:**

- An inline error appears: "Currency must be a 3-letter code (e.g. USD, EUR)."

---

## Test 4: No sidebar sections remain

**Steps:**

1. Open any card modal.
2. Inspect the full modal DOM.

**Expected:**

- There is **no** separate sidebar panel containing Members, Labels, Dates, or Value sections.
- All metadata (labels, members, dates) is in the `CardMetaStrip` below the title.
- Value and plugin badges are in the inline badge row in the left column.
- The modal has at most two sections: left content column and right activity column.

---

## Test 5: Full acceptance criteria — two-column layout

**Steps:**

1. Set viewport to 1280×800 (desktop).
2. Open any card modal.

**Expected:**

- Two columns are visible side-by-side.
- A drag handle (`[role="separator"]`) is present between the columns.
- Left column: title, breadcrumb, CardMetaStrip, description, custom fields, checklist, attachments, badge row.
- Right column: ActivityFeed (independently scrollable).
- **No** ··· (three-dot) header button is present.
- **Close (✕)** button is present in the header.

---

## Test 6: Full acceptance criteria — drag-resize persists

**Steps:**

1. Open a card modal on a desktop viewport.
2. Locate the drag handle and drag it rightward by ~100px.
3. Note the approximate new ratio.
4. Close the modal (press Escape or click ✕).
5. Reopen the same card modal.

**Expected:**

- The column ratio is restored from `localStorage` (key `card_modal_column_ratio`).
- The left column is noticeably wider than the default.

---

## Test 7: Full acceptance criteria — activity sorted newest-first

**Steps:**

1. Open a card that has at least two activity entries or comments (e.g. comment A added before comment B).
2. Inspect the ActivityFeed in the right column.

**Expected:**

- The most recently added comment/activity item appears **first** (top of the list).
- Older entries appear below newer ones.
- The CommentEditor (comment input box) is **above** the activity list items.

---

## Test 8: Full acceptance criteria — inline description edit

**Steps:**

1. Open any card modal.
2. Verify there is **no** explicit "Edit" button next to the description.
3. Click directly on the description text (or placeholder "Add a more detailed description…").
4. Type `**Bold text**`.
5. Press `Ctrl+Enter` (or `Cmd+Enter` on macOS).
6. Close and reopen the modal.

**Expected:**

- Clicking description enters edit mode (textarea visible, Save/Cancel buttons shown).
- After `Ctrl+Enter` save, the text renders as markdown (bold element visible).
- The saved text persists after modal close/reopen.
- Pressing `Escape` in edit mode cancels without saving.

---

## Test 9: Full acceptance criteria — bottom bar activity toggle

**Steps:**

1. Open any card modal.
2. Verify the sticky bottom bar is visible.
3. Verify the Activity toggle button is in the active/highlighted state.
4. Click the **Activity** button in the bottom bar.

**Expected:**

- The right activity column is hidden.
- The modal body expands to a single-column layout.
- Clicking **Activity** again restores the two-column layout.

---

## Test 10: Full acceptance criteria — Actions dropdown

**Steps:**

1. Open any card modal.
2. Click the **Actions** button in the bottom bar.

**Expected:**

- A dropdown appears containing:
  - **Archive card** (or Unarchive card if archived)
  - **Copy link**
  - **Delete card** (styled in red / destructive color)
- Pressing `Escape` closes the dropdown without triggering any action.

---

## Test 11: Mobile single-column layout

**Steps:**

1. Set viewport to 375×812 (iPhone-sized).
2. Open any card modal.

**Expected:**

- Content stacks vertically in a single column.
- No drag handle is present.
- The badge row (CardValue + plugin badges) is visible below checklist/attachments.
- The ActivityFeed appears below the main content area.
