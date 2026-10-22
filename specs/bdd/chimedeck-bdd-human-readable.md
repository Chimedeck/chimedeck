# Chimedeck Human-Readable BDD (Manual Flows)

> Generated from `specs/tests/*.md` into Gherkin-style scenarios for product/design review.

> Unlike the generated index spec, this is narrative behavior-oriented.


## Feature: 01. Sign Up

**Source:** `specs/tests/01-signup.md`


### Scenario: 01. Sign Up core flow

**Given** None — this is the first step of the entire test suite.

**When** Navigate to `{TEST_CREDENTIALS.baseUrl}`.

**Then** Home / marketing page or login page loads.

**When** Click the **Sign Up** (or **Create account**) button.

**Then** Registration form appears with fields for Name, Email, and Password.

**When** Fill in the form:

**When** Submit the form.

**Then** Account is created. The app either shows an email-verification prompt or redirects to the main dashboard.

**When** Verify the page title or heading confirms registration success (no error messages visible).

**And** Browser on the post-registration screen (email verification prompt or dashboard). A unique `$newUserEmail` is stored for use if needed in later flows.


---


## Feature: 02. Email Verification

**Source:** `specs/tests/02-verify-email.md`


### Scenario: 02. Email Verification core flow

**Given** Flow 01 (Sign Up) completed. User is logged in but email is unverified.

**And** Post-registration screen.

**When** Observe the verification banner on the dashboard (e.g. "Please verify your email address").

**Then** Banner is visible at the top of the page.

**When** Click **Resend verification email** inside the banner.

**Then** A confirmation message appears ("Verification email sent").

**When** Trigger email verification via the admin API (simulates clicking the link in the email):

**Then** `200 OK` with `data.verified: true`.

**When** Reload the page.

**Then** The verification banner is gone. The account is fully active.

**And** User's email is verified and the verification banner is dismissed.


---


## Feature: 03. Login

**Source:** `specs/tests/03-login.md`


### Scenario: 03. Login core flow

**Given** An account exists for `TEST_CREDENTIALS.admin.email`.

**And** Logged-out state (or start here if bypassing flows 01–02).

**When** Navigate to `{TEST_CREDENTIALS.baseUrl}`.

**Then** Login page or home page loads.

**When** Click **Log in** if not already on the login form.

**When** Fill in:

**When** Click **Log in** / **Sign in**.

**Then** Redirect to the main dashboard or workspace view. The user's name/avatar is visible in the top bar.

**When** Confirm no error messages are shown.

**And** Logged in as admin, on the main dashboard.


---


## Feature: 04. Profile Setup

**Source:** `specs/tests/04-setup-profile.md`


### Scenario: 04. Profile Setup core flow

**Given** Flow 03 (Login) completed. Logged in as admin.

**And** Dashboard.

**When** Open the user profile menu (click the avatar / username in the top bar or sidebar).

**When** Click **Profile Settings** (or navigate to `{TEST_CREDENTIALS.baseUrl}/profile`).

**Then** Profile settings page loads showing current display name and avatar.

**When** Click the **Edit** control next to the display name (or the nickname field).

**When** Clear the current name and type `Admin User`.

**Then** Field is updated.

**When** Click **Save** (or equivalent).

**Then** Success confirmation. Display name updates in the header.

**When** Click the avatar upload area / **Change avatar** button.

**When** Upload any valid image file (PNG or JPEG, < 5 MB).

**Then** Avatar preview updates.

**When** Save the avatar change.

**Then** New avatar is visible in the top bar.

**And** Profile nickname and avatar updated; browser on profile settings page.


---


## Feature: 05. Create Workspace

**Source:** `specs/tests/05-create-workspace.md`


### Scenario: 05. Create Workspace core flow

**Given** Flow 03 (Login) completed. Logged in as admin.

**And** Dashboard.

**When** In the sidebar, click **+ Create workspace** (or the workspace switcher button).

**Then** A "Create workspace" dialog or page appears.

**When** Fill in:

**When** Submit / click **Create**.

**Then** Workspace is created. The app shows the workspace view (empty boards list). The sidebar shows `Test Workspace`.

**When** Store the workspace ID as `$workspaceId` (visible in the URL or via `GET {TEST_CREDENTIALS.baseUrl}/api/v1/workspaces`).

**And** A new workspace `Test Workspace` exists and is selected in the sidebar. `$workspaceId` is stored.


---


## Feature: 06. Create Board

**Source:** `specs/tests/06-create-board.md`


### Scenario: 06. Create Board core flow

**Given** Flow 05 (Create Workspace) completed. Inside `Test Workspace`.

**And** Workspace view (empty boards list).

**When** Click **+ Create board** (or the "New board" button inside the workspace).

**Then** Board creation form appears.

**When** Fill in:

**When** Click **Create** (or **Save**).

**Then** Redirected to the new board view. Board shows an empty column area.

**When** Store the board ID from the URL (e.g. `{TEST_CREDENTIALS.baseUrl}/boards/$boardId`) as `$boardId`.

**And** Board `Test Board` is open in the browser. `$boardId` is stored.


---


## Feature: 07. Manage Lists

**Source:** `specs/tests/07-manage-lists.md`


### Scenario: 07. Manage Lists core flow

**Given** Flow 06 (Create Board) completed. On `Test Board`.

**And** Board view (no lists yet).

