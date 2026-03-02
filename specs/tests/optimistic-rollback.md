# Playwright Test: Optimistic Rollback

**File:** `tests/optimistic-rollback.spec.ts`

## Scenario

When the API returns an error for a card move, the card snaps back to its original column and an error toast appears.

## Steps

1. Open the board page.
2. Intercept `PATCH /api/v1/cards/:id/move` and force a 500 response.
3. Drag "Card A" from "To Do" to "In Progress".
4. Assert "Card A" immediately appears in "In Progress" (optimistic update).
5. Wait for API response.
6. Assert "Card A" snaps back to "To Do" (rollback).
7. Assert an error toast appears in the bottom-right corner.
8. Wait 6 seconds.
9. Assert the error toast has auto-dismissed.

## Acceptance Criteria

- [ ] Card shows in target column immediately after drag (optimistic).
- [ ] Card snaps back to source column on API error.
- [ ] Error toast appears with a relevant message.
- [ ] Toast auto-dismisses after 6 s.

## Notes

- Use `page.route('**/cards/*/move', ...)` to intercept and return 500.
- Snapshot/rollback is handled by `boardSlice.rollbackDrag` triggered from `BoardCanvas`.
