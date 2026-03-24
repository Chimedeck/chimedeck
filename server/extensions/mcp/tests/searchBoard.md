# T8: search_board

## Scenario
Call the `search_board` MCP tool with a valid `boardId` and query string to verify matching cards and lists scoped to that board are returned.

## Preconditions
- Taskinate is running at `http://localhost:3000`
- A valid `TASKINATE_TOKEN` is set
- A board exists with at least two cards; one card's title contains the word `"Feature"`. Record the board ID as `BOARD_ID`.

## Steps

1. Invoke the MCP tool `search_board` with:
   - `boardId`: `BOARD_ID`
   - `q`: `"Feature"`
2. Observe the tool response.
3. Invoke the MCP tool `search_board` again with:
   - `boardId`: `BOARD_ID`
   - `q`: `"Feature"`
   - `limit`: `1`
4. Observe the tool response.

## Expected Result
- Step 2: The tool returns a JSON array under `data` containing at least one result whose title includes `"Feature"`. No `isError` flag is set.
- Step 4: The returned array contains at most 1 item, confirming that the `limit` parameter is respected.

## Error Cases
- If `boardId` does not exist or the token lacks access to it, the tool returns `{ isError: true, content: [{ type: "text", text: "Error: ..." }] }` and the server does not crash.
- If `q` is omitted, the MCP SDK rejects the call before it reaches the handler (Zod validation), returning a structured error.
