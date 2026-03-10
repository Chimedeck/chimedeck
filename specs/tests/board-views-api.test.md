# Board-Level Views API Tests

Sprint 48 — Board-Level Views API (activity, comments, archived cards)

## Setup

Assumes a running server at `http://localhost:5173` with an authenticated session.
All endpoints require a valid `Authorization: Bearer <token>` header.

---

## Test 1: GET /api/v1/boards/:id/activity — returns paginated activity

**Steps:**
1. Authenticate as a workspace member.
2. GET `/api/v1/boards/:boardId/activity`

**Expected response shape:**
```json
{
  "data": [...],
  "metadata": {
    "cursor": null,
    "hasMore": false
  }
}
```
- `data` is an array (may be empty).
- `metadata.cursor` is `null` or a string.
- `metadata.hasMore` is a boolean.

**Pagination:**
- Add `?limit=5` — response contains at most 5 items.
- If `metadata.hasMore` is `true`, use `?cursor=<metadata.cursor>` to fetch the next page.

---

## Test 2: GET /api/v1/boards/:id/comments — returns paginated board comments

**Steps:**
1. Authenticate as a workspace member.
2. GET `/api/v1/boards/:boardId/comments`

**Expected response shape:**
```json
{
  "data": [...],
  "metadata": {
    "cursor": null,
    "hasMore": false
  }
}
```
- Each item in `data` includes: `id`, `card_id`, `user_id`, `content`, `created_at`, `author_name`, `card_title`.
- Comments from all cards in the board are returned, ordered by `created_at` descending.

**Pagination:**
- Add `?limit=10` — at most 10 comments per page.
- Chain pages using `metadata.cursor`.

---

## Test 3: GET /api/v1/boards/:id/archived-cards — returns all archived cards

**Steps:**
1. Archive a card via `PATCH /api/v1/cards/:cardId/archive`.
2. GET `/api/v1/boards/:boardId/archived-cards`

**Expected response shape:**
```json
{
  "data": [
    {
      "id": "...",
      "list_id": "...",
      "title": "...",
      "archived": true,
      "list_title": "...",
      "updated_at": "..."
    }
  ]
}
```
- `data` is an array; all items have `archived: true`.
- `list_title` is the name of the list the card belongs to.
- No `metadata` (full list, no pagination).

---

## Test 4: Unauthorized access returns 401

**Steps:**
1. GET `/api/v1/boards/:id/activity` without an `Authorization` header.

**Expected:** HTTP 401.

---

## Test 5: Invalid board ID returns 404

**Steps:**
1. GET `/api/v1/boards/nonexistent-board-id/activity` with valid auth.

**Expected:**
```json
{ "name": "board-not-found", "data": { "message": "Board not found" } }
```
HTTP 404.

---

## Playwright MCP Test Script

```ts
// board-views-api.test.ts
import { test, expect } from '@playwright/test';

test('GET /api/v1/boards/:id/activity returns paginated shape', async ({ request }) => {
  // Login and get token
  const loginRes = await request.post('/api/v1/auth/login', {
    data: { email: 'test@example.com', password: 'password' },
  });
  const { data: { token } } = await loginRes.json();

  // Get a board id from workspace boards
  const boardsRes = await request.get('/api/v1/workspaces/TEST_WORKSPACE_ID/boards', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data: boards } = await boardsRes.json();
  const boardId = boards[0].id;

  const res = await request.get(`/api/v1/boards/${boardId}/activity`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.metadata).toHaveProperty('cursor');
  expect(body.metadata).toHaveProperty('hasMore');
});

test('GET /api/v1/boards/:id/comments returns paginated shape', async ({ request }) => {
  const loginRes = await request.post('/api/v1/auth/login', {
    data: { email: 'test@example.com', password: 'password' },
  });
  const { data: { token } } = await loginRes.json();

  const boardsRes = await request.get('/api/v1/workspaces/TEST_WORKSPACE_ID/boards', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data: boards } = await boardsRes.json();
  const boardId = boards[0].id;

  const res = await request.get(`/api/v1/boards/${boardId}/comments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.metadata).toHaveProperty('cursor');
  expect(body.metadata).toHaveProperty('hasMore');
});

test('GET /api/v1/boards/:id/archived-cards returns all archived cards', async ({ request }) => {
  const loginRes = await request.post('/api/v1/auth/login', {
    data: { email: 'test@example.com', password: 'password' },
  });
  const { data: { token } } = await loginRes.json();

  const boardsRes = await request.get('/api/v1/workspaces/TEST_WORKSPACE_ID/boards', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data: boards } = await boardsRes.json();
  const boardId = boards[0].id;

  const res = await request.get(`/api/v1/boards/${boardId}/archived-cards`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.data)).toBe(true);
  for (const card of body.data) {
    expect(card.archived).toBe(true);
  }
});
```
