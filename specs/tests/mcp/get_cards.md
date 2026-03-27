> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: MCP Tool — get_cards

## Overview
Verifies the `get_cards` MCP tool, which retrieves all active (non-archived) cards in a specific list. Scenarios cover successful retrieval, empty lists, access control, and archived card exclusion.

## Pre-conditions
- Server is running and reachable
- A valid user JWT or `hf_` API token is available
- A board exists with at least one list containing 3 or more cards (at least 1 archived)
- The authenticated user has VIEWER access to the board

## Steps

### 1. Successful card listing for a list

1. Initialise an MCP session: `POST /mcp` with `Authorization: Bearer <token>` and `initialize` JSON-RPC body. Capture `Mcp-Session-Id`.
2. Call the tool:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "get_cards",
       "arguments": { "listId": "<listId>" }
     }
   }
   ```
3. **Assert** response status is `200`
4. **Assert** `result.content[0].type` is `"text"`
5. Parse `result.content[0].text` as JSON (call it `cards`).
6. **Assert** `cards` is an array
7. **Assert** each card has at minimum `id` (string) and `title` (string) fields
8. **Assert** the count of returned cards equals the number of non-archived cards in the list

### 2. Archived cards are excluded by default

1. Call `get_cards` with the same `listId` as step 1.
2. **Assert** no card in the returned array has `archived: true`
3. **Assert** the archived card created in Pre-conditions is not present in the array

### 3. Empty list returns empty array

1. Create a new list with no cards.
2. Call `get_cards` with the new list's ID.
3. **Assert** `JSON.parse(result.content[0].text)` is an empty array `[]`

### 4. List not found

1. Call `get_cards` with `listId: "nonexistent-id"`.
2. **Assert** the tool returns an error content block containing `list-not-found`
3. **Assert** `result.isError` is `true`

### 5. Access denied — caller lacks board access

1. Log in as a workspace member not in the board's `board_members` table (PRIVATE board).
2. Call `get_cards` with that user's token and the list ID.
3. **Assert** the tool returns an error content block (e.g., `board-access-denied` or `forbidden`)
4. **Assert** `result.isError` is `true`

### 6. Unauthenticated request is rejected

1. `POST /mcp` with no `Authorization` header and `initialize` JSON-RPC body.
2. **Assert** response status is `401`

## Expected Result
- `get_cards` returns only non-archived cards for the given list
- Each card has at least `id` and `title`
- Empty lists return an empty array
- Non-existent list IDs return a `list-not-found` error
- Callers without board access receive an error
- Unauthenticated requests are rejected at session initialisation