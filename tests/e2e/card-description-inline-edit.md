# Card Description — Inline Click-to-Edit

## Overview
Tests that the card description supports inline click-to-edit: clicking the rendered
markdown (or placeholder) opens an edit textarea; Ctrl+Enter saves; Escape cancels.

## Pre-conditions
- User is logged in and on a board with at least one card.
- The card may or may not have an existing description.

---

## Test 1 — Enter edit mode by clicking description area

1. Open the board and click a card to open the card modal.
2. Locate the Description section.
3. **Assert**: The explicit "Edit" button is NOT present.
4. Click anywhere on the description area (rendered markdown or placeholder text
   "Add a more detailed description…").
5. **Assert**: A textarea (the description editor) is now visible.
6. **Assert**: The textarea has focus (cursor is inside).
7. **Assert**: A "Save" button and a "Cancel" button are visible below the textarea.

---

## Test 2 — Save with Ctrl+Enter

1. Open a card modal and click the description to enter edit mode.
2. Clear any existing text and type: `**Bold description** with _italic_ text`.
3. Press `Ctrl+Enter` (or `Cmd+Enter` on macOS).
4. **Assert**: The textarea is no longer visible (edit mode exited).
5. **Assert**: The description area now renders HTML — bold and italic elements are
   present (the text is rendered as markdown, not raw).
6. Close the card modal and reopen it.
7. **Assert**: The saved markdown is still rendered correctly.

---

## Test 3 — Cancel with Escape

1. Open a card modal that has an existing description (e.g., `Original text`).
2. Click the description to enter edit mode.
3. Clear the textarea and type: `Temporary unsaved text`.
4. Press `Escape`.
5. **Assert**: The textarea is no longer visible (edit mode exited).
6. **Assert**: The description area still shows the original text (`Original text`),
   not the unsaved change.

---

## Test 4 — Save with Save button

1. Open a card modal and click the description to enter edit mode.
2. Type: `Saved via button`.
3. Click the "Save" button.
4. **Assert**: Edit mode exits and the text `Saved via button` is displayed.

---

## Test 5 — Cancel with Cancel button

1. Open a card modal and click the description to enter edit mode.
2. Type some new text.
3. Click the "Cancel" button.
4. **Assert**: Edit mode exits and the original description is shown (unchanged).

---

## Test 6 — Empty description shows placeholder

1. Open a card that has no description set.
2. **Assert**: The description area shows the placeholder text
   `Add a more detailed description…` (italic/muted styling).
3. **Assert**: The placeholder is clickable — clicking it enters edit mode.

---

## Test 7 — Keyboard accessibility (Enter key on view mode element)

1. Open a card modal.
2. Tab to the description view-mode element (it has `role="button"` and `tabIndex=0`).
3. Press `Enter` or `Space`.
4. **Assert**: Edit mode is entered (textarea is visible).
