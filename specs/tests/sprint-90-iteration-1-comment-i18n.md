> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 90 · Iteration 1 — Comment Extension i18n

## Purpose
Verify that the Comment extension reads all its UI copy from
`src/extensions/Comment/translations/en.json` and that no hard-coded English
strings remain in the Comment components. All visible text (placeholders,
buttons, labels, empty states, aria-labels) must match the JSON values exactly.

## Preconditions
- Dev server is running and reachable.
- At least one board with at least one card exists in the workspace.
- The signed-in user has permission to add and delete comments on that card.

---

## Test 1 — Comment section renders correctly (empty state)

### Steps
1. Log in and navigate to a board.
2. Open a card that has **no comments yet**.
3. Observe the Comments section.

### Expected
- Section heading reads **"Comments"**.
- Empty-state paragraph reads **"No comments yet."**.
- Comment input placeholder reads **"Add a comment…"**.
- Submit button label reads **"Comment"**.

---

## Test 2 — Add a new comment

### Steps
1. In the card modal from Test 1, click the comment input area.
2. Type the text `Hello from i18n test`.
3. Click the **Comment** button.

### Expected
- The comment appears in the thread with the author name and a relative timestamp.
- The comment input clears after submission.
- No hard-coded English string is visible that differs from the JSON values.

---

## Test 3 — Edit a comment

### Steps
1. Hover over the comment added in Test 2.
2. Click the **Edit** link (should be visible for the comment owner).
3. Observe the editor that appears.

### Expected
- The "Edit" link text matches `translations['comment.action.edit']` → **"Edit"**.
- The submit button now reads **"Update"** (from `translations['comment.editor.update']`).
- A **"Cancel"** button is present.
4. Change the text to `Edited comment` and click **Update**.
5. The comment content updates; the `(edited)` badge appears next to the timestamp.

---

## Test 4 — Delete a comment (confirmation dialog)

### Steps
1. Hover over the updated comment from Test 3.
2. Click the **Delete** link.
3. A browser confirm dialog appears.

### Expected
- The confirmation text reads **"Delete this comment?"** (from `translations['comment.confirm.delete']`).
4. Click **Cancel** in the dialog — the comment is NOT deleted.
5. Click **Delete** again and confirm.
6. The comment is replaced by the deleted placeholder: **"[deleted]"** with the original timestamp.
7. The deleted placeholder has `aria-label="Deleted comment"`.

---

## Test 5 — Asset picker strings

### Steps
1. Open a card that has at least one attachment.
2. Open the comment editor.
3. Click the paperclip / attach button in the toolbar (only visible when `cardId` is set).

### Expected
- Picker header reads **"Insert attachment"**.
- Close button has `aria-label="Close picker"`.
- "Upload from computer" button is present.
- "Card attachments" section label is visible.
- Each existing attachment row has an **"Insert"** action label.
4. If no attachments exist, the empty state reads **"No attachments yet"**.

---

## Test 6 — No regressions

### Steps
1. Complete all Tests 1–5 in sequence on the same card.

### Expected
- All actions (add, edit, delete, cancel) behave identically to pre-i18n behaviour.
- No JavaScript errors appear in the browser console.
- No visible text reads as a raw translation key (e.g. `comment.empty`).