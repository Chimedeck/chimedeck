# T5: set_card_price with amount and currency

## Scenario
Call the `set_card_price` MCP tool with a valid `cardId`, `amount`, and `currency` to verify the card's price fields are updated.

## Preconditions
- Taskinate is running at `http://localhost:3000`
- A valid `TASKINATE_TOKEN` is set
- A board exists with at least one card; record the card's ID as `CARD_ID`

## Steps

1. Navigate to the card with `CARD_ID` and note the current price (if any).
2. Invoke the MCP tool `set_card_price` with:
   - `cardId`: `CARD_ID`
   - `amount`: `49.99`
   - `currency`: `"USD"`
   - `label`: `"Price"`
3. Observe the tool response.
4. Navigate to the card detail page and inspect the displayed price.

## Expected Result
- The tool returns a JSON object under `data` with updated money fields reflecting `amount: 49.99` and `currency: "USD"`.
- No `isError` flag is set.
- The card detail page shows the updated price.

## Error Cases
- If `cardId` does not exist, the tool returns `{ isError: true, content: [{ type: "text", text: "Error: ..." }] }` and the server does not crash.
- If `amount` is not a number or null, the MCP SDK rejects the call via Zod validation before reaching the handler.
