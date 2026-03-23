# T8: get_card

## Scenario
Call the `get_card` MCP tool with a valid `cardId` to verify the card's full details are returned.

## Preconditions
- Horiflow is running at `http://localhost:3000`
- A valid `HORIFLOW_TOKEN` is set
- A board exists with at least one card; record the card's ID as `CARD_ID`

## Steps

1. Navigate to the board containing `CARD_ID` and note its current title and description.
2. Invoke the MCP tool `get_card` with:
   - `cardId`: `CARD_ID`
3. Observe the tool response.

## Expected Result
- The tool returns a JSON object under `data` containing the card's `id`, `title`, and other fields (e.g., `description`, `listId`).
- The returned `id` matches `CARD_ID`.
- No `isError` flag is set.

## Error Cases
- If `cardId` does not exist or the token has no access to it, the tool returns `{ isError: true, content: [{ type: "text", text: "Error: ..." }] }` and the server does not crash.
- If `cardId` is omitted, the MCP SDK rejects the call before it reaches the handler (Zod validation), returning a structured error.