**When** Click **Add a list** (or **+ Add list**).

**Then** An inline input appears.

**When** Type `To Do` and press **Enter** (or click **Add List**).

**Then** "To Do" list column appears on the board.

**When** Click **Add a list** again and type `In Progress`, confirm.

**Then** "In Progress" column appears to the right.

**When** Click **Add a list** again and type `Done`, confirm.

**Then** "Done" column appears to the right.

**When** Double-click (or click the edit icon on) the `To Do` list header to rename it.

**When** Change the name to `Backlog` and confirm.

**Then** Column header now reads `Backlog`.

**When** Rename it back to `To Do` and confirm.

**Then** Column header reads `To Do` again.

**And** Three lists — `To Do`, `In Progress`, `Done` — visible on the board. A list has been renamed successfully.


---


## Feature: 08. Add Cards

**Source:** `specs/tests/08-add-cards.md`


### Scenario: 08. Add Cards core flow

**Given** Flow 07 (Manage Lists) completed. Three lists are on the board.

**And** Board view with `To Do`, `In Progress`, `Done` lists.

**When** In the `To Do` list, click **Add a card** (or **+**).

**Then** Inline card creation input appears.

**When** Type `Test Card 1` and press **Enter** (or click **Add Card**).

**Then** Card tile `Test Card 1` appears in the `To Do` list.

**When** Click **Add a card** again in the same list.

**When** Type `Test Card 2` and press **Enter**.

**Then** Card tile `Test Card 2` appears below `Test Card 1`.

**When** Store the ID of `Test Card 1` as `$cardId` (visible when opening the card or via URL).

**When** Verify both cards are visible in `To Do` and no cards appear in `In Progress` or `Done`.

**And** Two cards in `To Do` list. `$cardId` stores the ID of `Test Card 1`.


---


## Feature: 09. Card Detail

**Source:** `specs/tests/09-card-detail.md`


### Scenario: 09. Card Detail core flow

**Given** Flow 08 (Add Cards) completed. `Test Card 1` exists in `To Do`.

**And** Board view.

**When** Click on `Test Card 1` card tile.

**Then** Card detail modal opens.

**When** Verify the following sections are visible in the modal:

**When** Verify the modal header shows the list name `To Do` (breadcrumb or subtitle).

**When** Verify the close button (✕) is present and pressing **Escape** closes the modal.

**Then** Modal closes; board is visible.

**When** Reopen the modal by clicking `Test Card 1` again.

**Then** Modal opens in the same state.

**And** Card detail modal for `Test Card 1` is open.


---


## Feature: 10. Edit Card Description

**Source:** `specs/tests/10-edit-card-description.md`


### Scenario: 10. Edit Card Description core flow

**Given** Flow 09 completed. Card detail modal for `Test Card 1` is open.

**And** Card detail modal.

**When** Click the description area inside the card modal (shows placeholder text or an empty editor).

**Then** Rich-text editor activates with a toolbar (Bold, Italic, etc.).

**When** Type the following text:

**When** Select the word `description` and click the **Bold** button in the toolbar.

**Then** Word appears bold in the editor.

**When** Press **Enter** and type a second line:

**When** Click **Save** (or click outside the editor if auto-save is used).

**Then** Description is saved. Editor shows the formatted content.

**When** Close the modal (press **Escape** or click ✕).

**When** Reopen `Test Card 1` by clicking it on the board.

**Then** The description persists with bold formatting intact.

**And** Card has a formatted description saved and persisted after modal close/reopen.


---


## Feature: 11. Labels, Due Date, Start Date & Checklist

**Source:** `specs/tests/11-labels-dates-checklist.md`


### Scenario: 11. Labels, Due Date, Start Date & Checklist core flow

**Given** Flow 10 completed. Card detail modal for `Test Card 1` is open.

**And** Card detail modal.

**When** Click **Labels** (or the label icon) in the card sidebar/actions area.

**Then** Label picker opens.

**When** Click **Create a new label**, enter the name `Bug`, choose a colour (e.g. red), and save.

**Then** Label `Bug` appears in the picker.

**When** Click the `Bug` label to apply it to the card.

**Then** `Bug` label chip appears on the card (in the modal header and on the board tile).

**When** Close the label picker.

**When** Click **Due Date** in the card sidebar.

**Then** A date picker opens.

**When** Select a date 7 days from today.

**Then** Due date is shown on the card (e.g. `Due: Jan 3`).

**When** Close the date picker.

**When** Click **Start Date** in the card sidebar.

**Then** A date picker opens.

**When** Select today's date.

**Then** Start date is shown on the card.

**When** Click **Add checklist** (or the checklist icon) in the card sidebar.

**Then** A checklist titled `Tasks` (or similar) appears in the card body.

**When** Click **Add an item** in the checklist. Type `First task` and press **Enter**.

**Then** Checklist item appears unchecked.

**When** Click the checkbox next to `First task`.

**Then** Item is checked off; progress bar or counter updates (e.g. `1/1`).

**And** Card has a label `Bug`, a due date, a start date, and a checklist with one checked item.


---


## Feature: 12. Card Attachments

**Source:** `specs/tests/12-card-attachments.md`


### Scenario: 12. Card Attachments core flow

**Given** Flow 11 completed. Card detail modal for `Test Card 1` is open.

**And** Card detail modal.

