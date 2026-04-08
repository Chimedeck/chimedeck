# 08. Add Cards

**Prerequisites:** Flow 07 (Manage Lists) completed. Three lists are on the board.  
**Continues from:** Board view with `To Do`, `In Progress`, `Done` lists.  
**Ends with:** Two cards in `To Do` list. `$cardId` stores the ID of `Test Card 1`.

---

## Steps

1. In the `To Do` list, click **Add a card** (or **+**).
   - **Expected:** Inline card creation input appears.

2. Type `Test Card 1` and press **Enter** (or click **Add Card**).
   - **Expected:** Card tile `Test Card 1` appears in the `To Do` list.

3. Click **Add a card** again in the same list.

4. Type `Test Card 2` and press **Enter**.
   - **Expected:** Card tile `Test Card 2` appears below `Test Card 1`.

5. Store the ID of `Test Card 1` as `$cardId` (visible when opening the card or via URL).

6. Verify both cards are visible in `To Do` and no cards appear in `In Progress` or `Done`.

---

## Notes

- Continue to flow **09-card-detail** — still on the board.
