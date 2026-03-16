# Test: ResizablePanels — Drag-to-Resize & Persistence

## Overview
Verifies the two-column resizable layout in the card modal: drag to resize, ratio persistence via localStorage, and mobile single-column fallback.

## Prerequisites
- User is logged in
- A board exists with at least one list containing a card

---

## Steps

### 1. Open card modal (desktop viewport)

1. Set viewport to 1280×800
2. Navigate to `/boards/:boardId`
3. Wait for the kanban board to load
4. Click a card chip to open the card modal

#### Expected Result
- Card modal opens
- Two columns are visible side-by-side
- A vertical drag handle (`[role="separator"]`) is present between the columns

---

### 2. Drag the divider to resize

1. Locate the drag handle (`[role="separator"]`)
2. Get the bounding box of the handle and the container
3. Perform a drag: mousedown on the handle → mousemove 80px to the right → mouseup

#### Expected Result
- The left column width increases after the drag
- The right column width decreases correspondingly
- Both columns remain ≥ 280 px wide

---

### 3. Verify ratio is persisted in localStorage

1. After the drag (step 2), read `localStorage.getItem('card_modal_column_ratio')`
2. Close the modal
3. Reopen the same card modal

#### Expected Result
- `localStorage` value is a decimal string between `0` and `1` (e.g. `"0.60"`)
- After reopening, the left column width matches the persisted ratio (within a small tolerance)

---

### 4. Reset localStorage and verify default ratio

1. Remove `card_modal_column_ratio` from localStorage
2. Reload the page and open a card modal

#### Expected Result
- Left column occupies approximately 55% of the total panel width (default ratio 0.55)

---

### 5. Mobile viewport — single-column vertical stack, no drag handle

1. Set viewport to 375×812 (mobile)
2. Open a card modal

#### Expected Result
- The drag handle (`[role="separator"]`) is **not** present in the DOM
- The left content panel stacks above the right activity panel (vertical layout)
- Both panels are full width

---

### 6. Keyboard resize (accessibility)

1. On desktop viewport, open a card modal
2. Focus the drag handle (`[role="separator"]`)
3. Press `ArrowRight` three times

#### Expected Result
- The left column grows by ~3% (3 × 1% per keypress)
- `localStorage` is updated with the new ratio after each keypress
