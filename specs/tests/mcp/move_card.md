> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: MCP Tool — move_card

## Overview
Verifies the `move_card` MCP tool, which moves a card from one list to another within the same board, or to a list on a different board. Scenarios cover successful moves, position control, cross-board moves, access control, and error cases.

## Pre-conditions
- Server is running and reachable
- A valid user JWT or `hf_` API token is available
- A board exists with at least two lists (`listA` and `listB`), each containing at least one card
- The authenticated user has MEMBER role on the board

## Steps

### 1. Successful card move to another list on the same board

1. Initialise an MCP session: `POST /mcp` with `Authorization: Bearer <token>` and `initialize` JSON-RPC body. Capture `Mcp-Session-Id`.
2. Call the tool:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "move_card",
       "arguments": {
         "cardId": "<cardId>",
         "listId": "<listBId>"
       }
     }
   }
   ```
3. **Assert** response status is `200`
4. **Assert** `result.content[0].type` is `"text"`
5. Parse `result.content[0].text` as JSON (call it `card`).
6. **Assert** `card.id` equals `<cardId>`
7. **Assert** `card.listId` equals `<listBId>`

### 2. Card appears in destination list after move

1. After step 1, call `GET /api/v1/lists/<listBId>/cards` directly.
2. **Assert** the `data` array contains a card with `id` matching `<cardId>`.
3. Call `GET /api/v1/lists/<listAId>/cards` directly.
4. **Assert** the `data` array does NOT contain a card with `id` matching `<cardId>`.

### 3. Move card to a specific position

1. Ensure `listB` contains at least two cards.
2. Call `move_card` with `cardId`, `listId: <listBId>`, and `position: 0`.
3. Parse the response JSON.
4. **Assert** `card.listId` equals `<listBId>`
5. Call `GET /api/v1/lists/<listBId>/cards` and parse the `data` array.
6. **Assert** the first card in the array has `id` matching `<cardId>`.

### 4. Move card to a different board

1. Create a second board with at least one list (`listC`).
2. Call `move_card` with `cardId`, `listId: <listCId>`.
3. Parse the response JSON.
4. **Assert** `card.listId` equals `<listCId>`
5. Call `GET /api/v1/lists/<listCId>/cards`.
6. **Assert** the `data` array contains the card.

### 5. Invalid cardId returns error

1. Call `move_card` with `cardId: "nonexistent-id"` and a valid `listId`.
2. **Assert** the tool returns an error content block containing `card-not-found`
3. **Assert** `result.isError` is `true`

### 6. Invalid listId returns error

1. Call `move_card` with a valid `cardId` and `listId: "nonexistent-id"`.
2. **Assert** the tool returns an error content block containing `list-not-found`
3. **Assert** `result.isError` is `true`

### 7. Access denied — caller is VIEWER only

1. Log in as a user with VIEWER role on the board.
2. Call `move_card` with that user's token, a valid `cardId`, and a valid `listId`.
3. **Assert** the tool returns an error content block (e.g., `insufficient-permissions` or `forbidden`)
4. **Assert** `result.isError` is `true`

### 8. Archived card cannot be moved

1. Archive `<cardId>` via `PATCH /api/v1/cards/<cardId>` with `{ "archived": true }`.
2. Call `move_card` with the archived card's ID and a valid `listId`.
3. **Assert** the tool returns an error content block (e.g., `card-is-archived`)
4. **Assert** `result.isError` is `true`

### 9. Unauthenticated request is rejected

1. `POST /mcp` with no `Authorization` header and `initialize` JSON-RPC body.
2. **Assert** response status is `401`

## Expected Result
- `move_card` returns the updated card with the new `listId`
- The card appears in the destination list and is absent from the source list
- Optional `position` argument controls card order within the destination list
- Cross-board moves work when the caller has access to both boards
- Non-existent `cardId` or `listId` return descriptive error content blocks
- VIEWER-only users cannot move cards
- Archived cards cannot be moved
- Unauthenticated requests are rejected at session initialisation