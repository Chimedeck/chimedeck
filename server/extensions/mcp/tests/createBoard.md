# T5: create_board → create_list → create_card

## Scenario

Use the MCP primitives to bootstrap a disposable local board and prove that a board, list and card can be created in sequence.

## Preconditions

- ChimeDeck is running locally with a seeded writable workspace.
- A valid API token belongs to a workspace member.
- Record the workspace ID as `WORKSPACE_ID`.

## Steps

1. Invoke `create_board` with `workspaceId: WORKSPACE_ID` and title `"MCP bootstrap proof"`.
2. Record the returned board ID.
3. Invoke `create_list` with that board ID and title `"Backlog"`.
4. Record the returned list ID.
5. Invoke `create_card` with that list ID and title `"MCP bootstrap proof card"`.
6. Verify each returned ID through the board/card read tools or the local board UI.

## Expected result

- Each tool returns a structured success payload with the created resource data.
- The board contains `Backlog`, and `Backlog` contains the proof card.
- Existing workspace and board/list permissions remain enforced at every step.

## Boundaries

- This is a disposable local proof only; do not use it against a shared production workspace.
- `create_board` does not create lists or cards implicitly; callers retain explicit, auditable control over each resource.
