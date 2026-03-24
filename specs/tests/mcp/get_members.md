# Test: MCP Tool — get_members

## Overview
Verifies the `get_members` MCP tool, which returns the list of members for a board or workspace. Scenarios cover successful retrieval, role information, access control, and authentication enforcement.

## Pre-conditions
- Server is running and reachable
- A valid user JWT or `hf_` API token is available
- A board exists with at least two members: one ADMIN and one MEMBER (different users)
- The authenticated user is a member of the board

## Steps

### 1. Successful board member listing

1. Initialise an MCP session: `POST /mcp` with `Authorization: Bearer <token>` and `initialize` JSON-RPC body. Capture `Mcp-Session-Id`.
2. Call the tool:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "get_members",
       "arguments": { "boardId": "<boardId>" }
     }
   }
   ```
3. **Assert** response status is `200`
4. **Assert** `result.content[0].type` is `"text"`
5. Parse `result.content[0].text` as JSON (call it `members`).
6. **Assert** `members` is an array with length ≥ 2
7. **Assert** each item has at minimum `userId` (string) and `role` (string) fields

### 2. Member roles are present and valid

1. Parse the `members` array from step 1.
2. **Assert** at least one member has `role` equal to `"ADMIN"`.
3. **Assert** at least one member has `role` equal to `"MEMBER"`.
4. **Assert** all `role` values are one of `["ADMIN", "MEMBER", "VIEWER"]`.

### 3. Workspace member listing

1. Call `get_members` with `workspaceId: <workspaceId>` (instead of `boardId`).
2. Parse the response JSON.
3. **Assert** `members` is an array with length ≥ 1.
4. **Assert** each item has at minimum `userId` and `role` fields.

### 4. Member profile fields are included

1. Parse the `members` array from step 1.
2. **Assert** at least one member has a non-empty `username` or `email` field.
3. **Assert** no member exposes a `password` or `passwordHash` field.

### 5. Non-member cannot list board members on PRIVATE board

1. Log in as a user who is NOT a member of the board (PRIVATE visibility).
2. Call `get_members` with that user's token and `boardId: <boardId>`.
3. **Assert** the tool returns an error content block (e.g., `board-access-denied` or `forbidden`)
4. **Assert** `result.isError` is `true`

### 6. PUBLIC board members visible to workspace member

1. Set the board visibility to PUBLIC.
2. Log in as a workspace member who is NOT a board member.
3. Call `get_members` with that user's token and `boardId: <boardId>`.
4. **Assert** response status is `200`
5. **Assert** `members` is a non-empty array.

### 7. Invalid boardId returns error

1. Call `get_members` with `boardId: "nonexistent-id"`.
2. **Assert** the tool returns an error content block containing `board-not-found` or `board-access-denied`
3. **Assert** `result.isError` is `true`

### 8. Invalid workspaceId returns error

1. Call `get_members` with `workspaceId: "nonexistent-id"`.
2. **Assert** the tool returns an error content block containing `workspace-not-found` or `not-a-workspace-member`
3. **Assert** `result.isError` is `true`

### 9. Missing both boardId and workspaceId returns validation error

1. Call `get_members` with no `boardId` and no `workspaceId`.
2. **Assert** the tool returns an error content block.
3. **Assert** `result.isError` is `true`

### 10. Unauthenticated request is rejected

1. `POST /mcp` with no `Authorization` header and `initialize` JSON-RPC body.
2. **Assert** response status is `401`

## Expected Result
- `get_members` returns the list of members for the specified board or workspace
- Each member entry includes at least `userId` and `role`
- Role values are restricted to `ADMIN`, `MEMBER`, or `VIEWER`
- Sensitive fields such as `password` are never returned
- Non-members cannot retrieve the member list of a PRIVATE board
- PUBLIC board member lists are visible to workspace members
- Missing or invalid `boardId`/`workspaceId` returns descriptive error content blocks
- Unauthenticated requests are rejected at session initialisation
