# Sprint 117 — Attachment Alias PATCH Tests

## Setup

```javascript
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
```

---

## Test: PATCH with valid alias returns 200 and updated alias

```javascript
// 1. Authenticate as a workspace member
const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'member@example.com', password: 'password' }),
});
const { data: { token } } = await loginRes.json();

// 2. Pick an existing attachment id from the fixture board
const listRes = await fetch(`${BASE_URL}/api/v1/cards/FIXTURE_CARD_ID/attachments`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { data: attachments } = await listRes.json();
const attachmentId = attachments[0].id;

// 3. PATCH alias
const patchRes = await fetch(`${BASE_URL}/api/v1/attachments/${attachmentId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ alias: 'My Custom Alias' }),
});
assert.equal(patchRes.status, 200);
const { data: updated } = await patchRes.json();
assert.equal(updated.alias, 'My Custom Alias');
assert.equal(updated.id, attachmentId);
```

---

## Test: PATCH with empty alias returns 400

```javascript
// 1. Authenticate
const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'member@example.com', password: 'password' }),
});
const { data: { token } } = await loginRes.json();

// 2. Obtain an attachment id
const listRes = await fetch(`${BASE_URL}/api/v1/cards/FIXTURE_CARD_ID/attachments`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { data: attachments } = await listRes.json();
const attachmentId = attachments[0].id;

// 3. PATCH with empty string
const patchRes = await fetch(`${BASE_URL}/api/v1/attachments/${attachmentId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ alias: '' }),
});
assert.equal(patchRes.status, 400);
const body = await patchRes.json();
assert.equal(body.name, 'alias-required');
```

---

## Test: PATCH with whitespace-only alias returns 400

```javascript
// 1. Authenticate
const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'member@example.com', password: 'password' }),
});
const { data: { token } } = await loginRes.json();

// 2. Obtain an attachment id
const listRes = await fetch(`${BASE_URL}/api/v1/cards/FIXTURE_CARD_ID/attachments`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { data: attachments } = await listRes.json();
const attachmentId = attachments[0].id;

// 3. PATCH with whitespace only
const patchRes = await fetch(`${BASE_URL}/api/v1/attachments/${attachmentId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ alias: '   ' }),
});
assert.equal(patchRes.status, 400);
const body = await patchRes.json();
assert.equal(body.name, 'alias-required');
```

---

## Test: PATCH unauthenticated returns 401

```javascript
const patchRes = await fetch(`${BASE_URL}/api/v1/attachments/any-id`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ alias: 'Test' }),
});
assert.equal(patchRes.status, 401);
```

---

## Test: List response includes alias field (null when unset)

```javascript
// 1. Authenticate
const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'member@example.com', password: 'password' }),
});
const { data: { token } } = await loginRes.json();

// 2. List attachments — each item must expose an alias field (null if not set)
const listRes = await fetch(`${BASE_URL}/api/v1/cards/FIXTURE_CARD_ID/attachments`, {
  headers: { Authorization: `Bearer ${token}` },
});
assert.equal(listRes.status, 200);
const { data: attachments } = await listRes.json();
assert.ok(Array.isArray(attachments));
for (const attachment of attachments) {
  assert.ok('alias' in attachment, 'attachment must have alias field');
  assert.ok(attachment.alias === null || typeof attachment.alias === 'string');
}
```

---

## Test: PATCH alias over 255 characters returns 400

```javascript
// 1. Authenticate
const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'member@example.com', password: 'password' }),
});
const { data: { token } } = await loginRes.json();

// 2. Obtain an attachment id
const listRes = await fetch(`${BASE_URL}/api/v1/cards/FIXTURE_CARD_ID/attachments`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { data: attachments } = await listRes.json();
const attachmentId = attachments[0].id;

// 3. PATCH with alias exceeding 255 chars
const longAlias = 'a'.repeat(256);
const patchRes = await fetch(`${BASE_URL}/api/v1/attachments/${attachmentId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ alias: longAlias }),
});
assert.equal(patchRes.status, 400);
const body = await patchRes.json();
assert.equal(body.name, 'alias-too-long');
```
