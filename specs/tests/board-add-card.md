> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Board — Inline Add Card

**Sprint:** 18  
**Tool:** Playwright

## Setup
- Log in and open a board with at least 1 list

## Steps
1. Click "+ Add a card" at the bottom of a list
2. `AddCardForm` textarea appears and is focused
3. Type a card title and press Enter
4. Card appears at the bottom of the list
5. Form resets ready for another card
6. Press Escape — form closes

## Acceptance Criteria
- [ ] Clicking "+ Add a card" opens the inline form
- [ ] Enter submits and card appears in the correct column
- [ ] Escape dismisses the form
- [ ] Shift+Enter inserts a newline in the textarea (does not submit)
- [ ] Empty title cannot be submitted (button disabled)

# Test: Board — Inline List Title Edit

**Sprint:** 18  
**Tool:** Playwright

## Steps
1. Click a list title
2. Inline input replaces the title
3. Type a new title and press Tab or click elsewhere (blur)
4. `PATCH /api/v1/lists/:id` is called
5. Updated title persists after page reload

## Acceptance Criteria
- [ ] Click on title opens edit input
- [ ] Blur / Enter persists the change
- [ ] Escape cancels and restores original title