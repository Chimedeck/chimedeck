> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Rich Text Toolbar — Single-Line Layout (CardDescriptionTiptap)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in and open a board
- Open a card modal that has a description editor (`CardDescriptionTiptap`)
- Click the description area to enter edit mode

## Steps
1. The editor toolbar renders in rich-text mode
2. Inspect the toolbar row height — it must not exceed one line (no wrapping)
3. The following primary buttons are visible as icon-only buttons: **Bold**, **Italic**, **Strikethrough**, **Bullet list**
4. A **+** (plus) button is visible at the right end of the toolbar
5. Resize the browser window to a narrow viewport (e.g. 360px width) — toolbar must still remain single-line

## Acceptance Criteria
- [ ] Toolbar renders in a single row with no line breaks at any viewport width
- [ ] Bold, Italic, Strikethrough, and Bullet list buttons are always directly visible
- [ ] Buttons are icon-only (no text labels) and have accessible `aria-label` and `title` attributes
- [ ] The **+** button is positioned at the far right of the toolbar
- [ ] No horizontal scrollbar appears on the toolbar row

---

# Test: Rich Text Toolbar — + Overflow Menu (CardDescriptionTiptap)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, click the description area to enter edit mode

## Steps
1. Click the **+** button in the toolbar
2. A dropdown menu opens below the **+** button
3. Menu contains: **Numbered list**, **Quote**, **Code block**
4. Click **Quote** — blockquote formatting is applied in the editor, menu closes
5. Click the **+** button again — menu reopens
6. Click outside the menu — menu closes without applying any formatting
7. Press **Escape** key while menu is focused — menu closes

## Acceptance Criteria
- [ ] Clicking **+** opens the overflow dropdown
- [ ] Dropdown shows Numbered list, Quote, and Code block options
- [ ] Each menu item has an icon and a text label
- [ ] Selecting a menu item applies the formatting and closes the menu
- [ ] Clicking outside the dropdown closes it
- [ ] The active state of a menu item is visually highlighted when the cursor is in that format

---

# Test: Rich Text Toolbar — + Overflow Menu Keyboard Navigation (CardDescriptionTiptap)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, click the description area to enter edit mode

## Steps
1. Tab to the **+** toolbar button and press **Enter** or **Space** — dropdown opens
2. Press **ArrowDown** — focus moves to first item (Numbered list)
3. Press **ArrowDown** again — focus moves to Quote
4. Press **Enter** — Quote formatting is applied, menu closes, focus returns to editor

## Acceptance Criteria
- [ ] **+** button is reachable via keyboard Tab navigation
- [ ] `aria-expanded` attribute reflects open/closed state of the dropdown
- [ ] `role="menu"` is present on the dropdown, `role="menuitem"` on each item
- [ ] Keyboard ArrowDown navigates through menu items
- [ ] Enter/Space on a menu item executes the command and closes the menu
- [ ] Escape closes the menu without executing any command

---

# Test: Rich Text Toolbar — Primary Controls Function Correctly (CardDescriptionTiptap)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, click the description area to enter edit mode
- Type some text in the editor

## Steps
1. Select text and click the **Bold** icon button — text becomes bold
2. Click **Bold** again — bold is toggled off
3. Select text and click the **Italic** icon button — text becomes italic
4. Select text and click the **Strikethrough** icon button — text gets strikethrough
5. Place cursor on a new line and click **Bullet list** — bullet list is started
6. Click **Save** — content saves successfully with all formatting intact

## Acceptance Criteria
- [ ] Bold, Italic, Strikethrough apply and toggle correctly
- [ ] Bullet list converts the current paragraph into a list item
- [ ] Active button state is visually indicated (highlighted background)
- [ ] Save submits markdown preserving the applied formatting
- [ ] Existing save flow (Ctrl/Cmd+Enter shortcut) continues to work

---

# Test: Rich Text Toolbar — Single-Line Layout (CommentEditor)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in and open a board
- Open a card modal
- Locate the new comment editor at the bottom of the activity feed

