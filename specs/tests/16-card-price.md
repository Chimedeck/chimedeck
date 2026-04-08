# 16. Card Price

**Prerequisites:** Flow 08 completed. `Test Card 1` exists.  
**Continues from:** Board view (or card detail modal).  
**Ends with:** `Test Card 1` has a price set; price is visible on the card tile and in the detail modal.

---

## Steps

1. Click on `Test Card 1` to open its detail modal if not already open.

2. Locate the **Price** or **Value** field in the card sidebar.
   - **Expected:** An empty price input is shown (e.g. `$ 0.00` or `Set price`).

3. Click the price field and enter `49.99`.

4. Confirm / save (press **Enter** or click save).
   - **Expected:** Price updates to `$49.99` (or locale-formatted equivalent) in the modal.

5. Close the modal.
   - **Expected:** The price badge `$49.99` is visible on the `Test Card 1` tile on the board.

---

## Notes

- Continue to flow **17-board-background** — still on the board.
