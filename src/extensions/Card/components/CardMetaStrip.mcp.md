# CardMetaStrip — Playwright MCP Test Spec

## Overview

Verify that the `CardMetaStrip` component renders correctly inside the card modal and that
label/member/date popovers open and function as expected.

---

## Prerequisites

- The app is running locally (`npm run dev` or equivalent).
- At least one board exists with at least one list that contains at least one card.
- At least one label exists in the workspace.
- At least one board member exists.

---

## Test 1: Meta strip renders below the card title

**Steps:**

1. Navigate to the board page.
2. Click on any card tile to open the card modal.
3. Locate the card title displayed in the modal header.
4. Immediately below the breadcrumb line (`in list … · …`), assert that a horizontal metadata strip
   is visible — it should contain at least the `+ Labels`, `+ Members`, `Start date`, and `Due date`
   controls when no metadata is set.

**Expected:**

- The metadata strip is present below the breadcrumb.
- `+ Labels` button is visible (label icon + text).
- `+ Members` button is visible (user icon + text).
- `Start date` button is visible (calendar icon + "Start date" text).
- `Due date` button is visible (calendar icon + "Due date" text).

---

## Test 2: Label chips display for assigned labels

**Steps:**

1. Open a card that already has one or more labels assigned.
2. Observe the metadata strip.

**Expected:**

- Up to 3 label chips (coloured pill badges with label names) appear in the strip.
- If more than 3 labels are assigned, a `+N` overflow indicator is shown instead of the extra chips.
- A `+` button (with tag icon) is shown after the chips for adding more labels.

---

## Test 3: Clicking "+ Labels" opens the label picker

**Steps:**

1. Open any card modal.
2. Click the `+ Labels` button (or `+` button when labels already exist) in the metadata strip.
3. Assert a popover appears.

**Expected:**

- A floating panel appears with:
  - A text input for searching / naming a new label.
  - A colour grid with 8 colour swatches.
  - A list of existing workspace labels (if any) that can be toggled.
- Pressing `Escape` closes the popover.
- Clicking outside the popover closes it.

---

## Test 4: Attaching a label via the label picker

**Steps:**

1. Open a card with no labels assigned.
2. Click `+ Labels`.
3. In the label picker that appears, click on an existing label (e.g. the first one listed under
   "Existing labels").
4. Close the picker (click outside or press Escape).
5. Observe the metadata strip.

**Expected:**

- The selected label now appears as a chip in the strip.
- The label chip shows the correct colour and name.

---

## Test 5: Member avatars and overflow

**Steps:**

1. Open a card that has one or more members assigned.
2. Observe the metadata strip.

**Expected:**

- Up to 3 circular avatar badges (showing initials) appear.
- If more than 3 members are assigned, a `+N` overflow badge is shown.
- A `+` button (user icon) is shown after the avatars.

---

## Test 6: Clicking "+ Members" opens the member picker

**Steps:**

1. Open any card modal.
2. Click the `+ Members` button in the metadata strip.
3. Assert a popover appears.

**Expected:**

- A floating panel lists all board members.
- Each member shows their avatar (initials) and display name.
- Already-assigned members have a ✓ checkmark.
- Pressing `Escape` closes the popover.

---

## Test 7: Start date button opens inline date picker

**Steps:**

1. Open a card with no start date set.
2. Click the `Start date` button in the strip.
3. Assert a small popover appears containing a date `<input type="date">`.
4. Select a date.
5. Close the popover (click outside).
6. Observe the `Start date` button.

**Expected:**

- After selecting, the button text changes from "Start date" to the formatted date (e.g. "Mar 25").
- The button style changes from dashed outline to a solid pill.

---

## Test 8: Due date button opens inline date picker

Same as Test 7 but using the `Due date` button.

---

## Test 9: Clearing a date

**Steps:**

1. Open a card that has a due date set.
2. Click the `Due date` button in the strip.
3. In the popover, click the `Clear` link.
4. Close the popover.

**Expected:**

- The `Due date` button returns to the calendar icon + "Due date" placeholder text.
- The date is cleared.

---

## Test 10: Disabled state (archived card)

**Steps:**

1. Archive a card (if possible from the Actions menu).
2. Open the archived card modal.
3. Observe the metadata strip.

**Expected:**

- All buttons in the strip are visually disabled (reduced opacity).
- Clicking `+ Labels`, `+ Members`, or date buttons does nothing (no popover opens).
- The archived banner is visible above the strip.
