> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: MCP Tool — add_comment

## Overview
Verifies the `add_comment` MCP tool, which posts a new comment on a card. Scenarios cover successful comment creation, input validation, activity feed inclusion, access control, and authentication enforcement.

## Pre-conditions
- Server is running and reachable
- A valid user JWT or `hf_` API token is available
- A board exists with at least one list containing at least one card (`<cardId>`)
- The authenticated user has MEMBER role on the board

## Steps

### 1. Successful comment creation

1. Initialise an MCP session: `POST /mcp` with `Authorization: Bearer <token>` and `initialize` JSON-RPC body. Capture `Mcp-Session-Id`.
2. Call the tool:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "add_comment",
       "arguments": {
         "cardId": "<cardId>",
         "content": "This is a test comment"
       }
     }
   }
   ```
3. **Assert** response status is `200`
4. **Assert** `result.content[0].type` is `"text"`
5. Parse `result.content[0].text` as JSON (call it `comment`).
6. **Assert** `comment.id` is a non-empty string
7. **Assert** `comment.cardId` equals `<cardId>`
8. **Assert** `comment.content` equals `"This is a test comment"`
9. **Assert** `comment.deleted` is `false` or absent

### 2. Comment appears in the card's activity feed

1. After step 1, call `GET /api/v1/cards/<cardId>/comments` directly.
2. **Assert** the `data` array contains a comment with `id` matching the newly created comment's ID.
3. **Assert** that comment's `content` equals `"This is a test comment"`.

### 3. Comment author is the authenticated user

1. Parse the comment returned in step 1.
2. **Assert** `comment.userId` matches the ID of the user whose token was used.

### 4. Comment version is initialised to 1

1. Parse the comment returned in step 1.
2. **Assert** `comment.version` equals `1` (or is `undefined` if versioning starts on first edit).

### 5. Empty content returns validation error

1. Call `add_comment` with `cardId: <cardId>` and `content: ""`.
2. **Assert** the tool returns an error content block.
3. **Assert** `result.isError` is `true`

### 6. Missing content returns validation error

1. Call `add_comment` with `cardId: <cardId>` and no `content` argument.
2. **Assert** the tool returns an error content block.
3. **Assert** `result.isError` is `true`

### 7. Invalid cardId returns error

1. Call `add_comment` with `cardId: "nonexistent-id"` and a valid `content`.
2. **Assert** the tool returns an error content block containing `card-not-found`
3. **Assert** `result.isError` is `true`

### 8. Access denied — caller is not a board member

1. Log in as a user who is not a member of the board containing `<cardId>`.
2. Call `add_comment` with that user's token.
3. **Assert** the tool returns an error content block (e.g., `board-access-denied` or `forbidden`)
4. **Assert** `result.isError` is `true`

### 9. Unauthenticated request is rejected

1. `POST /mcp` with no `Authorization` header and `initialize` JSON-RPC body.
2. **Assert** response status is `401`

## Expected Result
- `add_comment` returns the new comment with `id`, `cardId`, and `content`
- The comment appears when listing comments for the target card
- The comment's `userId` reflects the authenticated caller
- Empty or missing `content` triggers a validation error
- Non-existent `cardId` returns a `card-not-found` error
- Non-board-members cannot comment (access denied)
- Unauthenticated requests are rejected at session initialisation