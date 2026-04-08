# MCP 04. get_cards

**Prerequisites:** Flow 08 (Add Cards) completed. `$listId` has `Test Card 1` and `Test Card 2`.

---

## Steps

1. Call `get_cards` with the list ID:
   ```json
   { "listId": "$listId" }
   ```
   - **Expected:** `isError` false. Array contains `Test Card 1` and `Test Card 2`. Each item has `id` and `title`. Count equals non-archived cards only.

2. Archive `Test Card 2` via the UI (or card menu → Archive). Call `get_cards` again.
   - **Expected:** Only `Test Card 1` is returned. Archived cards are excluded.

3. Create an empty list. Call `get_cards` on it.
   - **Expected:** `isError` false, `data: []`.

4. Call with an invalid `listId`:
   - **Expected:** `isError: true`, `list-not-found`.

5. Call on a list belonging to a PRIVATE board with a non-member token:
   - **Expected:** `isError: true`, access denied.

6. Call without authorization:
   - **Expected:** `401 Unauthorized`.
