# T6: set_card_price with amount=null (clear price)

## Scenario
Call the `set_card_price` MCP tool with `amount: null` to verify the card's price is cleared.

## Preconditions
- ChimeDeck is running at `http://localhost:3000`
- A valid `CHIMEDECK_TOKEN` is set
- A card exists that already has a price set; record the card's ID as `CARD_ID`

## Steps

1. Navigate to the card with `CARD_ID` and confirm a price is displayed.
2. Invoke the MCP tool `set_card_price` with:
   - `cardId`: `CARD_ID`
   - `amount`: `null`
3. Observe the tool response.
4. Navigate to the card detail page and inspect the price field.

## Expected Result
- The tool returns a JSON object under `data` indicating the price was cleared (e.g. `amount: null`).
- No `isError` flag is set.
- The card detail page no longer shows a price.

## Error Cases
- If `cardId` does not exist, the tool returns `{ isError: true, content: [{ type: "text", text: "Error: ..." }] }` and the server does not crash.
