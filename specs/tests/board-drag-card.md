# Test: Board — Drag Card Between Columns

**Sprint:** 18  
**Tool:** Playwright

## Setup
- Log in and open a board with at least 2 lists, each with at least 1 card
- Mock `PATCH /api/v1/cards/:id/move` to return 200 on first call, 500 on second call

## Steps (Happy path)
1. Drag card from list A to list B
2. Card appears in list B immediately (optimistic)
3. `PATCH /api/v1/cards/:id/move` is called with `targetListId` = list B's ID
4. Card remains in list B after API response

## Steps (Rollback on failure)
1. Mock the move API to return 500
2. Drag the same card from list A to list B
3. Card appears in list B (optimistic)
4. After API error, card snaps back to list A (rollback)

## Acceptance Criteria
- [ ] Optimistic card move is instant (no visible lag)
- [ ] API is called on drag end
- [ ] Rollback restores original column on 5xx error
- [ ] Drag overlay card shows rotation + scale effect during drag
