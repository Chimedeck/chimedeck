# 15. Card Short URL

**Prerequisites:** Flow 08 completed. `Test Card 1` exists.  
**Continues from:** Board view.  
**Ends with:** Short URL for `Test Card 1` verified; navigating to it opens the correct card.

---

## Steps

1. Click on `Test Card 1` to open its detail modal.

2. Locate the **Copy link** button or the short URL display (in the modal footer, header, or share icon).
   - **Expected:** Button is visible.

3. Click **Copy link**.
   - **Expected:** A short URL (e.g. `{TEST_CREDENTIALS.baseUrl}/c/xxxxx`) is copied to the clipboard. A brief "Copied!" confirmation appears.

4. Close the modal.

5. Navigate the browser to the copied short URL.
   - **Expected:** The app opens `Test Card 1` detail modal directly (no 404 or redirect to home).

6. Verify the card title shown is `Test Card 1`.

---

## Notes

- Continue to flow **16-card-price** — still on the board.
