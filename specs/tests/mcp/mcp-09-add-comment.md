# MCP 09. add_comment

**Prerequisites:** Flow 08 (Add Cards) completed. `$cardId` available.

---

## Steps

1. Add a comment to `$cardId`:
   ```json
   { "cardId": "$cardId", "content": "Comment via MCP tool." }
   ```
   - **Expected:** `isError` false. Response has `id`, `cardId`, `content: "Comment via MCP tool."`, `deleted: false`, `version: 1`.

2. Verify comment appears in the card's activity feed via the UI or:
   ```http
   GET {TEST_CREDENTIALS.baseUrl}/api/v1/cards/$cardId/activity
   ```
   - **Expected:** Comment item is present. Author matches the authenticated user.

3. Submit with empty content `""`:
   - **Expected:** `isError: true`.

4. Submit without the `content` field:
   - **Expected:** `isError: true`.

5. Submit with an invalid `cardId`:
   - **Expected:** `isError: true`, `card-not-found`.

6. Submit as a non-board-member (a token whose user is not a member of the board):
   - **Expected:** `isError: true`, access denied.

7. Call without authorization:
   - **Expected:** `401 Unauthorized`.
