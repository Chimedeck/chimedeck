> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: MCP Tool — get_board

## Overview
Verifies the `get_board` MCP tool, which retrieves the full detail of a single board by its ID, including its lists and cards. Scenarios cover successful retrieval, access control, and not-found handling.

## Pre-conditions
- Server is running and reachable
- A valid user JWT or `hf_` API token is available
- A board exists with at least 2 lists, each containing at least 1 card
- The authenticated user is a board member with at minimum VIEWER role

## Steps

### 1. Successful board detail retrieval

1. Initialise an MCP session: `POST /mcp` with `Authorization: Bearer <token>` and `initialize` JSON-RPC body. Capture `Mcp-Session-Id`.
2. Call the tool:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "get_board",
       "arguments": { "boardId": "<boardId>" }
     }
   }
   ```
3. **Assert** response status is `200`
4. **Assert** `result.content[0].type` is `"text"`
5. Parse `result.content[0].text` as JSON (call it `board`).
6. **Assert** `board.id` equals `<boardId>`
7. **Assert** `board.title` is a non-empty string
8. **Assert** `board.lists` is an array with at least 2 items
9. **Assert** each list has `id`, `title`, and `cards` (array) fields
10. **Assert** at least one list has at least 1 card with `id` and `title`

### 2. Board not found

1. Call `get_board` with `boardId: "nonexistent-id"`.
2. **Assert** the tool returns an error content block containing `board-not-found`
3. **Assert** `result.isError` is `true`

### 3. Access denied for non-member on PRIVATE board

1. Log in as a user who is a workspace member but NOT in the board's `board_members` table.
2. Call `get_board` with that user's token and a PRIVATE board's ID.
3. **Assert** the tool returns an error content block (e.g., `board-access-denied` or `forbidden`)
4. **Assert** `result.isError` is `true`

### 4. PUBLIC board accessible without explicit board membership

1. Ensure the board has `visibility: PUBLIC`.
2. Log in as a workspace member not explicitly added to the board.
3. Call `get_board` with that user's token and the PUBLIC board's ID.
4. **Assert** the tool returns board details (no error)
5. **Assert** `board.id` equals the PUBLIC board's ID

### 5. Unauthenticated request is rejected

1. `POST /mcp` with no `Authorization` header and `initialize` JSON-RPC body.
2. **Assert** response status is `401`

## Expected Result
- `get_board` returns full board detail including lists and cards for authorised callers
- Non-members of PRIVATE boards receive an access-denied error
- PUBLIC boards are accessible to all workspace members
- Non-existent board IDs return a `board-not-found` error
- Unauthenticated requests are rejected at session initialisation