# T4: create_list

## Scenario

Call the `create_list` MCP tool with a board ID and title to create a list on that board.

## Preconditions

- ChimeDeck is running and reachable through the MCP transport.
- A valid API token belongs to a writable member of the target board.
- Record the target board ID as `BOARD_ID`.

## Steps

1. Invoke `create_list` with `boardId: BOARD_ID` and `title: "Backlog"`.
2. Observe the tool response.
3. Search or reload the board and confirm the returned list is present.

## Expected result

- The response contains the new list data, including its ID and title.
- The list appears on the requested board.
- The caller may supply `afterId` to insert after a known existing list.

## Error cases

- A caller without board write permission receives a structured MCP error.
- An unknown board returns a structured MCP error.
- An omitted or empty title is rejected by Zod before the handler calls the API.
