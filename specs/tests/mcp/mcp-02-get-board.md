# MCP 02. get_board

**Prerequisites:** Flow 06 (Create Board) completed. `$boardId` and `$token` available.

---

## Steps

1. Call `get_board` with the board ID:
   ```json
   { "boardId": "$boardId" }
   ```
   - **Expected:** `isError` false. Response contains `board.id`, `board.title`, and `board.lists` array. Each list has a `cards` array.

2. Verify lists `To Do`, `In Progress`, `Done` are present (from flow 07).

3. Call with an invalid `boardId`:
   - **Expected:** `isError: true`, error name `board-not-found`.

4. Set `Test Board` visibility to `PRIVATE` (via flow 20), then call `get_board` with a non-member token:
   - **Expected:** `isError: true`, error name contains `access denied` or `board-access-denied`.

5. Call `get_board` on a `PUBLIC` board with a workspace-member token (not a direct board member):
   - **Expected:** `isError` false — public boards are accessible to workspace members.

6. Call without authorization:
   - **Expected:** `401 Unauthorized`.
