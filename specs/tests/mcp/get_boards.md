> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: MCP Tool — get_boards

## Overview
Verifies the `get_boards` MCP tool, which lists all boards in a workspace accessible to the authenticated user. Scenarios cover successful retrieval, authentication enforcement, and visibility filtering.

## Pre-conditions
- Server is running and reachable
- A valid user JWT or `hf_` API token is available
- At least one workspace exists with at least two boards (one PUBLIC, one PRIVATE)
- The authenticated user is a member of the workspace

## Steps

### 1. Successful board listing

1. Initialise an MCP session: `POST /mcp` with `Authorization: Bearer <token>` and `initialize` JSON-RPC body. Capture `Mcp-Session-Id`.
2. Call the tool:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "get_boards",
       "arguments": { "workspaceId": "<workspaceId>" }
     }
   }
   ```
3. **Assert** response status is `200`
4. **Assert** `result.content[0].type` is `"text"`
5. **Assert** `JSON.parse(result.content[0].text)` is an array
6. **Assert** each item in the array has at minimum `id` (string) and `title` (string) fields
7. **Assert** the array contains the PUBLIC board created in Pre-conditions

### 2. Returns only boards accessible to the caller

1. Log in as a second user who is NOT a member of the workspace.
2. Call `get_boards` with the second user's token and the same `workspaceId`.
3. **Assert** the tool returns an error content block containing `not-a-workspace-member` or `forbidden`

### 3. Unauthenticated request is rejected

1. `POST /mcp` with no `Authorization` header and `initialize` JSON-RPC body.
2. **Assert** response status is `401`

### 4. Invalid workspaceId returns error

1. Call `get_boards` with `workspaceId: "nonexistent-id"`.
2. **Assert** the tool returns an error content block (e.g., `workspace-not-found` or `not-a-workspace-member`)

### 5. Empty workspace returns empty array

1. Create a new workspace with no boards.
2. Call `get_boards` with the new workspace's ID.
3. **Assert** `JSON.parse(result.content[0].text)` is an empty array `[]`

## Expected Result
- `get_boards` returns the list of accessible boards for a workspace
- Each board entry contains at least `id` and `title`
- Non-members receive an error response
- Unauthenticated requests are rejected at session initialisation