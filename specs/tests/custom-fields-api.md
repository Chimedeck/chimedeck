# Custom Fields API — E2E Tests

> Playwright MCP markdown tests for board-scoped custom field definition API.
> Covers: create, list, update, and delete via API.

---

## Setup

### Register and authenticate as a workspace admin

- Navigate to `http://localhost:5173`
- If not logged in, go to `/register`
- Fill in name field with `CF Test Admin`
- Fill in email field with `cf-admin@test.local`
- Fill in password field with `Password123!`
- Submit the registration form
- Verify the dashboard page loads

### Create a workspace and board (if needed)

- Navigate to `http://localhost:5173`
- Click "Create workspace" or find the workspace creation button
- Fill in the workspace name with `CF Test Workspace`
- Submit to create the workspace
- Click "Create board" or equivalent
- Fill in board name with `CF Test Board`
- Submit to create the board
- Note the board ID from the URL (format: `/boards/<boardId>`)

---

## Test 1: POST /api/v1/boards/:id/custom-fields — Create a TEXT field

- Send a POST request to `/api/v1/boards/<boardId>/custom-fields` with body:
  ```json
  { "name": "Summary", "field_type": "TEXT" }
  ```
  using credentials for `cf-admin@test.local`
- Verify the response status is `201`
- Verify the response body has `data.name` equal to `"Summary"`
- Verify the response body has `data.field_type` equal to `"TEXT"`
- Verify the response body has a `data.id` field (UUID)
- Verify `data.board_id` matches the board ID
- Verify `data.show_on_card` is `false` by default
- Store the returned field ID as `textFieldId`

---

## Test 2: POST /api/v1/boards/:id/custom-fields — Create a DROPDOWN field with options

- Send a POST request to `/api/v1/boards/<boardId>/custom-fields` with body:
  ```json
  {
    "name": "Priority",
    "field_type": "DROPDOWN",
    "options": [
      { "id": "opt-low", "label": "Low", "color": "#22c55e" },
      { "id": "opt-high", "label": "High", "color": "#ef4444" }
    ],
    "show_on_card": true,
    "position": 1
  }
  ```
- Verify the response status is `201`
- Verify `data.name` equals `"Priority"`
- Verify `data.field_type` equals `"DROPDOWN"`
- Verify `data.show_on_card` is `true`
- Verify `data.options` is an array with 2 items
- Store the returned field ID as `dropdownFieldId`

---

## Test 3: POST /api/v1/boards/:id/custom-fields — Create remaining field types

- Send a POST request with body `{ "name": "Due Date", "field_type": "DATE" }` — verify status `201`
- Send a POST request with body `{ "name": "Story Points", "field_type": "NUMBER" }` — verify status `201`
- Send a POST request with body `{ "name": "Blocked?", "field_type": "CHECKBOX" }` — verify status `201`

---

## Test 4: GET /api/v1/boards/:id/custom-fields — List all fields

- Send a GET request to `/api/v1/boards/<boardId>/custom-fields`
- Verify the response status is `200`
- Verify the response body has a `data` array
- Verify the array contains at least 5 items (TEXT, DROPDOWN, DATE, NUMBER, CHECKBOX fields)
- Verify each item has `id`, `name`, `field_type`, `board_id`, `show_on_card`, `position` fields

---

## Test 5: PATCH /api/v1/boards/:id/custom-fields/:fieldId — Rename a field

- Send a PATCH request to `/api/v1/boards/<boardId>/custom-fields/<textFieldId>` with body:
  ```json
  { "name": "Description" }
  ```
- Verify the response status is `200`
- Verify `data.name` equals `"Description"`
- Verify `data.id` equals `<textFieldId>` (field identity unchanged)

---

## Test 6: PATCH /api/v1/boards/:id/custom-fields/:fieldId — Update show_on_card

- Send a PATCH request to `/api/v1/boards/<boardId>/custom-fields/<textFieldId>` with body:
  ```json
  { "show_on_card": true }
  ```
- Verify the response status is `200`
- Verify `data.show_on_card` is `true`

---

## Test 7: PATCH /api/v1/boards/:id/custom-fields/:fieldId — Update DROPDOWN options

- Send a PATCH request to `/api/v1/boards/<boardId>/custom-fields/<dropdownFieldId>` with body:
  ```json
  {
    "options": [
      { "id": "opt-low", "label": "Low", "color": "#22c55e" },
      { "id": "opt-med", "label": "Medium", "color": "#f59e0b" },
      { "id": "opt-high", "label": "High", "color": "#ef4444" }
    ]
  }
  ```
- Verify the response status is `200`
- Verify `data.options` is an array with 3 items
- Verify one of the options has `label` equal to `"Medium"`

---

## Test 8: POST — Validation errors

- Send a POST request with body `{ "field_type": "TEXT" }` (missing name) — verify status `400`
- Send a POST request with body `{ "name": "X", "field_type": "INVALID" }` — verify status `400`
- Send a POST request with body `{ "name": "X", "field_type": "DROPDOWN", "options": "not-array" }` — verify status `400`

---

## Test 9: PATCH — 404 for unknown field

- Send a PATCH request to `/api/v1/boards/<boardId>/custom-fields/00000000-0000-0000-0000-000000000000` with body `{ "name": "Ghost" }`
- Verify the response status is `404`
- Verify `error.name` equals `"custom-field-not-found"`

---

## Test 10: DELETE /api/v1/boards/:id/custom-fields/:fieldId — Delete a field

- Send a DELETE request to `/api/v1/boards/<boardId>/custom-fields/<textFieldId>`
- Verify the response status is `204`
- Send a GET request to `/api/v1/boards/<boardId>/custom-fields`
- Verify the `data` array no longer contains an item with `id` equal to `<textFieldId>`

---

## Test 11: DELETE — 404 for already-deleted field

- Send a DELETE request to `/api/v1/boards/<boardId>/custom-fields/<textFieldId>` again
- Verify the response status is `404`
- Verify `error.name` equals `"custom-field-not-found"`

---

## Test 12: Permission guard — non-ADMIN cannot create fields

- Register or log in as a MEMBER user (role below ADMIN) for the same workspace
- Send a POST request to `/api/v1/boards/<boardId>/custom-fields` with body `{ "name": "Restricted", "field_type": "TEXT" }` using MEMBER credentials
- Verify the response status is `403`
