# MCP 07. move_card

**Prerequisites:** Flow 07 (Manage Lists) completed. `$cardId` (Test Card 1) and at least two lists exist.

---

## Steps

1. Move `$cardId` to the `Done` list (`$doneListId`):
   ```json
   { "cardId": "$cardId", "listId": "$doneListId" }
   ```
   - **Expected:** `isError` false. `card.id` = `$cardId`, `card.listId` = `$doneListId`.

2. Verify via `get_cards $doneListId` — card appears in destination.
3. Verify via `get_cards $originalListId` — card is absent from source.

4. Move with a specific position (put card first):
   ```json
   { "cardId": "$cardId", "listId": "$doneListId", "position": 0 }
   ```
   - **Expected:** Card is first in the list.

5. Cross-board move: move the card to a list on a different board (if one exists).
   - **Expected:** `isError` false; card appears in the target board's list.

6. Call with an invalid `cardId`:
   - **Expected:** `isError: true`, `card-not-found`.

7. Call with an invalid `listId`:
   - **Expected:** `isError: true`, `list-not-found`.

8. Call with a VIEWER-role token:
   - **Expected:** `isError: true`, `insufficient-permissions`.

9. Try to move an archived card:
   - **Expected:** `isError: true`, `card-is-archived`.

10. Call without authorization:
    - **Expected:** `401 Unauthorized`.
