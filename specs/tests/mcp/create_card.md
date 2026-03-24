# Test: MCP Tool — create_card

## Overview
Verifies the `create_card` MCP tool, which creates a new card in a specified list. Scenarios cover successful creation, required field validation, optional description, access control, and idempotency expectations.

## Pre-conditions
- Server is running and reachable
- A valid user JWT or `hf_` API token is available
- A board exists with at least one list
- The authenticated user has MEMBER role on the board

## Steps

### 1. Successful card creation (title only)

1. Initialise an MCP session: `POST /mcp` with `Authorization: Bearer <token>` and `initialize` JSON-RPC body. Capture `Mcp-Session-Id`.
2. Call the tool:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "create_card",
       "arguments": {
         "listId": "<listId>",
         "title": "New task from MCP"
       }
     }
   }
   ```
3. **Assert** response status is `200`
4. **Assert** `result.content[0].type` is `"text"`
5. Parse `result.content[0].text` as JSON (call it `card`).
6. **Assert** `card.id` is a non-empty string
7. **Assert** `card.title` equals `"New task from MCP"`
8. **Assert** `card.listId` equals `<listId>`
9. **Assert** `card.archived` is `false` or absent

### 2. Successful card creation with description

1. Call `create_card` with `listId`, `title: "Documented task"`, and `description: "This card has a description"`.
2. Parse the response JSON.
3. **Assert** `card.title` equals `"Documented task"`
4. **Assert** `card.description` equals `"This card has a description"`

### 3. Card appears in the list after creation

1. After step 1, call `GET /api/v1/lists/<listId>/cards` directly.
2. **Assert** the response `data` array contains a card with `id` matching the newly created card's ID.
3. **Assert** `card.title` equals `"New task from MCP"`

### 4. Missing title returns validation error

1. Call `create_card` with `listId` but no `title` argument.
2. **Assert** the tool returns an error content block
3. **Assert** `result.isError` is `true`

### 5. Invalid listId returns error

1. Call `create_card` with `listId: "nonexistent-id"` and a valid `title`.
2. **Assert** the tool returns an error content block containing `list-not-found`
3. **Assert** `result.isError` is `true`

### 6. Access denied — caller is VIEWER only

1. Log in as a user with VIEWER role on the board (not MEMBER or higher).
2. Call `create_card` with that user's token, a valid `listId`, and a `title`.
3. **Assert** the tool returns an error content block (e.g., `insufficient-permissions` or `forbidden`)
4. **Assert** `result.isError` is `true`

### 7. Access denied — non-member on PRIVATE board

1. Log in as a workspace member not in the board's `board_members` table (PRIVATE board).
2. Call `create_card` with that user's token and a valid `listId`.
3. **Assert** the tool returns an error content block (e.g., `board-access-denied`)
4. **Assert** `result.isError` is `true`

### 8. Unauthenticated request is rejected

1. `POST /mcp` with no `Authorization` header and `initialize` JSON-RPC body.
2. **Assert** response status is `401`

## Expected Result
- `create_card` returns the newly created card with `id`, `title`, and `listId`
- Optional `description` is stored and returned when provided
- The created card appears when listing cards for the target list
- Missing `title` triggers a validation error
- Non-existent `listId` returns a `list-not-found` error
- VIEWER-only users cannot create cards (write requires MEMBER role)
- Unauthenticated requests are rejected at session initialisation
