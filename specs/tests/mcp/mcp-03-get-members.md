# MCP 03. get_members

**Prerequisites:** Flow 19 (Invite Member) completed. `$boardId`, `$workspaceId`, `$token` available.

---

## Steps

1. Call `get_members` for the board:
   ```json
   { "boardId": "$boardId" }
   ```
   - **Expected:** `isError` false. Array with ≥ 2 items (admin + invited user). Each item has `userId` and `role`.

2. Verify roles are valid values: `ADMIN`, `MEMBER`, or `VIEWER`.

3. Verify profile fields `username` and `email` are present. Confirm `password` and `passwordHash` are **not** returned.

4. Call `get_members` for the workspace:
   ```json
   { "workspaceId": "$workspaceId" }
   ```
   - **Expected:** `isError` false. Array of workspace members returned.

5. Call on a PRIVATE board with a non-member token:
   - **Expected:** `isError: true`, access denied.

6. Call on a PUBLIC board with a workspace-member token:
   - **Expected:** `isError` false — visible.

7. Call with an invalid `boardId`:
   - **Expected:** `isError: true`, `board-not-found`.

8. Call with an invalid `workspaceId`:
   - **Expected:** `isError: true`, `workspace-not-found`.

9. Call with neither `boardId` nor `workspaceId`:
   - **Expected:** `isError: true`.

10. Call without authorization:
    - **Expected:** `401 Unauthorized`.
