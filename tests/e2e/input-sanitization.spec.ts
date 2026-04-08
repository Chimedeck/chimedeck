// tests/e2e/input-sanitization.spec.ts
// Playwright E2E tests for input sanitization (XSS prevention).
// All tests use the API directly — sanitization happens server-side.
// Covered fields: card title, card description, board title, board description,
//                 list name, comment content, custom-field value_text.
// Based on: tests/e2e/input-sanitization.md (now deleted)

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndLogin, createWorkspace, createBoard, createList, createCard } from './_helpers';

test.describe('Input Sanitization — XSS Prevention', () => {
  let token: string;
  let boardId: string;
  let listId: string;
  let cardId: string;

  test.beforeAll(async ({ request }) => {
    token = await registerAndLogin(request, 'sanitize');
    const wsId = await createWorkspace(request, token);
    boardId = await createBoard(request, token, wsId);
    listId = await createList(request, token, boardId);
    cardId = await createCard(request, token, listId, 'Sanitize Base Card');
  });

  test('Test 1 — XSS payload in card title is stripped to plain text', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/lists/${listId}/cards`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "<script>alert('xss')</script>Hello" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    const cid = body.data.id;

    const getRes = await request.get(`${BASE_URL}/api/v1/cards/${cid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getBody = await getRes.json();
    expect(getBody.data.title).toBe('Hello');
    expect(getBody.data.title).not.toContain('<script>');
  });

  test('Test 2 — HTML injection in card title is stripped', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/lists/${listId}/cards`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: '<img src=x onerror=alert(1)>Safe Title' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    const cid = body.data.id;

    const getRes = await request.get(`${BASE_URL}/api/v1/cards/${cid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getBody = await getRes.json();
    expect(getBody.data.title).toBe('Safe Title');
    expect(getBody.data.title).not.toContain('<img');
  });

  test('Test 3 — XSS in card description stripped; safe Markdown HTML preserved', async ({ request }) => {
    const res = await request.patch(`${BASE_URL}/api/v1/cards/${cardId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { description: "<p>Hello <strong>world</strong></p><script>alert('xss')</script>" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.description).toContain('<p>Hello <strong>world</strong></p>');
    expect(body.data.description).not.toContain('<script>');
  });

  test('Test 4 — javascript: href in description link is stripped', async ({ request }) => {
    const res = await request.patch(`${BASE_URL}/api/v1/cards/${cardId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { description: '<a href="javascript:alert(1)">Click me</a>' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.description).not.toContain('javascript:');
  });

  test('Test 5 — XSS payload in board name is stripped', async ({ request }) => {
    const wsId = await createWorkspace(request, token);
    const res = await request.post(`${BASE_URL}/api/v1/workspaces/${wsId}/boards`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: '<b>Malicious</b> Board' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe('Malicious Board');
    expect(body.data.title).not.toContain('<b>');
  });

  test('Test 6 — Board description: safe HTML preserved, script stripped', async ({ request }) => {
    const res = await request.patch(`${BASE_URL}/api/v1/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { description: '<p>Team <em>planning</em> board</p><script>xss()</script>' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.description).toContain('<p>Team <em>planning</em> board</p>');
    expect(body.data.description).not.toContain('<script>');
  });

  test('Test 7 — XSS payload in list name is stripped', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: '<script>xss()</script>Backlog', position: 99 },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.name ?? body.data.title).toBe('Backlog');
    expect((body.data.name ?? body.data.title) as string).not.toContain('<script>');
  });

  test('Test 8 — XSS payload in list name update is stripped', async ({ request }) => {
    const res = await request.patch(`${BASE_URL}/api/v1/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: '<img src=x onerror=alert(1)>Sprint 1' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const name = body.data.name ?? body.data.title;
    expect(name).toBe('Sprint 1');
  });

  test('Test 9 — XSS in comment content stripped; safe Markdown preserved', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/cards/${cardId}/comments`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { content: '<strong>Note:</strong> <script>steal(document.cookie)</script>Done' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.content).toContain('<strong>Note:</strong>');
    expect(body.data.content).not.toContain('<script>');
    expect(body.data.content).toContain('Done');
  });

  test('Test 10 — XSS payload in custom field value_text is stripped', async ({ request }) => {
    // Create a TEXT custom field first
    const cfRes = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Sanitize Field', field_type: 'TEXT' },
    });
    if (cfRes.status() !== 201) {
      test.skip(true, 'Could not create custom field — skipping value_text sanitization test');
      return;
    }
    const cfBody = await cfRes.json();
    const fieldId = cfBody.data.id;

    const putRes = await request.put(
      `${BASE_URL}/api/v1/cards/${cardId}/custom-field-values/${fieldId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { value_text: "<script>alert('xss')</script>Notes here" },
      },
    );
    expect([200, 201]).toContain(putRes.status());

    const getRes = await request.get(
      `${BASE_URL}/api/v1/cards/${cardId}/custom-field-values/${fieldId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const getBody = await getRes.json();
    expect(getBody.data.value_text).toBe('Notes here');
    expect(getBody.data.value_text).not.toContain('<script>');
  });

  test('Test 11 — Normal plain text input is stored unchanged', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/lists/${listId}/cards`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'My Plain Title', description: 'Some notes.' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe('My Plain Title');
    // description may be returned inline on creation or require a separate GET
    if (body.data.description !== undefined) {
      expect(body.data.description).toBe('Some notes.');
    }
  });
});
