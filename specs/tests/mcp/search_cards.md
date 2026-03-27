> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: MCP Tool — search_cards

## Overview
Verifies the `search_cards` MCP tool, which performs full-text search across card titles and descriptions within a workspace or board. Scenarios cover successful matches, empty results, access-scoped filtering, board-scoped search, and authentication enforcement.

## Pre-conditions
- Server is running and reachable
- A valid user JWT or `hf_` API token is available
- A workspace exists with at least two boards
- Board A (PUBLIC): contains a card titled `"Deploy production hotfix"` with description `"urgent rollback"`
- Board B (PRIVATE): contains a card titled `"Deploy staging build"` — the authenticated user is NOT a member of Board B
- The authenticated user is a member of the workspace and Board A

## Steps

### 1. Successful search by title keyword

1. Initialise an MCP session: `POST /mcp` with `Authorization: Bearer <token>` and `initialize` JSON-RPC body. Capture `Mcp-Session-Id`.
2. Call the tool:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "search_cards",
       "arguments": {
         "workspaceId": "<workspaceId>",
         "query": "hotfix"
       }
     }
   }
   ```
3. **Assert** response status is `200`
4. **Assert** `result.content[0].type` is `"text"`
5. Parse `result.content[0].text` as JSON (call it `results`).
6. **Assert** `results` is an array with length ≥ 1
7. **Assert** at least one item has `title` containing `"hotfix"`

### 2. Search matches description text

1. Call `search_cards` with `workspaceId` and `query: "urgent rollback"`.
2. Parse the response JSON.
3. **Assert** at least one result has `id` matching the card from Board A.
4. **Assert** `card.description` contains `"urgent rollback"` (or search result indicates a description match).

### 3. Search respects board access — private board cards not returned

1. Call `search_cards` with `workspaceId` and `query: "staging build"`.
2. Parse the response JSON.
3. **Assert** no item in `results` has `boardId` equal to the ID of Board B (PRIVATE, non-member).

### 4. Board-scoped search

1. Call `search_cards` with `boardId: <boardAId>` and `query: "hotfix"`.
2. Parse the response JSON.
3. **Assert** all items in `results` have `boardId` equal to `<boardAId>`.
4. **Assert** at least one item has `title` containing `"hotfix"`.

### 5. Search returns empty array for no matches

1. Call `search_cards` with `workspaceId` and `query: "zzz_no_match_xqz"`.
2. Parse the response JSON.
3. **Assert** `results` is an empty array `[]`.

### 6. Missing query returns validation error

1. Call `search_cards` with `workspaceId` but no `query` argument.
2. **Assert** the tool returns an error content block.
3. **Assert** `result.isError` is `true`

### 7. Missing workspaceId and boardId returns validation error

1. Call `search_cards` with only `query: "hotfix"` and neither `workspaceId` nor `boardId`.
2. **Assert** the tool returns an error content block.
3. **Assert** `result.isError` is `true`

### 8. Invalid workspaceId returns error

1. Call `search_cards` with `workspaceId: "nonexistent-id"` and a valid `query`.
2. **Assert** the tool returns an error content block containing `workspace-not-found` or `not-a-workspace-member`
3. **Assert** `result.isError` is `true`

### 9. Archived cards are excluded from results

1. Archive the card titled `"Deploy production hotfix"` via `PATCH /api/v1/cards/<cardId>` with `{ "archived": true }`.
2. Call `search_cards` with `workspaceId` and `query: "hotfix"`.
3. **Assert** the archived card is NOT present in `results`.

### 10. Unauthenticated request is rejected

1. `POST /mcp` with no `Authorization` header and `initialize` JSON-RPC body.
2. **Assert** response status is `401`

## Expected Result
- `search_cards` returns an array of matching cards from accessible boards
- Title and description fields are both searched
- Cards on PRIVATE boards where the caller is not a member are excluded
- `boardId` argument scopes results to a single board
- Empty query or missing scope identifiers trigger validation errors
- Archived cards are excluded from search results
- Unauthenticated requests are rejected at session initialisation