## Steps
1. The comment editor toolbar renders in rich-text mode
2. Inspect the toolbar row height — it must not exceed one line (no wrapping)
3. The following primary buttons are visible as icon-only buttons: **Bold**, **Italic**, **Strikethrough**, **Bullet list**
4. A **+** (plus) button is visible at the right end of the toolbar
5. Resize the browser window to a narrow viewport (e.g. 360px width) — toolbar must still remain single-line

## Acceptance Criteria
- [ ] Toolbar renders in a single row with no line breaks at any viewport width
- [ ] Bold, Italic, Strikethrough, and Bullet list buttons are always directly visible
- [ ] Buttons are icon-only (no text labels) and have accessible `aria-label` and `title` attributes
- [ ] The **+** button is positioned at the far right of the toolbar
- [ ] No horizontal scrollbar appears on the toolbar row

---

# Test: Rich Text Toolbar — + Overflow Menu (CommentEditor)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, locate the new comment editor

## Steps
1. Click the **+** button in the comment editor toolbar
2. A dropdown menu opens below the **+** button
3. Menu contains: **Numbered list**, **Quote**, **Code block**
4. Click **Quote** — blockquote formatting is applied in the editor, menu closes
5. Click the **+** button again — menu reopens
6. Click outside the menu — menu closes without applying any formatting
7. Press **Escape** key while menu is focused — menu closes

## Acceptance Criteria
- [ ] Clicking **+** opens the overflow dropdown
- [ ] Dropdown shows Numbered list, Quote, and Code block options
- [ ] Each menu item has an icon and a text label
- [ ] Selecting a menu item applies the formatting and closes the menu
- [ ] Clicking outside the dropdown closes it
- [ ] The active state of a menu item is visually highlighted when the cursor is in that format

---

# Test: Rich Text Toolbar — Primary Controls Function Correctly (CommentEditor)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, locate the new comment editor
- Type some text in the comment editor

## Steps
1. Select text and click the **Bold** icon button — text becomes bold
2. Click **Bold** again — bold is toggled off
3. Select text and click the **Italic** icon button — text becomes italic
4. Select text and click the **Strikethrough** icon button — text gets strikethrough
5. Place cursor on a new line and click **Bullet list** — bullet list is started
6. Click **Save** — comment submits successfully with formatting preserved

## Acceptance Criteria
- [ ] Bold, Italic, Strikethrough apply and toggle correctly
- [ ] Bullet list converts the current paragraph into a list item
- [ ] Active button state is visually indicated (highlighted background)
- [ ] Save submits markdown preserving the applied formatting
- [ ] Ctrl/Cmd+Enter shortcut submits the comment

---

# Test: Rich Text Toolbar — Edit Comment Flow (CommentEditor)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal with at least one existing comment
- Click the edit action on an existing comment

## Steps
1. The edit comment form renders with the same toolbar as the new comment editor
2. Existing comment content is pre-populated in the editor
3. Apply a formatting change (e.g. make a word bold)
4. Click **Save** — comment updates with new formatting
5. Click **Cancel** — edit form closes and original comment text is restored

## Acceptance Criteria
- [ ] Edit comment uses the same OneLineToolbar as new comment
- [ ] Pre-existing content is correctly loaded into the editor on open
- [ ] Save updates the comment and closes the edit form
- [ ] Cancel discards changes and closes the edit form
- [ ] Escape key triggers cancel (same as Cancel button)

---

# Test: Rich Text Toolbar — Keyboard Navigation (CommentEditor)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, focus the comment editor

## Steps
1. Tab into the toolbar — focus moves to the **Bold** button
2. Tab through toolbar buttons: Bold → Italic → Strikethrough → Bullet list → +
3. Press **Enter** on the **+** button — overflow menu opens
4. Press **ArrowDown** — focus moves to the first menu item (Numbered list)
5. Press **ArrowDown** again — focus moves to Quote
6. Press **Enter** — Quote formatting is applied, menu closes
7. Press **Escape** from within the editor — no side effects (only cancels within cancel-supporting contexts)

## Acceptance Criteria
- [ ] All toolbar buttons are reachable via Tab navigation
- [ ] `role="toolbar"` is present on the toolbar container
- [ ] `aria-expanded` on **+** button reflects open/closed state
- [ ] Keyboard ArrowDown navigates through overflow menu items
- [ ] Enter/Space on a menu item executes the command and closes the menu
- [ ] Escape closes the overflow menu without executing any command

