> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: MCP Tool — get_card

## Overview
Verifies the `get_card` MCP tool, which retrieves the full details of a single card by its ID. Scenarios cover successful retrieval, not-found errors, access control, and response shape validation.

## Pre-conditions
- Server is running and reachable
- A valid user JWT or `hf_` API token is available
- A card exists on a board where the authenticated user has VIEWER role
- The card has a non-empty title and an optional description

## Steps

### 1. Successful card detail retrieval

1. Initialise an MCP session: `POST /mcp` with `Authorization: Bearer <token>` and `initialize` JSON-RPC body. Capture `Mcp-Session-Id`.
2. Call the tool:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "get_card",
       "arguments": { "cardId": "<cardId>" }
     }
   }
   ```
3. **Assert** response status is `200`
4. **Assert** `result.content[0].type` is `"text"`
5. Parse `result.content[0].text` as JSON (call it `card`).
6. **Assert** `card.id` equals `<cardId>`
7. **Assert** `card.title` is a non-empty string
8. **Assert** `card.listId` is a string (the list the card belongs to)

### 2. Response includes optional fields when present

1. Ensure the card has a `description`, at least one assigned member, and a `dueDate` set.
2. Call `get_card` with that card's ID.
3. Parse the response JSON.
4. **Assert** `card.description` is a non-empty string
5. **Assert** `card.members` is an array with at least one item
6. **Assert** `card.dueDate` is an ISO 8601 date string

### 3. Card not found

1. Call `get_card` with `cardId: "nonexistent-id"`.
2. **Assert** the tool returns an error content block containing `card-not-found`
3. **Assert** `result.isError` is `true`

### 4. Access denied — caller lacks board access

1. Log in as a workspace member not in the board's `board_members` table (PRIVATE board).
2. Call `get_card` with that user's token and the card's ID.
3. **Assert** the tool returns an error content block (e.g., `board-access-denied` or `forbidden`)
4. **Assert** `result.isError` is `true`

### 5. Archived card is still retrievable

1. Archive a card (set `archived: true`).
2. Call `get_card` with that card's ID.
3. Parse the response JSON.
4. **Assert** `card.id` equals the archived card's ID
5. **Assert** `card.archived` is `true`

### 6. Unauthenticated request is rejected

1. `POST /mcp` with no `Authorization` header and `initialize` JSON-RPC body.
2. **Assert** response status is `401`

## Expected Result
- `get_card` returns full card detail including `id`, `title`, and `listId`
- Optional fields (`description`, `members`, `dueDate`) are present when set on the card
- Non-existent card IDs return a `card-not-found` error
- Callers without board access receive an access-denied error
- Archived cards are retrievable with `archived: true` in the response
- Unauthenticated requests are rejected at session initialisation