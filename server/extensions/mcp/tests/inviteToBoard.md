# T7: invite_to_board as admin (success)

## Scenario
Call the `invite_to_board` MCP tool as a board admin to verify a user is successfully invited.

## Preconditions
- ChimeDeck is running at `http://localhost:3000`
- A valid `CHIMEDECK_TOKEN` for a **board admin** user is set
- A board exists; record the board's ID as `BOARD_ID`
- A target user exists with email `invitee@example.com` who is not yet a member

## Steps

1. Navigate to the board with `BOARD_ID` and confirm the invitee is not listed as a member.
2. Invoke the MCP tool `invite_to_board` with:
   - `boardId`: `BOARD_ID`
   - `email`: `"invitee@example.com"`
   - `role`: `"member"`
3. Observe the tool response.
4. Navigate to the board members page and inspect the member list.

## Expected Result
- The tool returns a JSON object under `data` containing the new membership record.
- No `isError` flag is set.
- The board members page shows `invitee@example.com` with the `member` role.

## Error Cases
- If `boardId` does not exist, the tool returns `{ isError: true, content: [{ type: "text", text: "Error: ..." }] }`.
- If `email` is not a valid email address, the MCP SDK rejects the call via Zod validation before reaching the handler.