---

# Test: + Command Menu — Search and Filter (CardDescriptionTiptap)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, click the description area to enter edit mode
- Click the **+** button to open the command menu

## Steps
1. The dropdown opens and a search input is focused automatically
2. The full list of commands is visible: **Mention**, **Emoji**, **Code snippet**, **Quote**, **Numbered list**
3. Type `"co"` in the search input — list filters to show only **Code snippet**
4. Clear the search input — full list is restored
5. Type `"xyz"` — no commands match; an empty-state message is shown ("No matching commands")
6. Clear search, use **ArrowDown** to navigate to **Quote**, press **Enter** — Quote blockquote is applied, menu closes
7. Reopen the menu, click **Mention** — `@` is inserted at cursor, menu closes
8. Reopen the menu, click **Emoji** — `:` is inserted at cursor, menu closes
9. Reopen the menu, press **Escape** — menu closes without any change

## Acceptance Criteria
- [ ] Search input is auto-focused when the command menu opens
- [ ] All five commands are visible without a search query: Mention, Emoji, Code snippet, Quote, Numbered list
- [ ] Typing in the search input filters the list in real time (case-insensitive, matches label and keywords)
- [ ] Empty state message "No matching commands" is shown when no command matches
- [ ] Clearing the search restores the full list
- [ ] Arrow keys navigate the filtered list; active item is visually highlighted
- [ ] Pressing Enter on an active command executes it and closes the menu
- [ ] Pressing Escape closes the menu without executing any command
- [ ] Clicking a command executes it and closes the menu

---

# Test: + Command Menu — Search and Filter (CommentEditor)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, locate the new comment editor
- Click the **+** button to open the command menu

## Steps
1. The dropdown opens and a search input is focused automatically
2. The full list of commands is visible: **Mention**, **Emoji**, **Code snippet**, **Quote**, **Numbered list**
3. Type `"qu"` — list filters to show only **Quote**
4. Press **Enter** — Quote blockquote is applied in the comment editor, menu closes
5. Reopen the menu, type `"em"` — list filters to show only **Emoji**
6. Click **Emoji** — `:` is inserted at cursor, menu closes
7. Reopen the menu, type `"zzz"` — empty-state message is shown
8. Press **Escape** — menu closes, no change to comment content

## Acceptance Criteria
- [ ] Search input is auto-focused when the command menu opens
- [ ] Full command list (Mention, Emoji, Code snippet, Quote, Numbered list) shown without a query
- [ ] Real-time filtering by label/keyword; case-insensitive
- [ ] Empty state shown for unmatched queries
- [ ] Arrow key navigation with visual highlight on active item
- [ ] Enter executes active command and closes menu
- [ ] Escape closes menu without executing any command
- [ ] Active formatting state (e.g. already in blockquote) is visually highlighted in the menu item

---

# Test: + Command Menu — Mention and Emoji Commands (Both Editors)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, enter edit mode for the description or comment editor

## Steps
1. Open the **+** menu and click **Mention**
2. Verify `@` is inserted at the current cursor position in the editor
3. Open the **+** menu and click **Emoji**
4. Verify `:` is inserted at the current cursor position in the editor
5. Open the **+** menu and click **Code snippet**
6. Verify the editor transitions to a code block
7. Open the **+** menu and click **Quote**
8. Verify the editor transitions to a blockquote block

## Acceptance Criteria
- [ ] Mention command inserts `@` at cursor
- [ ] Emoji command inserts `:` at cursor
- [ ] Code snippet command toggles the code block node
- [ ] Quote command toggles the blockquote node
- [ ] All commands close the menu immediately after execution
- [ ] Editor focus is retained after each command (cursor is active in editor)

---

# Test: Attachment Upload — Image Preview + Progress (CardDescriptionTiptap)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal that has a `cardId` wired to the description editor
- Click the description area to enter edit mode

