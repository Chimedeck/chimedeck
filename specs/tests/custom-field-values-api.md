# Custom Field Values API — E2E Tests

## Setup

Navigate to the app at `http://localhost:5173`.

Sign in as `admin@example.com` with password `password`.

---

## Test 1: Upsert a TEXT custom field value on a card

### Preconditions

1. Navigate to any existing workspace and board (create one if needed).
2. Using the API, create a custom field on the board:
   - `POST /api/v1/boards/<boardId>/custom-fields`
   - Body: `{ "name": "Notes", "field_type": "TEXT", "show_on_card": true, "position": 0 }`
   - Save the returned `data.id` as `fieldId`.
3. Create a card in any list on the board:
   - `POST /api/v1/lists/<listId>/cards`
   - Body: `{ "title": "Test Card for Custom Field Values" }`
   - Save the returned `data.id` as `cardId`.

### Steps

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<fieldId>` with body:
   ```json
   { "value": "My custom note" }
   ```
2. Verify the response status is `201 Created`.
3. Verify `data.value_text` equals `"My custom note"`.
4. Verify `data.card_id` equals `<cardId>`.
5. Verify `data.custom_field_id` equals `<fieldId>`.

---

## Test 2: Update (upsert) an existing custom field value

### Steps

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<fieldId>` again with body:
   ```json
   { "value": "Updated note" }
   ```
2. Verify the response status is `200 OK`.
3. Verify `data.value_text` equals `"Updated note"`.

---

## Test 3: Retrieve custom field value directly

### Steps

1. Send `GET /api/v1/cards/<cardId>/custom-field-values/<fieldId>`.
2. Verify the response status is `200 OK`.
3. Verify `data.value_text` equals `"Updated note"`.

---

## Test 4: Card GET endpoint includes customFieldValues

### Steps

1. Send `GET /api/v1/cards/<cardId>`.
2. Verify the response status is `200 OK`.
3. Verify `includes.customFieldValues` is an array with at least one item.
4. Verify the first item in `includes.customFieldValues` has `custom_field_id` equal to `<fieldId>` and `value_text` equal to `"Updated note"`.

---

## Test 5: Upsert a NUMBER custom field value

### Preconditions

1. Create another custom field on the same board:
   - `POST /api/v1/boards/<boardId>/custom-fields`
   - Body: `{ "name": "Score", "field_type": "NUMBER", "show_on_card": false, "position": 1 }`
   - Save the returned `data.id` as `numberFieldId`.

### Steps

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<numberFieldId>` with body:
   ```json
   { "value": 42 }
   ```
2. Verify the response status is `201 Created`.
3. Verify `data.value_number` equals `42`.

### Error case — wrong type

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<numberFieldId>` with body:
   ```json
   { "value": "not-a-number" }
   ```
2. Verify the response status is `400 Bad Request`.
3. Verify `error.name` equals `"bad-request"`.

---

## Test 6: Upsert a CHECKBOX custom field value

### Preconditions

1. Create a CHECKBOX custom field on the board:
   - `POST /api/v1/boards/<boardId>/custom-fields`
   - Body: `{ "name": "Done", "field_type": "CHECKBOX", "show_on_card": true, "position": 2 }`
   - Save the returned `data.id` as `checkboxFieldId`.

### Steps

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<checkboxFieldId>` with body:
   ```json
   { "value": true }
   ```
2. Verify the response status is `201 Created`.
3. Verify `data.value_checkbox` equals `true`.

### Error case — wrong type

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<checkboxFieldId>` with body:
   ```json
   { "value": "yes" }
   ```
2. Verify the response status is `400 Bad Request`.
3. Verify `error.name` equals `"bad-request"`.

---

## Test 7: Upsert a DATE custom field value

### Preconditions

1. Create a DATE custom field on the board:
   - `POST /api/v1/boards/<boardId>/custom-fields`
   - Body: `{ "name": "Deadline", "field_type": "DATE", "show_on_card": false, "position": 3 }`
   - Save the returned `data.id` as `dateFieldId`.

### Steps

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<dateFieldId>` with body:
   ```json
   { "value": "2026-06-01T00:00:00.000Z" }
   ```
2. Verify the response status is `201 Created`.
3. Verify `data.value_date` is a non-null timestamp.

### Error case — invalid date

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<dateFieldId>` with body:
   ```json
   { "value": "not-a-date" }
   ```
2. Verify the response status is `400 Bad Request`.
3. Verify `error.name` equals `"bad-request"`.

---

## Test 8: Upsert a DROPDOWN custom field value

### Preconditions

1. Create a DROPDOWN custom field on the board:
   - `POST /api/v1/boards/<boardId>/custom-fields`
   - Body:
     ```json
     {
       "name": "Priority",
       "field_type": "DROPDOWN",
       "options": [
         { "id": "opt-high", "label": "High", "color": "#ef4444" },
         { "id": "opt-low", "label": "Low", "color": "#22c55e" }
       ],
       "show_on_card": true,
       "position": 4
     }
     ```
   - Save the returned `data.id` as `dropdownFieldId`.

### Steps

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<dropdownFieldId>` with body:
   ```json
   { "value": "opt-high" }
   ```
2. Verify the response status is `201 Created`.
3. Verify `data.value_option_id` equals `"opt-high"`.

---

## Test 9: Delete a custom field value

### Steps

1. Send `DELETE /api/v1/cards/<cardId>/custom-field-values/<fieldId>`.
2. Verify the response status is `204 No Content`.

### Verify deletion

1. Send `GET /api/v1/cards/<cardId>/custom-field-values/<fieldId>`.
2. Verify the response status is `404 Not Found`.
3. Verify `error.name` equals `"custom-field-value-not-found"`.

---

## Test 10: Card GET excludes deleted custom field value from includes

### Steps

1. Send `GET /api/v1/cards/<cardId>`.
2. Verify the response status is `200 OK`.
3. Verify `includes.customFieldValues` does not contain an item with `custom_field_id` equal to `<fieldId>`.

---

## Test 11: Field from a different board is rejected

### Preconditions

1. Create a second board on the same workspace.
2. Create a custom field on the second board:
   - `POST /api/v1/boards/<boardId2>/custom-fields`
   - Body: `{ "name": "Other Board Field", "field_type": "TEXT", "show_on_card": false, "position": 0 }`
   - Save the returned `data.id` as `otherFieldId`.

### Steps

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<otherFieldId>` with body:
   ```json
   { "value": "should fail" }
   ```
2. Verify the response status is `422 Unprocessable Entity`.
3. Verify `error.name` equals `"custom-field-board-mismatch"`.

---

## Test 12: Unauthenticated requests are rejected

### Steps

1. Send `PUT /api/v1/cards/<cardId>/custom-field-values/<fieldId>` without an authentication cookie.
2. Verify the response status is `401 Unauthorized`.
