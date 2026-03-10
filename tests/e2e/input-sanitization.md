# Input Sanitization — E2E Tests

## Setup

These tests verify that user-supplied input is sanitized before being written to the
database, preventing XSS attacks while preserving safe Markdown content.

Fields covered:
- `sanitizeText`: card titles, board titles/names, list names, custom field value_text
- `sanitizeRichText`: card descriptions, board descriptions, comment content

---

## Test 1: XSS payload in card title is stripped to plain text

### Steps

1. Authenticate as a valid user.
2. Create a card with `title: "<script>alert('xss')</script>Hello"` via
   `POST /api/v1/lists/<list_id>/cards`.
3. Verify the response status is 201.
4. Retrieve the card via `GET /api/v1/cards/<card_id>`.
5. Verify `data.title` equals `"Hello"` (script tag fully stripped).
6. Verify `data.title` does NOT contain `<script>`.

---

## Test 2: HTML injection in card title is stripped

### Steps

1. Authenticate as a valid user.
2. Create a card with `title: "<img src=x onerror=alert(1)>Safe Title"` via
   `POST /api/v1/lists/<list_id>/cards`.
3. Verify the response status is 201.
4. Retrieve the card.
5. Verify `data.title` equals `"Safe Title"` with no HTML tags.

---

## Test 3: XSS payload in card description is stripped but safe Markdown HTML is preserved

### Steps

1. Authenticate as a valid user.
2. Update a card's description via `PATCH /api/v1/cards/<card_id>` with body:
   ```json
   {
     "description": "<p>Hello <strong>world</strong></p><script>alert('xss')</script>"
   }
   ```
3. Verify the response status is 200.
4. Verify `data.description` contains `<p>Hello <strong>world</strong></p>`.
5. Verify `data.description` does NOT contain `<script>`.

---

## Test 4: javascript: href in description link is stripped

### Steps

1. Authenticate as a valid user.
2. Update a card's description with:
   `"<a href=\"javascript:alert(1)\">Click me</a>"`
3. Verify the response returns 200.
4. Verify `data.description` does NOT contain `javascript:`.
5. Verify `data.description` does not render the `href` attribute (it should be stripped
   or the `<a>` tag removed entirely).

---

## Test 5: XSS payload in board name is stripped

### Steps

1. Authenticate as an admin user.
2. Create a board via `POST /api/v1/workspaces/<workspace_id>/boards` with:
   `{ "title": "<b>Malicious</b> Board" }`
3. Verify the response status is 201.
4. Verify `data.title` equals `"Malicious Board"` (HTML tags stripped).

---

## Test 6: Board description with safe HTML is preserved

### Steps

1. Authenticate as an admin user.
2. Patch a board via `PATCH /api/v1/boards/<board_id>` with:
   ```json
   { "description": "<p>Team <em>planning</em> board</p><script>xss()</script>" }
   ```
3. Verify the response status is 200.
4. Verify `data.description` contains `<p>Team <em>planning</em> board</p>`.
5. Verify `data.description` does NOT contain `<script>`.

---

## Test 7: XSS payload in list name is stripped

### Steps

1. Authenticate as a valid user.
2. Create a list via `POST /api/v1/boards/<board_id>/lists` with:
   `{ "title": "<script>xss()</script>Backlog" }`
3. Verify the response status is 201.
4. Verify `data.title` equals `"Backlog"` (script tag stripped).

---

## Test 8: XSS payload in list name update is stripped

### Steps

1. Authenticate as a valid user.
2. Rename a list via `PATCH /api/v1/lists/<list_id>` with:
   `{ "title": "<img src=x onerror=alert(1)>Sprint 1" }`
3. Verify the response status is 200.
4. Verify `data.title` equals `"Sprint 1"`.

---

## Test 9: XSS payload in comment content is stripped but safe Markdown is preserved

### Steps

1. Authenticate as a valid user.
2. Create a comment via `POST /api/v1/cards/<card_id>/comments` with:
   ```json
   { "content": "<strong>Note:</strong> <script>steal(document.cookie)</script>Done" }
   ```
3. Verify the response status is 201.
4. Verify `data.content` contains `<strong>Note:</strong>`.
5. Verify `data.content` does NOT contain `<script>`.
6. Verify `data.content` contains `Done`.

---

## Test 10: XSS payload in custom field value_text is stripped

### Steps

1. Authenticate as a valid user.
2. Upsert a custom field value (TEXT type) via
   `PUT /api/v1/cards/<card_id>/custom-field-values/<field_id>` with:
   `{ "value_text": "<script>alert('xss')</script>Notes here" }`
3. Verify the response status is 200 or 201.
4. Retrieve the value via `GET /api/v1/cards/<card_id>/custom-field-values/<field_id>`.
5. Verify `data.value_text` equals `"Notes here"` (script tag stripped).

---

## Test 11: Normal plain text input is stored unchanged

### Steps

1. Authenticate as a valid user.
2. Create a card with `title: "My Plain Title"` and `description: "Some notes."`.
3. Verify the response status is 201.
4. Verify `data.title` equals `"My Plain Title"`.
5. Verify `data.description` equals `"Some notes."`.
