> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Board Background Upload / Delete

## Overview

Tests for `POST /api/v1/boards/:id/background` and `DELETE /api/v1/boards/:id/background`.

---

## Scenario 1 — Upload a valid JPEG background

**Steps:**
1. Log in as an admin user who owns or has ADMIN role on the board.
2. Send `POST /api/v1/boards/:id/background` with `multipart/form-data` body containing a JPEG file in the `background` field.
3. Verify the response.

**Expected:**
- HTTP 200.
- Response body: `{ data: { id, background: "<s3-url>" } }` where `background` is a non-null, non-empty string URL pointing to `board-backgrounds/<boardId>/background.jpg`.
- Subsequent `GET /api/v1/boards/:id` also returns `background` with the same URL.

---

## Scenario 2 — Upload with invalid MIME type (not JPEG/PNG)

**Steps:**
1. Log in as an admin user.
2. Send `POST /api/v1/boards/:id/background` with `multipart/form-data` containing a GIF or PDF file in the `background` field.

**Expected:**
- HTTP 400.
- Response body: `{ name: 'mime-type-not-allowed', data: { mimeType: 'image/gif' } }`.

---

## Scenario 3 — Upload denied for non-admin member

**Steps:**
1. Log in as a workspace MEMBER (not ADMIN/OWNER).
2. Send `POST /api/v1/boards/:id/background` with a valid JPEG.

**Expected:**
- HTTP 403.

---

## Scenario 4 — Delete the background

**Pre-condition:** Board has a background URL set (e.g. from Scenario 1).

**Steps:**
1. Log in as an admin user.
2. Send `DELETE /api/v1/boards/:id/background`.

**Expected:**
- HTTP 200.
- Response body: `{ data: { id, background: null } }`.
- Subsequent `GET /api/v1/boards/:id` returns `background: null`.

---

## Scenario 5 — Delete when no background is set (idempotent)

**Steps:**
1. Log in as an admin user.
2. Ensure `boards.background` is `null`.
3. Send `DELETE /api/v1/boards/:id/background`.

**Expected:**
- HTTP 200.
- Response body: `{ data: { id, background: null } }` — no error.

---

## Scenario 6 — WS event emitted after upload

**Steps:**
1. Connect a WebSocket client to the board room.
2. Admin uploads a background image via `POST /api/v1/boards/:id/background`.
3. Observe incoming WS messages.

**Expected:**
- WS message received: `{ type: 'board.background_changed', payload: { background: '<url>' } }`.

---

## Scenario 7 — WS event emitted after delete

**Steps:**
1. Connect a WebSocket client to the board room.
2. Admin deletes the background via `DELETE /api/v1/boards/:id/background`.
3. Observe incoming WS messages.

**Expected:**
- WS message received: `{ type: 'board.background_changed', payload: { background: null } }`.

---

## Playwright MCP Implementation Notes

```typescript
import { test, expect } from '@playwright/test';

// Scenario 1 — Valid JPEG upload
test('upload valid JPEG background', async ({ request, page }) => {
  // login as admin ...
  const form = new FormData();
  form.append('background', new File([jpegBytes], 'bg.jpg', { type: 'image/jpeg' }));
  const res = await request.post(`/api/v1/boards/${boardId}/background`, { multipart: form });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.background).toMatch(/board-backgrounds\//);
});

// Scenario 2 — Invalid MIME
test('rejects non-JPEG/PNG upload', async ({ request }) => {
  const form = new FormData();
  form.append('background', new File([gifBytes], 'bg.gif', { type: 'image/gif' }));
  const res = await request.post(`/api/v1/boards/${boardId}/background`, { multipart: form });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.name).toBe('mime-type-not-allowed');
});

// Scenario 4 — Delete
test('delete background returns null', async ({ request }) => {
  const res = await request.delete(`/api/v1/boards/${boardId}/background`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.background).toBeNull();
});
```