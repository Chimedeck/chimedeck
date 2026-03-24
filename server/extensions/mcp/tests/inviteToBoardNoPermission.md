# T8: invite_to_board without permission (structured error)

## Scenario
Call the `invite_to_board` MCP tool with a token that lacks board admin permission to verify a structured error is returned without crashing.

## Preconditions
- Taskinate is running at `http://localhost:3000`
- A valid `TASKINATE_TOKEN` for a **non-admin** board member is set
- A board exists; record the board's ID as `BOARD_ID`

## Steps

1. Invoke the MCP tool `invite_to_board` with:
   - `boardId`: `BOARD_ID`
   - `email`: `"newuser@example.com"`
   - `role`: `"member"`
2. Observe the tool response.

## Expected Result
- The tool returns a response with `isError: true`.
- The `content` array contains a text entry with a JSON object shaped as:
  ```json
  { "error": { "name": "current-user-is-not-admin" } }
  ```
- The MCP server continues running and is not crashed by the error.

## Error Cases
- The server must never throw an unhandled exception for permission errors; all API errors must be caught and returned as structured MCP error responses.
