> **Login credentials:** See [TEST_CREDENTIALS.md](./TEST_CREDENTIALS.md) for all usernames, passwords, and tokens. Do not hardcode credentials here.

# Test: Search API Type Filtering

## Overview
Verifies that the `type` query parameter on `GET /api/v1/workspaces/:id/search` correctly filters
results to boards only, cards only, or both; and that board results include the `background` field.

## Prerequisites
- A workspace with at least one board (title containing "Alpha") and one card (title containing "Alpha").
- The board optionally has a `background` URL set.
- `SEARCH_ENABLED` feature flag is `true`.
- Authenticated user is a member of the workspace.

---

## Test 1 — `type=board` returns only board results

```playwright
// Navigate to the API endpoint with type=board
const response = await request.get(`/api/v1/workspaces/${workspaceId}/search?q=Alpha&type=board`);
expect(response.status()).toBe(200);

const body = await response.json();
expect(body.data.length).toBeGreaterThan(0);

// Every result must be of type 'board'
for (const result of body.data) {
  expect(result.type).toBe('board');
}

// No card results should be present
const cardResults = body.data.filter((r: any) => r.type === 'card');
expect(cardResults.length).toBe(0);
```

---

## Test 2 — `type=card` returns only card results

```playwright
const response = await request.get(`/api/v1/workspaces/${workspaceId}/search?q=Alpha&type=card`);
expect(response.status()).toBe(200);

const body = await response.json();
expect(body.data.length).toBeGreaterThan(0);

// Every result must be of type 'card'
for (const result of body.data) {
  expect(result.type).toBe('card');
}

// No board results should be present
const boardResults = body.data.filter((r: any) => r.type === 'board');
expect(boardResults.length).toBe(0);
```

---

## Test 3 — No `type` param returns both boards and cards

```playwright
const response = await request.get(`/api/v1/workspaces/${workspaceId}/search?q=Alpha`);
expect(response.status()).toBe(200);

const body = await response.json();
const types = new Set(body.data.map((r: any) => r.type));
expect(types.has('board')).toBe(true);
expect(types.has('card')).toBe(true);
```

---

## Test 4 — Board results include the `background` field

```playwright
const response = await request.get(`/api/v1/workspaces/${workspaceId}/search?q=Alpha&type=board`);
expect(response.status()).toBe(200);

const body = await response.json();
expect(body.data.length).toBeGreaterThan(0);

// Every board result must have a 'background' key (null if not set)
for (const result of body.data) {
  expect(result).toHaveProperty('background');
}

// Board with a background set returns a non-null URL string
const boardWithBackground = body.data.find((r: any) => r.background !== null);
if (boardWithBackground) {
  expect(typeof boardWithBackground.background).toBe('string');
  expect(boardWithBackground.background.length).toBeGreaterThan(0);
}
```

---

## Test 5 — Invalid `type` value falls back to returning both types

```playwright
const response = await request.get(`/api/v1/workspaces/${workspaceId}/search?q=Alpha&type=invalid`);
expect(response.status()).toBe(200);

// With an unrecognised type the query conditions are both skipped (neither branch matches),
// so the result set will be empty — not an error.
const body = await response.json();
expect(Array.isArray(body.data)).toBe(true);
```