**When** Click **Attach file** (or the paperclip icon / **Attachments** section **+** button).

**Then** A file picker or drag-and-drop overlay appears.

**When** Upload a small PNG or text file (< 1 MB).

**Then** Upload progress indicator appears briefly, then the attachment is listed with its filename in the **Attachments** section.

**When** Verify the attachment shows a status badge **Ready** (not Scanning / Rejected).

**When** Click **Attach a link** (or **Add a URL**) in the Attachments section.

**Then** A form appears with URL and optional name fields.

**When** Enter:

**When** Click **Attach** (or **Save**).

**Then** Link attachment `Example Link` appears in the attachments list with the URL below it.

**When** Confirm the Attachments section now shows 2 items (1 file + 1 link).

**And** Card has one file attachment and one link attachment.


---


## Feature: 13. Card Comments & Mentions

**Source:** `specs/tests/13-card-comments.md`


### Scenario: 13. Card Comments & Mentions core flow

**Given** Flow 12 completed. Card detail modal for `Test Card 1` is open.

**And** Card detail modal.

**When** Click the comment input at the bottom of the modal (placeholder: `Add a comment…`).

**Then** Input activates with a **Comment** submit button.

**When** Type `This is the first comment.` and click **Comment**.

**Then** Comment appears in the activity feed with the current user's name and timestamp.

**When** Hover over the comment to reveal the edit action (pencil icon or **Edit** option).

**When** Click **Edit**.

**Then** Comment text becomes editable.

**When** Append ` (edited)` to the text and click **Update** (or **Save**).

**Then** Comment updates in place and shows `(edited)` badge or updated text.

**When** Hover over the original comment again and click **Delete**.

**Then** Confirmation dialog appears: `Delete this comment?`.

**When** Confirm deletion.

**Then** Comment is replaced by a `[deleted]` placeholder or removed from the feed.

**When** Click the comment input and type `Hello ` then type `@`.

**Then** A mention autocomplete dropdown appears listing workspace members.