## Steps
1. The toolbar shows a paperclip (🖇) icon button alongside Bold, Italic, etc.
2. Click the paperclip button — the native file picker opens
3. Select an image file (e.g. `photo.jpg`)
4. The file picker closes; an inline upload row appears below the editor content area
5. The row shows: a small image thumbnail on the left, filename and file size, and a progress bar
6. While uploading, the progress bar advances from 0 % to 100 %
7. When upload completes the progress bar disappears and a green "Uploaded" caption appears
8. After ~2 s the row auto-dismisses

## Acceptance Criteria
- [ ] Paperclip button is visible in the toolbar when a `cardId` is present
- [ ] Paperclip button is absent (or disabled) when no `cardId` is provided
- [ ] Clicking the paperclip opens the system file picker
- [ ] After file selection an inline preview row appears immediately (before upload starts)
- [ ] Image files show a thumbnail (object-URL preview) in the row
- [ ] The filename and formatted file size are visible in the row
- [ ] A progress bar is present while the upload is in-flight
- [ ] The row shows "Uploaded" on completion and auto-dismisses after ~2 s
- [ ] Editor content and cursor are not disturbed by the upload flow

---

# Test: Attachment Upload — Non-Image File Preview + Progress (CardDescriptionTiptap)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal in edit mode for the description editor

## Steps
1. Click the paperclip button in the toolbar
2. Select a non-image file (e.g. `report.pdf`)
3. An inline upload row appears with a file-type icon (not a thumbnail), filename, size, and progress bar
4. Upload completes; row shows "Uploaded" then auto-dismisses

## Acceptance Criteria
- [ ] Non-image files show a file-type icon (not an `<img>` thumbnail)
- [ ] Icon matches the file category (PDF icon for `.pdf`, document icon for `.docx`, etc.)
- [ ] Filename and file size are visible
- [ ] Progress bar behaves identically to the image upload case

---

# Test: Attachment Upload — Cancel Mid-Upload (Both Editors)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, enter edit mode (description or comment editor)

## Steps
1. Click the paperclip button and select a large file to ensure the upload takes several seconds
2. The inline upload row appears with a progress bar
3. Click the **×** (cancel) button on the row while the upload is still in progress
4. The row disappears immediately
5. No further progress updates occur; the upload is aborted

## Acceptance Criteria
- [ ] Each upload row has a clearly visible **×** button
- [ ] The **×** button has `aria-label="Cancel upload of <filename>"`
- [ ] Clicking **×** during an upload aborts the XHR / multipart upload
- [ ] The row is removed from the DOM immediately on cancel
- [ ] No duplicate rows or zombie entries remain after cancellation
- [ ] Editor input is not blocked or frozen after a cancelled upload

---

# Test: Attachment Upload — Error State (Both Editors)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, enter edit mode
- (Simulate a network error or server 500 to trigger upload failure)

## Steps
1. Select a file via the paperclip button
2. The upload row appears with a progress bar
3. The upload fails (network error or server error response)
4. The progress bar disappears; a red error message appears inline in the row (e.g. "S3 PUT failed: 500")
5. The **×** button is still present to dismiss the error row

## Acceptance Criteria
- [ ] Upload failure transitions the row to an error state (no progress bar visible)
- [ ] Error message text is visible in red within the row (using `role="alert"`)
- [ ] The **×** button dismisses the error row
- [ ] After dismissal the row is fully removed from the DOM
- [ ] Editor remains fully functional after an upload error
- [ ] Multiple simultaneous uploads show independent error states per file

---

# Test: Attachment Upload — Multiple Simultaneous Files (Both Editors)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal, enter edit mode

## Steps
1. Click the paperclip button and select 3 files at once (multi-select in the file picker)
2. Three separate inline upload rows appear simultaneously, each with its own progress bar
3. Each row progresses independently
4. All three complete and auto-dismiss sequentially

## Acceptance Criteria
- [ ] Selecting multiple files creates one upload row per file
- [ ] Each row has an independent progress bar and cancel button
- [ ] Cancelling one upload does not affect the others
- [ ] All rows auto-dismiss after their respective uploads complete
- [ ] Upload rows do not overflow the editor container (scrollable if needed)

---

# Test: Attachment Upload — Image Preview + Progress (CommentEditor)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal with a `cardId` wired to the comment editor
- Locate the new comment editor at the bottom of the activity feed

