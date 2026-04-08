# MCP 06. create_card

**Prerequisites:** Flow 07 (Manage Lists) completed. `$listId` (To Do list) available.

---

## Steps

1. Create a card with title only:
   ```json
   { "listId": "$listId", "title": "MCP Created Card" }
   ```
   - **Expected:** `isError` false. Response has `id`, `title: "MCP Created Card"`, `listId`, `archived: false`.

2. Create a card with a description:
   ```json
   { "listId": "$listId", "title": "MCP Card with Desc", "description": "Created via MCP tool." }
   ```
   - **Expected:** `isError` false. Retrieve the card via `get_card` — `description` field matches.

3. Verify the card appears in the list via `get_cards $listId`.

4. Call without `title`:
   - **Expected:** `isError: true`.

5. Call with an invalid `listId`:
   - **Expected:** `isError: true`, `list-not-found`.

6. Call with a VIEWER-role token on the board:
   - **Expected:** `isError: true`, `insufficient-permissions`.

7. Call on a PRIVATE board the token's user is not a member of:
   - **Expected:** `isError: true`, `board-access-denied`.

8. Call without authorization:
   - **Expected:** `401 Unauthorized`.
