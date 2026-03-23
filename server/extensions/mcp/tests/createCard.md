# T3: create_card

## Scenario
Call the `create_card` MCP tool with a valid `listId` and `title` to verify a card is created in the specified list.

## Preconditions
- Horiflow is running at `http://localhost:3000`
- A valid `HORIFLOW_TOKEN` is set
- A board exists with at least one list; record the list's ID as `LIST_ID`

## Steps

1. Navigate to the board containing `LIST_ID` and note the current card count in that list.
2. Invoke the MCP tool `create_card` with:
   - `listId`: `LIST_ID`
   - `title`: `"Test card from MCP"`
   - `description`: `"Created by T3 automated test"`
3. Observe the tool response.

## Expected Result
- The tool returns a JSON object under `data` containing the new card's `id` and `title` matching `"Test card from MCP"`.
- No `isError` flag is set.
- Navigating back to the board, the new card appears in the correct list.

## Error Cases
- If `listId` does not exist, the tool returns `{ isError: true, content: [{ type: "text", text: "Error: ..." }] }` and the server does not crash.
- If `title` is omitted, the MCP SDK rejects the call before it reaches the handler (Zod validation), returning a structured error.
