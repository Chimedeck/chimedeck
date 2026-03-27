> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Board View — Lists and Cards Render

**Sprint:** 18  
**Tool:** Playwright

## Setup
- Log in as a workspace member
- Navigate to `/boards/:boardId` for a board that has at least 2 lists with cards

## Steps
1. Board page loads (no loading spinner after 3 s)
2. `BoardHeader` is visible with the board title
3. Horizontally scrollable canvas is present
4. Each list column is rendered with its title and card count
5. Cards render inside the correct list column

## Acceptance Criteria
- [ ] Board title visible in the sticky header
- [ ] All lists rendered (count matches API response)
- [ ] Cards render inside the correct list column
- [ ] Empty lists show the "+ Add a card" button
- [ ] Board canvas scrolls horizontally when lists exceed viewport width