## Steps
1. The comment toolbar shows a paperclip icon button
2. Click the paperclip button — native file picker opens
3. Select an image file
4. Inline preview row appears inside the editor container (below the text area, above the submit buttons)
5. Row shows image thumbnail, filename, file size, and a progress bar
6. Upload completes; "Uploaded" caption appears briefly then row auto-dismisses

## Acceptance Criteria
- [ ] Paperclip button visible in comment editor toolbar when `cardId` is provided
- [ ] Inline upload rows appear inside the comment editor container (not in a separate section)
- [ ] Image thumbnail shown for image/* files
- [ ] Progress bar functional; auto-dismiss on completion
- [ ] Submit button remains enabled during upload (uploads are non-blocking)
- [ ] Submitted comment text is independent of in-flight attachments

---

# Test: cardId Threading — Description Editor Attachment Upload (End-to-End)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in and open a board
- Open a card modal (the card must have a known `card.id`)
- The card modal passes `cardId={card.id}` to `CardDescriptionTiptap`

## Steps
1. Open a card modal — description editor is in view mode
2. Click the description text area to enter edit mode
3. The toolbar renders with a **paperclip** (📎) button
4. Click the paperclip — native file picker opens
5. Select any image file
6. Inline upload preview row appears inside the description editor container
7. Row shows: image thumbnail, filename, file size, and a progress indicator
8. Upload completes; the attachment is associated with the correct card (verify via attachment panel)
9. The inline row auto-dismisses after upload succeeds

## Acceptance Criteria
- [ ] `cardId` is non-null in `CardDescriptionTiptap` when opened from `CardModal`
- [ ] Paperclip button appears in the description toolbar (only in edit mode)
- [ ] File picker opens on click
- [ ] Inline upload preview visible inside description editor; card attachment panel updates after upload
- [ ] Upload is scoped to the correct card (attachment appears under `card.id` in the attachment panel)
- [ ] If `cardId` is somehow absent, paperclip button is hidden and no upload is triggered

---

# Test: cardId Threading — New Comment Attachment Upload (End-to-End)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal
- `ActivityFeed` is rendered with `cardId={card.id}` and passes it to the new-comment `CommentEditor`

## Steps
1. Open a card modal; the activity feed new-comment editor is visible
2. The editor toolbar shows a paperclip button
3. Click the paperclip — native file picker opens
4. Select a non-image file (e.g. `.pdf`)
5. Inline upload row appears: filename + file size + progress bar (no thumbnail)
6. Cancel the upload mid-flight — row dismisses, no attachment is created
7. Start a new upload with an image file; let it complete
8. Attachment appears in the card's attachment panel for this card

## Acceptance Criteria
- [ ] `cardId` flows from `ActivityFeed` → new-comment `CommentEditor`
- [ ] Paperclip visible in new-comment toolbar
- [ ] Non-image files show filename row (no thumbnail)
- [ ] Cancel removes the in-progress row and aborts the network request
- [ ] Completed upload is associated with the correct `card.id`
- [ ] Comment text can be submitted independently of attachment upload state

---

# Test: cardId Threading — Edit Comment Attachment Upload (End-to-End)

**Sprint:** 82
**Tool:** Playwright

## Setup
- Log in, open a card modal that has at least one existing comment authored by the current user
- `CommentItem` passes `comment.card_id` to the edit `CommentEditor`

## Steps
1. Click **Edit** on a comment owned by the current user
2. The inline edit `CommentEditor` opens with the existing comment text
3. The editor toolbar shows a paperclip button
4. Click the paperclip — file picker opens
5. Select an image file — inline preview row appears with thumbnail + progress
6. Upload completes; attachment appears in the card's attachment panel
7. Click **Update** to save the edited comment text
8. Both the comment edit and the attachment upload complete independently

## Acceptance Criteria
- [ ] `comment.card_id` is passed as `cardId` to the edit-mode `CommentEditor`
- [ ] Paperclip visible in edit-comment toolbar
- [ ] Upload is scoped to `comment.card_id` (the correct card)
- [ ] Updating comment text does not abort or remove in-flight attachment uploads
- [ ] Attachment appears under the correct card after upload