**When** Select `TEST_CREDENTIALS.admin.email` (or the admin user's display name) from the dropdown.

**When** Complete the text: `please review this card.` and click **Comment**.

**Then** Comment posts with the mention highlighted. A notification is triggered for the mentioned user.

**And** A comment is posted, edited, and deleted; a mention comment is also posted.


---


## Feature: 14. Move Card

**Source:** `specs/tests/14-move-card.md`


### Scenario: 14. Move Card core flow

**Given** Flow 08 (Add Cards) completed. `Test Card 1` and `Test Card 2` are in `To Do`.

**And** Board view (close the card modal first if open).

**When** Close the card detail modal if it is open (press **Escape**).

**Then** Board view is showing all three lists.

**When** Drag `Test Card 1` from the `To Do` column and drop it into the `In Progress` column.

**Then** `Test Card 1` appears in `In Progress`. `To Do` now contains only `Test Card 2`.

**When** Open `Test Card 1` by clicking it.

**Then** Card detail modal opens; breadcrumb shows `In Progress`.

**When** Close the modal.

**When** Right-click (or click the card's **⋮** menu) on `Test Card 1` to open the card action menu.

**When** Select **Move** → choose list `Done` → confirm.

**Then** `Test Card 1` moves to `Done`.

**When** Repeat step 5–6 to move the card back to `In Progress`.

**Then** `Test Card 1` is back in `In Progress`.

**And** `Test Card 1` is in `In Progress`. `Test Card 2` remains in `To Do`.


---


## Feature: 15. Card Short URL

**Source:** `specs/tests/15-card-short-url.md`


### Scenario: 15. Card Short URL core flow

**Given** Flow 08 completed. `Test Card 1` exists.

**And** Board view.

**When** Click on `Test Card 1` to open its detail modal.

**When** Locate the **Copy link** button or the short URL display (in the modal footer, header, or share icon).

**Then** Button is visible.

**When** Click **Copy link**.

**Then** A short URL (e.g. `{TEST_CREDENTIALS.baseUrl}/c/xxxxx`) is copied to the clipboard. A brief "Copied!" confirmation appears.

**When** Close the modal.

**When** Navigate the browser to the copied short URL.

**Then** The app opens `Test Card 1` detail modal directly (no 404 or redirect to home).

**When** Verify the card title shown is `Test Card 1`.

**And** Short URL for `Test Card 1` verified; navigating to it opens the correct card.


---


## Feature: 16. Card Price

**Source:** `specs/tests/16-card-price.md`


### Scenario: 16. Card Price core flow

**Given** Flow 08 completed. `Test Card 1` exists.

**And** Board view (or card detail modal).

**When** Click on `Test Card 1` to open its detail modal if not already open.

**When** Locate the **Price** or **Value** field in the card sidebar.

**Then** An empty price input is shown (e.g. `$ 0.00` or `Set price`).

**When** Click the price field and enter `49.99`.

**When** Confirm / save (press **Enter** or click save).

**Then** Price updates to `$49.99` (or locale-formatted equivalent) in the modal.

**When** Close the modal.

**Then** The price badge `$49.99` is visible on the `Test Card 1` tile on the board.

**And** `Test Card 1` has a price set; price is visible on the card tile and in the detail modal.


---


## Feature: 17. Board Background

**Source:** `specs/tests/17-board-background.md`


### Scenario: 17. Board Background core flow

**Given** Flow 06 (Create Board) completed. On `Test Board`.

**And** Board view.

**When** On the board, click the **Customize** button (or **⋮** → **Change background**).

**Then** Background customization panel opens showing colour swatches or image options.

**When** Select a **solid colour** background (e.g. green or blue).

**Then** Board background changes immediately to the selected colour.

**When** Select a different colour (e.g. red).

**Then** Board background updates to the new colour.

**When** If an **Upload image** option is available:

**Then** Board background updates to show the uploaded image.

**When** Select the original default background or close the panel.

**Then** Panel closes; board shows the last selected background.

**And** Board background has been changed to a solid colour and then reset.


---


## Feature: 18. Star & Follow Board

**Source:** `specs/tests/18-board-star-follow.md`


### Scenario: 18. Star & Follow Board core flow

**Given** Flow 06 (Create Board) completed. On `Test Board`.

**And** Board view.

**When** Click the **☆ Star** icon in the board header (next to the board title).

**Then** Icon becomes filled (★). A "Starred" confirmation may briefly appear.

**When** Navigate to the home / workspace page (click the workspace name in the sidebar).

**Then** `Test Board` appears under a **Starred Boards** section in the sidebar.

**When** Navigate back to `Test Board`.

**When** Click the ★ icon again to unstar.

**Then** Icon returns to ☆. Board is no longer in the Starred section.

**When** Re-star the board (click ☆ again) so it remains starred for future flows.

**When** If a **Follow** button is present (separate from star):

**Then** Returns to **Follow** state.

**And** `Test Board` is starred and visible in the starred section of the sidebar.


---


## Feature: 19. Invite Member to Board

**Source:** `specs/tests/19-invite-member.md`


### Scenario: 19. Invite Member to Board core flow

**Given** Flow 06 (Create Board) completed. On `Test Board`. A second account `TEST_CREDENTIALS.user.email` exists.

**And** Board view.

**When** Open the **Members** panel on the board (click the **Members** button or people icon in the board header).

**Then** Members panel slides open listing the current admin as the only member.

**When** Click **Invite member** (or **+ Add member**).

**Then** An invite form appears with an email field and a role selector.

**When** Fill in:

**When** Click **Send invite** (or **Add**).

**Then** The member appears in the list with role `MEMBER`.

**When** Verify the member count in the board header updates.

**And** `TEST_CREDENTIALS.user.email` is a member of `Test Board` with role `MEMBER`.


---


## Feature: 20. Board Visibility

**Source:** `specs/tests/20-board-visibility.md`


### Scenario: 20. Board Visibility core flow

**Given** Flow 19 completed. On `Test Board` as admin.

**And** Board view.

**When** Open board settings (click **⋮** → **Settings** or the visibility badge in the board header, e.g. `Workspace`).

**Then** Visibility selector shows current value `Workspace`.

**When** Change visibility to **Private**.

**Then** The board visibility badge updates to `Private`. Non-members would no longer see this board.

**When** Confirm the change is saved (page reload or API):

**Then** Response `data.visibility === "private"`.

**When** Change visibility back to **Workspace**.

**Then** Badge updates to `Workspace`.

**And** Board visibility has been tested for `Workspace`, `Private`, and reverted to `Workspace`.


---


## Feature: 21. Board Member Roles

**Source:** `specs/tests/21-board-member-roles.md`


### Scenario: 21. Board Member Roles core flow

**Given** Flow 19 completed. `TEST_CREDENTIALS.user.email` is a `MEMBER` of `Test Board`.

**And** Board view (Members panel).

**When** Open the **Members** panel on the board.

**Then** Panel shows admin (`ADMIN`) and the invited user (`MEMBER`).

**When** Click the role badge next to `TEST_CREDENTIALS.user.email`.

**Then** A role dropdown appears with options: `ADMIN`, `MEMBER`, `VIEWER`.

**When** Select **VIEWER**.

**Then** Role badge updates to `VIEWER`.

**When** Log out and log in as `TEST_CREDENTIALS.user.email` / `TEST_CREDENTIALS.user.password`.

**When** Navigate to `Test Board` (`{TEST_CREDENTIALS.baseUrl}/boards/$boardId`).

**Then** Board is visible. The `Add a card` button is hidden or disabled (VIEWER cannot create cards).

**When** Log out and log back in as `TEST_CREDENTIALS.admin.email` / `TEST_CREDENTIALS.admin.password`.

**When** Open the Members panel and change the user's role back to **MEMBER**.

**Then** Role badge shows `MEMBER`.

**And** User's role has been changed to `VIEWER` and back to `MEMBER`.


---


## Feature: 22. Guest Access Control

**Source:** `specs/tests/22-guest-access.md`


### Scenario: 22. Guest Access Control core flow

**Given** Flow 21 completed. Logged in as admin.

**And** Board view.

**When** Open the **Members** panel and click **Invite member**.

**When** Enter `TEST_CREDENTIALS.guest.email` with role **VIEWER** (guest) and send.

**Then** Guest appears in the member list with `VIEWER` role.

**When** Log out. Log in as `TEST_CREDENTIALS.guest.email` / `TEST_CREDENTIALS.guest.password`.

**When** Navigate to `Test Board` (`{TEST_CREDENTIALS.baseUrl}/boards/$boardId`).

**Then** Board is visible in read-only mode.

**When** Verify the guest **cannot**:

**When** Verify the guest **can**:

**When** Log out. Log in as `TEST_CREDENTIALS.admin.email` / `TEST_CREDENTIALS.admin.password`.

**When** Open the Members panel, find the guest user, and click **Remove** (or set role to remove access).

**Then** Guest no longer appears in the member list.

**And** Guest user access verified; logged back in as admin.


---


## Feature: 23. Search

**Source:** `specs/tests/23-search.md`


### Scenario: 23. Search core flow

**Given** Flow 08 (Add Cards) completed. `Test Card 1` and `Test Card 2` exist.

**And** Board view (logged in as admin).

**When** Press **Cmd+K** (macOS) / **Ctrl+K** (Windows/Linux) or click the Search icon in the sidebar.

**Then** Command palette / search dialog opens with an empty input.

**When** Type `Test Card`.

**Then** Results appear showing both `Test Card 1` and `Test Card 2` under a **Cards** section.

**When** Click on `Test Card 1` in the results.

**Then** Card detail modal opens for `Test Card 1`.

**When** Close the modal.

**When** Open search again. Switch to the **Boards** tab (or filter by type = Board).

**When** Type `Test Board`.

**Then** `Test Board` appears in results.

**When** Click it.

**Then** Navigated to `Test Board`.

**When** Open search. Type a partial string like `Test`.

**Then** Results span both cards and boards.

**When** Apply the **Cards only** filter.

**Then** Only card results remain.

**When** Type a string that matches nothing, e.g. `xyzxyznonexistent`.

**Then** Empty state message appears (e.g. `No results found`).

**And** Search has been used to find cards and boards; filters have been applied.


---


## Feature: 24. Board Views — Table

**Source:** `specs/tests/24-board-views-table.md`


### Scenario: 24. Board Views — Table core flow

**Given** Flow 08 (Add Cards) completed. On `Test Board`.

**And** Board (kanban) view.

**When** Locate the view switcher in the board header (icons for Kanban, Table, Calendar, Timeline).

**When** Click the **Table** view icon.

**Then** Board switches to a table layout. Cards appear as rows with columns: `Title`, `List`, `Members`, `Labels`, `Due Date`, `Start Date`, `Value`.

**When** Verify `Test Card 1` and `Test Card 2` appear as rows.

**When** Verify column headers match the expected labels.

**When** Click a column header (e.g. `Due Date`) to sort.

**Then** Rows reorder. Clicking again reverses sort. Clicking a third time clears sort.

**When** Click the card title `Test Card 1` in the table row.

**Then** Card detail modal opens for `Test Card 1`.

**When** Close the modal.

**When** Verify the empty state message if all cards are archived (not applicable here — just confirm rows are present).

**And** Table view verified; card opened from table. Returned to kanban view.


---


## Feature: 25. Board Views — Calendar

**Source:** `specs/tests/25-board-views-calendar.md`


### Scenario: 25. Board Views — Calendar core flow

**Given** Flow 11 (Labels, Due Dates) completed. `Test Card 1` has a due date.

**And** Board view (any view).

**When** Click the **Calendar** view icon in the board header view switcher.

**Then** Board switches to a monthly calendar layout for the current month.

**When** Find the due date of `Test Card 1` on the calendar.

**Then** A card chip for `Test Card 1` is visible on its due date cell.

**When** Click the card chip.

**Then** Card detail modal opens for `Test Card 1`.

**When** Close the modal.

**When** Click the **next month** navigation arrow (→).

**Then** Calendar advances to the next month. Cards with due dates in that month appear.

**When** Click the **previous month** arrow (←) to return.

**Then** Calendar returns to the current month.

**When** Verify the **No due date** note or unscheduled section — `Test Card 2` (which has no due date) should appear there or be absent from the calendar grid.

**And** Calendar view verified; month navigation confirmed. Returned to kanban.


---


## Feature: 26. Board Views — Timeline

**Source:** `specs/tests/26-board-views-timeline.md`


### Scenario: 26. Board Views — Timeline core flow

**Given** Flow 11 completed. `Test Card 1` has start and due dates.

**And** Board view (any view).

**When** Click the **Timeline** view icon in the board header view switcher.

**Then** Board switches to a horizontal timeline (Gantt-style) layout.

**When** Verify `Test Card 1` appears as a bar between its start and due dates.

**When** Verify `Test Card 2` (no dates) appears in an **Unscheduled** row at the bottom.

**When** Click the **Today** button in the toolbar.

**Then** Timeline scrolls so today's date is visible in the viewport.

**When** Click the **Month** zoom button.

**Then** Timeline zooms to monthly view.

**When** Click the **Week** zoom button.

**Then** Timeline zooms to weekly view.

**When** Click the **Day** zoom button.

**Then** Timeline zooms to daily view.

**When** Drag the right edge (resize handle) of the `Test Card 1` bar to extend the due date by 2 days.

**Then** Due date updates on the card. Bar extends visually.

**When** Switch back to **Kanban** view.

**Then** Board shows lists and cards as before.

**And** Timeline view verified; zoom controls used; returned to kanban view.


---


## Feature: 27. Custom Fields

**Source:** `specs/tests/27-custom-fields.md`


### Scenario: 27. Custom Fields core flow

**Given** Flow 06 (Create Board) completed. On `Test Board` in Kanban view.

**And** Board view.

**When** Open the **Custom Fields** panel (board sidebar or **⋮** → **Custom Fields**).

**Then** Panel opens with the heading `Custom Fields` and an empty state `No custom fields yet`.

**When** Click **+ Add custom field**.

**Then** A form appears prompting field type and name.

**When** Select type **Text** and name it `Notes`, then save.

**Then** `Notes` text field appears in the list.

**When** Click **+ Add custom field** again. Select type **Number**, name it `Story Points`, save.

**Then** `Story Points` field appears in the list.

**When** Click **+ Add custom field** again. Select type **Checkbox**, name it `Blocked?`, save.

**Then** `Blocked?` field appears in the list.

**When** Click on `Test Card 1` to open its detail modal.

**Then** Custom Fields section is visible in the modal with all three fields.

**When** Click the `Notes` field. Enter `This card needs review.` and save.

**Then** Text appears under the `Notes` field.

**When** Click the `Story Points` field. Enter `5` and save.

**Then** Number `5` appears under `Story Points`.

**When** Toggle the `Blocked?` checkbox to checked.

**Then** Checkbox shows a checked state.

**When** Close the modal. Switch to **Table** view.

**Then** Custom field columns (`Notes`, `Story Points`, `Blocked?`) appear. `Test Card 1` row shows the values entered.

**When** Switch back to **Kanban** view.

**And** Three custom fields created (Text, Number, Checkbox). Values set on `Test Card 1`.


---


## Feature: 28. Notifications

**Source:** `specs/tests/28-notifications.md`


### Scenario: 28. Notifications core flow

**Given** Flow 13 (Comments & Mentions) completed. A mention notification was triggered.

**And** Any page, logged in as admin.

**When** Look at the notification bell icon in the top bar.

**Then** A red badge or count indicator shows at least `1` unread notification (from the mention in flow 13).

**When** The bell aria-label should read something like `Notifications — 1 unread`.

**When** Click the notification bell.

**Then** Notification panel/dropdown opens with the heading `Notifications`.

**When** Locate the mention notification (e.g. `Admin User mentioned you in Test Card 1`).

**Then** Notification item is visible and unread (bold or highlighted).

**When** Click the notification.

**Then** Panel closes and the card detail modal for `Test Card 1` opens (or the app navigates to that card).

**When** Reopen the notification panel.

**When** Click **Mark all as read**.

**Then** All notifications are dimmed / marked read. The bell badge clears.

**When** Verify the bell icon shows no badge.

**When** If no more unread notifications exist, verify the empty state message (e.g. `You have no notifications`) is present after all are read.

**And** Notification read, all notifications marked as read, bell badge cleared.


---


## Feature: 29. Notification Preferences

**Source:** `specs/tests/29-notification-preferences.md`


### Scenario: 29. Notification Preferences core flow

**Given** Flow 03 (Login) completed. Logged in as admin.

**And** Any page.

**When** Navigate to profile settings or notification settings page (e.g. `{TEST_CREDENTIALS.baseUrl}/profile` or via avatar menu → **Notification Preferences**).

**Then** A table of notification types with toggles for **In-App** and **Email** columns.

**When** Verify column headers: `Notification`, `In-App`, `Email`.

**When** Find the **Card assigned** row. Toggle the **Email** column off.

**Then** Toggle switches to off. Change is saved (no page reload required).

**When** Toggle **Email** for **Card assigned** back on.

**Then** Toggle is on again.

**When** Navigate to `Test Board`.

**When** Open board notification settings (bell icon or **⋮** → **Notification preference**).

**Then** Options appear: `All activity`, `Only mentions`, `Nothing` (or similar).

**When** Select **Only mentions**.

**Then** Preference is saved. Confirmation or visual update shown.

**When** Select **All activity** to restore default.

**And** Notification preferences verified and set back to defaults.


---


## Feature: 30. Realtime Updates & Presence

**Source:** `specs/tests/30-realtime-updates.md`


### Scenario: 30. Realtime Updates & Presence core flow

**Given** Flow 08 (Add Cards) completed. `Test Board` has cards.

**And** Any page. Requires two browser sessions/tabs.

**When** Open `Test Board` in **Tab A** (`{TEST_CREDENTIALS.baseUrl}/boards/$boardId`).

**Then** Board displays lists and cards.

**When** Open a new browser tab (**Tab B**) and navigate to the same board URL.

**Then** Board loads in Tab B. Both tabs are on the same board.

**When** In **Tab A**, look at the board header for presence avatars (active members list).

**Then** At least `1` avatar visible (the current user from Tab B joining updates Tab A's presence).

**When** In **Tab B**, add a new card to the `To Do` list: type `Realtime Card` and confirm.

**Then** Card `Realtime Card` appears in Tab B immediately.

**When** Switch to **Tab A** without refreshing.

**Then** `Realtime Card` appears in the `To Do` list in **Tab A** automatically (no page reload).

**When** In **Tab B**, drag `Realtime Card` to `In Progress`.

**When** Switch to **Tab A**.

**Then** `Realtime Card` is in `In Progress` in Tab A (real-time update).

**When** In **Tab A**, simulate a temporary disconnect by toggling the browser's network offline (DevTools → Network → Offline) for 3 seconds, then back online.

**Then** A reconnecting or offline badge briefly appears. Once online, the connection badge returns to **Live** and the board is up-to-date.

**And** Real-time card addition verified across tabs; presence avatars observed.


---


## Feature: 31. Offline Draft Recovery

**Source:** `specs/tests/31-offline-drafts.md`


### Scenario: 31. Offline Draft Recovery core flow

**Given** Flow 10 (Edit Card Description). `Test Card 1` has a description.

**And** Board view.

**When** Click on `Test Card 1` to open the card detail modal.

**When** Click the description area to activate the editor.

**When** Select all existing text and replace it with:

**When** Enable browser offline mode: DevTools → Network → check **Offline**.

**When** Attempt to save the description (click Save or press the save shortcut).

**Then** A banner or indicator appears: e.g. `Draft saved` or `You are offline. Changes will sync when you reconnect.`

**When** Disable offline mode: DevTools → Network → uncheck **Offline**.

**Then** Connection is restored. A prompt or banner appears offering to **Restore draft** or an automatic sync indicator shows `Syncing…` → `Saved`.

**When** If a **Restore draft** button appears, click it.

**Then** The editor shows `Draft description written while offline.`

**When** Save the description.

**Then** Description is persisted. Reload the card to confirm.

**When** Open the description editor again, start typing `Discarded text`.

**When** Go offline (DevTools).

**When** Return online without saving, then click **Discard** (if prompted).

**Then** Draft is discarded. Editor shows the last saved description.

**And** Offline draft is saved and successfully restored after connection returns.


---


## Feature: 32. Plugin Discovery & Board Enable

**Source:** `specs/tests/32-plugins.md`


### Scenario: 32. Plugin Discovery & Board Enable core flow

**Given** Flow 06 (Create Board) completed. Logged in as admin.

**And** Any page.

**When** Navigate to **Plugins** via the sidebar or `{TEST_CREDENTIALS.baseUrl}/plugins`.

**Then** Plugin marketplace / registry page loads with heading `Plugins` and a `Browse Plugins` section.

**When** Use the search input (placeholder `Search plugins…`) to type a partial name.

**Then** Plugin list filters in real time.

**When** Clear the search. Verify the category dropdown is functional.

**When** Confirm an empty search match shows the message `No plugins match your search.` with a **Clear search** option.

**When** Navigate to `Test Board`.

**When** Open the **Plugins** panel from the board sidebar (or **⋮** → **Plugins** / **Power-Ups**).

**Then** A list of available plugins is shown with **Enable** buttons.

**When** Click **Enable** on any available plugin.

**Then** Button changes to `Enabling…` briefly, then `Disable`. Plugin appears in the board sidebar or toolbar.

**When** Click **Disable** on the same plugin.

**Then** Button changes back to `Enable`. Plugin is removed from the board.

**And** A plugin is enabled on `Test Board`. Plugin panel visible in board sidebar.


---


## Feature: 33. Admin Plugin Registry

**Source:** `specs/tests/33-admin-plugin-registry.md`


### Scenario: 33. Admin Plugin Registry core flow

**Given** Flow 03 (Login) completed. Logged in as admin.

**And** Plugins page (`{TEST_CREDENTIALS.baseUrl}/plugins`).

**When** On the Plugins page, click **Register Plugin** (admin-only button).

**Then** A modal dialog opens with fields: Name, Slug, Description, Connector URL, Allowed Domains.

**When** Fill in:

**When** Click **Register Plugin** in the modal.

**Then** Plugin is registered and appears in the plugin list. Button briefly shows `Registering…`.

**When** Find `Test Plugin` in the list. Click the settings/edit icon.

**Then** An **Edit Plugin** modal opens.

**When** Click the **API Key** or **Reveal API Key** option.

**Then** A modal shows `Plugin API Key` with the key value.

**When** Click **Copy**.

**Then** `✓ Copied` feedback appears.

**When** Click **I've saved the key — Done** to close.

**When** Open the edit modal for `Test Plugin` again.

**When** Change the Description to `Updated description.` and click **Save Changes**.

**Then** Modal closes; plugin shows updated description.

**When** Open the edit modal and click **Delete Plugin**.

**Then** A confirmation dialog appears.

**When** Confirm deletion.

**Then** Plugin is removed from the list.

**And** A plugin is registered, its API key revealed, edited, and deleted.


---


## Feature: 34. API Token Settings

**Source:** `specs/tests/34-api-tokens.md`


### Scenario: 34. API Token Settings core flow

**Given** Flow 03 (Login) completed. Logged in as admin.

**And** Any page.

**When** Open profile/account settings and navigate to the **API Tokens** section (or `{TEST_CREDENTIALS.baseUrl}/settings/api-tokens`).

**Then** API Tokens page loads. Existing tokens (if any) are listed. A **Create token** button is visible.

**When** Click **Create token** (or **Generate new token**).

**Then** A form or dialog appears asking for a token name.

**When** Enter the name `Test Token` and confirm.

**Then** The new token value is shown **once** in a reveal dialog or inline. A **Copy** button is present.

**When** Click **Copy**.

**Then** Token value is copied to clipboard. Confirm the copy with a brief `Copied!` indicator.

**When** Dismiss the reveal dialog.

**Then** `Test Token` appears in the tokens list with a masked value and creation date. Full token is no longer visible.

**When** Make an authenticated API call using the copied token:

**Then** `200 OK` with workspace data (token is valid).

**When** In the tokens list, click **Revoke** (or **Delete**) next to `Test Token`.

**Then** Confirmation prompt appears.

**When** Confirm revocation.

**Then** `Test Token` removed from the list.

**When** Repeat the API call from step 6 with the same token.

**Then** `401 Unauthorized` (token is no longer valid).

**And** An API token created, copied, and revoked.


---


## Feature: 35. Admin — Invite External User

**Source:** `specs/tests/35-admin-invite-user.md`


### Scenario: 35. Admin — Invite External User core flow

**Given** Flow 03 (Login) completed. Logged in as admin.

**And** Any page.

**When** Click **Invite External User** in the sidebar (or `{TEST_CREDENTIALS.baseUrl}/admin/invite`).

**Then** A modal opens with title `Invite External User` and description `Create an account for…`.

**When** Verify the close button (✕) is present.

**When** Fill in:

**When** Select password mode **Generate automatically**.

**Then** Password field is hidden; the system will generate a password.

**When** Ensure the **Send welcome email** toggle is on.

**When** Ensure the **Auto-verify email** toggle is on.

**When** Click **Create account**.

**Then** Modal transitions to a credential sheet showing:

**When** Click **Copy to clipboard** (or each field's copy button).

**Then** `Copied!` feedback. Clipboard contains the credentials.

**When** Click **Done** to close.

**Then** Modal closes.

**When** API check:

**Then** The new user's email appears in the user list with `verified: true`.

**And** A new external user account created; credential sheet shown and copied.


---


## Feature: 36. Admin — Manual Email Verification

**Source:** `specs/tests/36-admin-email-verification.md`


### Scenario: 36. Admin — Manual Email Verification core flow

**Given** Flow 01 (Sign Up) completed with a user whose email is unverified. Logged in as admin.

**And** Admin users or dashboard.

**When** Navigate to the admin users list (e.g. `{TEST_CREDENTIALS.baseUrl}/admin/users`).

**Then** A table of users is shown.

**When** Find the test user created in flow 01 (`$newUserEmail`) whose email is unverified.

**Then** The row shows an `Unverified` badge or similar indicator.

**When** Click **Verify email** (or the verify action) for that user.

**Then** The badge updates to `Verified`. No page reload required.

**When** Log out. Log in as `$newUserEmail` using the password set during sign-up.

**When** Verify the verification banner is absent from the dashboard.

**Then** User is fully verified and can access all features.

**When** Log out. Log back in as `TEST_CREDENTIALS.admin.email` / `TEST_CREDENTIALS.admin.password`.

**And** Target user's email is verified via the admin UI.


---


## Feature: 37. Forgot Password

**Source:** `specs/tests/37-forgot-password.md`


### Scenario: 37. Forgot Password core flow

**Given** An account exists for `TEST_CREDENTIALS.user.email`.

**And** Logged-out state (log out first if needed).

**When** Log out if currently logged in.

**When** Navigate to `{TEST_CREDENTIALS.baseUrl}` and click **Log in**.

**When** Click **Forgot password?** (below the login form).

**Then** A form appears asking for an email address.

**When** Enter `TEST_CREDENTIALS.user.email` and submit.

**Then** A confirmation message appears: e.g. `Check your email for a password reset link.`

**When** Submit the form again but with `unknown@nonexistent.example.com`.

**Then** The same generic confirmation message (not an error revealing whether the email exists — prevents user enumeration).

**When** Trigger the reset token retrieval via the admin API:

**Then** `200 OK` with `data.token` (the reset token).

**When** Navigate to the reset URL:

**Then** A "Set new password" form appears.

**When** Enter a new password `NewPass1!` in both fields and submit.

**Then** Success message. The app may redirect to the login page.

**When** Log in with `TEST_CREDENTIALS.user.email` and password `NewPass1!`.

**Then** Login succeeds.

**When** Log out. Request another reset for `TEST_CREDENTIALS.user.email`.

**When** Navigate to the reset URL with an expired/invalid token:

**Then** Error message: `This link has expired` or `Invalid reset link`.

**And** Password has been reset; user can log in with the new password.


---


## Feature: 38. Change Email

**Source:** `specs/tests/38-change-email.md`


### Scenario: 38. Change Email core flow

**Given** Flow 03 (Login) completed. Logged in as admin.

**And** Any page.

**When** Navigate to profile settings (`{TEST_CREDENTIALS.baseUrl}/profile` or avatar → **Settings**).

**When** Find the **Change Email** section.

**When** Enter a new email: `admin-newemail+{timestamp}@example.com` and submit.

**Then** A notice appears: `A verification link has been sent to your new address.` The current email is still active until confirmed.

**When** Try entering `TEST_CREDENTIALS.user.email` (an existing account) as the new email.

**Then** Error message: `This email is already in use.`

**When** Retrieve the verification token via admin API:

**Then** `200 OK` with `data.token`.

**When** Navigate to the email change confirmation URL:

**Then** New email is confirmed. A success message appears.

**When** Verify the new email appears in the profile settings.

**When** Change the email back to `TEST_CREDENTIALS.admin.email` by repeating steps 2–6 with the original email.

**Then** Admin email is restored.

**And** Admin's email change flow verified; email reverted to original.


---


## Feature: TEST_CREDENTIALS

**Source:** `specs/tests/TEST_CREDENTIALS.md`


### Scenario: TEST_CREDENTIALS core flow


---
