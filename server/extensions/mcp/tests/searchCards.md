# T7: search_cards

## Scenario
Call the `search_cards` MCP tool with a valid `workspaceId` and query string to verify matching cards are returned.

## Preconditions
- Horiflow is running at `http://localhost:3000`
- A valid `HORIFLOW_TOKEN` is set
- A workspace exists with at least two cards; one card's title contains the word `"Alpha"` and another contains `"Beta"`. Record the workspace ID as `WORKSPACE_ID`.

## Steps

1. Invoke the MCP tool `search_cards` with:
   - `workspaceId`: `WORKSPACE_ID`
   - `q`: `"Alpha"`
2. Observe the tool response.
3. Invoke the MCP tool `search_cards` again with:
   - `workspaceId`: `WORKSPACE_ID`
   - `q`: `"Alpha"`
   - `limit`: `1`
4. Observe the tool response.

## Expected Result
- Step 2: The tool returns a JSON array under `data` containing at least one card whose title includes `"Alpha"`. No `isError` flag is set.
- Step 4: The returned array contains at most 1 item, confirming that the `limit` parameter is respected.

## Error Cases
- If `workspaceId` does not exist or the token has no access to it, the tool returns `{ isError: true, content: [{ type: "text", text: "Error: ..." }] }` and the server does not crash.
- If `q` is omitted, the MCP SDK rejects the call before it reaches the handler (Zod validation), returning a structured error.
