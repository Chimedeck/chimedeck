# MCP 01. get_boards

**Prerequisites:** Flow 05 (Create Workspace) completed. `$workspaceId` and `$token` are available.

---

## Steps

1. Call `get_boards` with the workspace ID:
   ```json
   { "workspaceId": "$workspaceId" }
   ```
   Authorization: `Bearer $token`
   - **Expected:** `isError` is false. Response contains a non-empty array where each item has `id` and `title`.

2. Verify `Test Board` is present in the array (from flow 06).

3. Call with a non-member token (log in as a user not in the workspace):
   - **Expected:** `isError: true`, error name `not-a-workspace-member`.

4. Call with an invalid `workspaceId` (e.g. `"workspace-does-not-exist"`):
   - **Expected:** `isError: true`, error name `workspace-not-found`.

5. Call an empty workspace (one with no boards):
   - **Expected:** `isError` is false, `data` is `[]`.

6. Call without authorization header:
   - **Expected:** `401 Unauthorized`.
