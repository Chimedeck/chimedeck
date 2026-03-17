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
