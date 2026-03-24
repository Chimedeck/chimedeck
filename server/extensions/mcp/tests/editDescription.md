# T4: edit_card_description

## Scenario
Call the `edit_card_description` MCP tool with a valid `cardId` and new `description` to verify the card's description is updated.

## Preconditions
- Taskinate is running at `http://localhost:3000`
- A valid `TASKINATE_TOKEN` is set
- A card exists on a board; record its ID as `CARD_ID`

## Steps

1. Navigate to the card `CARD_ID` and note its current description.
2. Invoke the MCP tool `edit_card_description` with:
   - `cardId`: `CARD_ID`
   - `description`: `"Updated description from MCP T4 test"`
3. Observe the tool response.

## Expected Result
- The tool returns a JSON object under `data` reflecting the updated card (description matches the new text).
- No `isError` flag is set.
- Navigating to the card in the UI, the description shows `"Updated description from MCP T4 test"`.

## Error Cases
- If `cardId` does not exist, the tool returns `{ isError: true, content: [{ type: "text", text: "Error: ..." }] }` and the server does not crash.
- If `description` is omitted, the MCP SDK rejects the call via Zod validation before reaching the handler, returning a structured error.
