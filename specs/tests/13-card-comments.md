# 13. Card Comments & Mentions

**Prerequisites:** Flow 12 completed. Card detail modal for `Test Card 1` is open.  
**Continues from:** Card detail modal.  
**Ends with:** A comment is posted, edited, and deleted; a mention comment is also posted.

---

## Steps

### Post a Comment

1. Click the comment input at the bottom of the modal (placeholder: `Add a comment…`).
   - **Expected:** Input activates with a **Comment** submit button.

2. Type `This is the first comment.` and click **Comment**.
   - **Expected:** Comment appears in the activity feed with the current user's name and timestamp.

### Edit the Comment

3. Hover over the comment to reveal the edit action (pencil icon or **Edit** option).

4. Click **Edit**.
   - **Expected:** Comment text becomes editable.

5. Append ` (edited)` to the text and click **Update** (or **Save**).
   - **Expected:** Comment updates in place and shows `(edited)` badge or updated text.

### Delete the Comment

6. Hover over the original comment again and click **Delete**.
   - **Expected:** Confirmation dialog appears: `Delete this comment?`.

7. Confirm deletion.
   - **Expected:** Comment is replaced by a `[deleted]` placeholder or removed from the feed.

### Mention

8. Click the comment input and type `Hello ` then type `@`.
   - **Expected:** A mention autocomplete dropdown appears listing workspace members.

9. Select `TEST_CREDENTIALS.admin.email` (or the admin user's display name) from the dropdown.

10. Complete the text: `please review this card.` and click **Comment**.
    - **Expected:** Comment posts with the mention highlighted. A notification is triggered for the mentioned user.

---

## Notes

- Leave the modal open for flow **14-move-card**.
