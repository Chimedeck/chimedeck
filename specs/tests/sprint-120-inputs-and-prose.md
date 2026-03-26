# Test: Sprint 120 — Input/Form Standardisation + Prose Invert + Scrollbars

**Type:** Playwright end-to-end  
**Sprint:** 120 — Theme Text & Contrast Consistency Audit

---

## Scenario 1: Input placeholder colour in light mode

1. Navigate to `http://localhost:5173/login`
2. Evaluate `document.documentElement.classList.remove('dark')` to force light mode
3. Assert the email input placeholder text is visible and styled as a muted grey colour (not black)
4. Navigate to `http://localhost:5173/workspaces` (authenticated)
5. Open any board
6. Open a card modal
7. Assert the checklist "Add an item…" input placeholder is visible and muted
8. Assert the card description click-to-edit area placeholder "Add a more detailed description…" is visible and muted
9. Assert no input or textarea has white (`#ffffff`) placeholder text on a white background

---

## Scenario 2: Input placeholder colour in dark mode

1. Navigate to `http://localhost:5173/login`
2. Evaluate `document.documentElement.classList.add('dark')` to force dark mode
3. Assert the email input placeholder text is visible and styled as a muted grey (not white)
4. Navigate to `http://localhost:5173/workspaces` (authenticated)
5. Open any board
6. Open a card modal
7. Assert the checklist "Add an item…" input placeholder is visible and muted
8. Assert the comment editor placeholder is visible and muted
9. Assert no input or textarea shows invisible (same-colour-as-background) placeholder text

---

## Scenario 3: Input background and border in light mode

1. Navigate to `http://localhost:5173/workspaces` (authenticated, light mode)
2. Open any board and open a card modal
3. Assert card title input has a visible border
4. Assert card title input background is not pure white (`#ffffff`) — it should use the semantic overlay token
5. Assert the checklist title rename input has a visible border and is not white
6. Assert the labels name input has a visible border and is not pure white
7. Assert the card value amount input has a visible border and is not pure white

---

## Scenario 4: Input background and border in dark mode

1. Evaluate `document.documentElement.classList.add('dark')` to force dark mode
2. Open any board and open a card modal
3. Assert card title input is readable (not black-on-dark-background)
4. Assert card title input border is visible against the dark surface
5. Assert the checklist "Add an item…" input is readable in dark mode
6. Assert the labels name input is readable in dark mode
7. Toggle theme back to light — assert all inputs remain readable

---

## Scenario 5: Prose-invert applies in dark mode (card description)

1. Navigate to a board and open a card with a rich-text description
2. Evaluate `document.documentElement.classList.add('dark')` to force dark mode
3. Assert the rendered description text is light-coloured (not black text on dark background)
4. Assert any headings (h1–h4) in the description are visible
5. Assert blockquote text is visible
6. Assert inline code snippets are visible (light text on dark background)
7. Evaluate `document.documentElement.classList.remove('dark')` to switch to light mode
8. Assert the rendered description text is dark-coloured (not white text on white background)
9. Assert headings are still visible in light mode

---

## Scenario 6: Prose-invert applies in dark mode (comments)

1. Navigate to a board and open a card modal
2. Evaluate `document.documentElement.classList.add('dark')` to force dark mode
3. Assert existing comment text is readable (light colour on dark background)
4. Assert the comment composer area has readable placeholder text
5. Evaluate `document.documentElement.classList.remove('dark')` to switch to light mode
6. Assert comment text is dark and readable on light background

---

## Scenario 7: Themed scrollbars in dark mode

1. Navigate to a board with multiple lists (to trigger horizontal scrolling)
2. Evaluate `document.documentElement.classList.add('dark')` to force dark mode
3. Scroll horizontally — assert the scrollbar thumb is visible (not invisible against dark background)
4. Assert the scrollbar track blends with the page background (dark in dark mode)
5. Navigate to a card modal with long content (to trigger vertical scrolling)
6. Scroll down — assert the vertical scrollbar is visible

---

## Scenario 8: Themed scrollbars in light mode

1. Navigate to a board with multiple lists
2. Evaluate `document.documentElement.classList.remove('dark')` to force light mode
3. Scroll horizontally — assert the scrollbar thumb is visible (not invisible on white background)
4. Assert the scrollbar track blends with the page background (light in light mode)

---

## Scenario 9: Theme toggle — inputs and prose remain consistent

1. Navigate to a card modal
2. Evaluate `document.documentElement.classList.remove('dark')` (light mode)
3. Assert description prose text is dark and readable
4. Assert all visible inputs have correct light-mode styling
5. Evaluate `document.documentElement.classList.add('dark')` (toggle to dark)
6. Assert description prose text is now light and readable (no black-on-dark)
7. Assert all visible inputs have correct dark-mode styling
8. Evaluate `document.documentElement.classList.remove('dark')` (toggle back)
9. Assert the UI has reverted to correct light-mode styling — no residual dark styling visible
