# Board chat assist create-card

## Scenario

1. A board member sends a chat prompt asking the assistant to create a card.
2. The assistant returns a `create_board_card` tool call with a valid payload.
3. The server creates the card, writes a `card_created` activity entry, and tags the activity source as `board-chat-assist`.
4. The assist response includes action-card metadata with `confirmed` state.

## Error cases

- Invalid tool JSON returns `422 invalid-tool-payload`.
- Unsupported tool names return `422 invalid-tool-payload`.
- Permission-denied card creation returns the underlying `403` response.

## Notes

- `suggested`, `confirmed`, and `dismissed` are the UI contract states for board chat action cards.
- The create-card tool is the only function supported in this sprint.
