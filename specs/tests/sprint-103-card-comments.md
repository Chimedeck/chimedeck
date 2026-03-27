> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Sprint 103 — Card Comments Endpoint (API Token Auth)

Test that `POST /api/v1/cards/:id/comments` creates a comment and returns the slim
`{ data: { id, cardId, userId, text, createdAt } }` shape when called with an API token.

## Prerequisites

- User is logged in
- At least one board with a list and a card exists
- A valid API token (`hf_...`) has been generated for the user

---

## Steps

### 1. Log in

1. Navigate to `/login`
2. Enter valid credentials and submit
3. Verify redirect to the workspace/board dashboard

---

### 2. Generate an API token (if not already done)

1. Navigate to `/settings/api-tokens`
2. Click **Generate token**
3. Enter a name (e.g. "test-comments-token") and submit
4. Copy the displayed `hf_...` token — it is shown only once
5. Store it for use in the API calls below

---

### 3. Create a card (if not already present)

1. Open any board and note its ID from the URL (`/boards/<boardId>`)
2. Note the ID of a list on that board
3. Call `POST /api/v1/lists/<listId>/cards` with `Authorization: Bearer <jwt>` and body
   `{ "title": "Comment test card" }` to create a card
4. Note the returned `data.id` as `<cardId>`

---

### 4. POST a comment with the API token

1. Make a `POST` request to `/api/v1/cards/<cardId>/comments` with:
   - Header: `Authorization: Bearer <hf_token>`
   - Body: `{ "text": "Hello from API token!" }`
2. Verify the response status is **201**
3. Verify the response body matches:
   ```json
   {
     "data": {
       "id": "<uuid>",
       "cardId": "<cardId>",
       "userId": "<currentUserId>",
       "text": "Hello from API token!",
       "createdAt": "<iso8601>"
     }
   }
   ```
4. Confirm `id` is a UUID string
5. Confirm `createdAt` is a valid ISO 8601 timestamp

---

### 5. Verify validation — missing text

1. Make a `POST` request to `/api/v1/cards/<cardId>/comments` with:
   - Header: `Authorization: Bearer <hf_token>`
   - Body: `{}`
2. Verify the response status is **400**
3. Verify the response body contains `{ "name": "bad-request" }`

---

### 6. Verify validation — empty text

1. Make a `POST` request to `/api/v1/cards/<cardId>/comments` with:
   - Header: `Authorization: Bearer <hf_token>`
   - Body: `{ "text": "   " }`
2. Verify the response status is **400**
3. Verify the response body contains `{ "name": "bad-request" }`

---

### 7. Verify authentication — invalid token

1. Make a `POST` request to `/api/v1/cards/<cardId>/comments` with:
   - Header: `Authorization: Bearer hf_invalid`
   - Body: `{ "text": "This should fail" }`
2. Verify the response status is **401**

---

### 8. Verify comment appears in UI

1. Navigate to the board containing the card in the browser
2. Open the card modal for `<cardId>`
3. Verify the comment "Hello from API token!" appears in the comment list