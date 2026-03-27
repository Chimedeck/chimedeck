> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Custom Fields Board Panel — E2E Tests

> Playwright MCP markdown tests for the Custom Fields section inside Board Settings UI.
> Covers: opening the panel, creating a custom field, renaming it, toggling show_on_card, and deleting it.

---

## Setup

### Register and authenticate as a workspace admin

- Navigate to `http://localhost:5173`
- If not logged in, go to `/register`
- Fill in name field with `CF UI Admin`
- Fill in email field with `cf-ui-admin@test.local`
- Fill in password field with `Password123!`
- Submit the registration form
- Verify the dashboard page loads

### Create a workspace and board

- Navigate to `http://localhost:5173`
- Click "Create workspace" or find the workspace creation button
- Fill in the workspace name with `CF UI Workspace`
- Submit to create the workspace
- Click "Create board" or equivalent
- Fill in board name with `CF UI Board`
- Submit to create the board
- Verify the board page loads and the URL contains `/boards/`

---

## Test 1: Open Board Settings and verify the Custom Fields section is visible

- On the board page, click the "Board Settings" button (gear icon or "⚙" or the settings button in the board header)
- Verify the Board Settings panel opens (element with aria-label "Board Settings" is visible)
- Verify the section labelled "Custom Fields" is visible inside the panel
- Verify the "+ Add custom field" button is visible
- Verify a message like "No custom fields yet." is displayed (since no fields exist)

---

## Test 2: Create a TEXT custom field

- In the Board Settings panel, click the "+ Add custom field" button
- Verify the new field form appears (element with aria-label "New custom field form")
- Fill in the "Field name" input (aria-label "New field name") with `Priority`
- Ensure the "Field type" select (aria-label "Field type") is set to `TEXT`
- Click the "Create field" button (aria-label "Create custom field")
- Verify the form disappears after creation
- Verify a field item labelled `Priority` appears in the list
- Verify the field type label `Text` is shown next to the field name
- Verify the "Show on card tile" checkbox is unchecked by default

---

## Test 3: Create a DROPDOWN custom field with options

- In the Board Settings panel, click the "+ Add custom field" button
- Fill in the "Field name" input with `Status`
- Change the "Field type" select to `Dropdown`
- Verify the dropdown options editor appears (aria-label "Dropdown options editor")
- Click the "+ Add option" button
- Fill in the first option label input with `To Do`
- Click the "+ Add option" button again
- Fill in the second option label input with `In Progress`
- Click the "Create field" button
- Verify the form disappears
- Verify a field item labelled `Status` appears in the list
- Verify the field type label `Dropdown` is shown next to the field name
- Verify the "▼ Edit options" button is visible for the `Status` field

---

## Test 4: Expand dropdown options for existing field

- In the Board Settings panel, find the `Status` field
- Click the "▼ Edit options" button (aria-label "Edit options for Status")
- Verify the dropdown options editor expands and shows option labels `To Do` and `In Progress`
- Click the "▲ Hide options" button to collapse
- Verify the options editor collapses

---

## Test 5: Rename a custom field

- In the Board Settings panel, find the `Priority` field
- Click on the field name text (aria-label "Rename field Priority")
- Verify an inline rename input appears (aria-label "Rename field")
- Clear the input and type `Urgency`
- Press Enter to confirm the rename
- Verify the field now shows the name `Urgency`
- Verify the rename input is no longer visible

---

## Test 6: Toggle "Show on card tile" for a field

- In the Board Settings panel, find the `Urgency` field
- Check the "Show on card tile" checkbox (aria-label "Show on card tile") to enable it
- Verify the checkbox becomes checked
- Uncheck it again
- Verify the checkbox becomes unchecked

---

## Test 7: Delete a custom field

- In the Board Settings panel, find the `Urgency` field
- Click the delete button (aria-label "Delete field Urgency") — the "✕" button next to the field
- When the confirmation dialog appears, confirm the deletion (click OK)
- Verify the `Urgency` field is no longer listed
- Verify the `Status` field is still present

---

## Test 8: Close the Board Settings panel

- Click outside the Board Settings panel (on the backdrop) or click the "✕" close button
- Verify the Board Settings panel is no longer visible