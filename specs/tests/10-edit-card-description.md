# 10. Edit Card Description

**Prerequisites:** Flow 09 completed. Card detail modal for `Test Card 1` is open.  
**Continues from:** Card detail modal.  
**Ends with:** Card has a formatted description saved and persisted after modal close/reopen.

---

## Steps

1. Click the description area inside the card modal (shows placeholder text or an empty editor).
   - **Expected:** Rich-text editor activates with a toolbar (Bold, Italic, etc.).

2. Type the following text:
   ```
   This is the description for Test Card 1.
   ```

3. Select the word `description` and click the **Bold** button in the toolbar.
   - **Expected:** Word appears bold in the editor.

4. Press **Enter** and type a second line:
   ```
   It has multiple lines.
   ```

5. Click **Save** (or click outside the editor if auto-save is used).
   - **Expected:** Description is saved. Editor shows the formatted content.

6. Close the modal (press **Escape** or click ✕).

7. Reopen `Test Card 1` by clicking it on the board.
   - **Expected:** The description persists with bold formatting intact.

---

## Notes

- Leave the modal open to continue to flow **11-labels-dates-checklist**.
