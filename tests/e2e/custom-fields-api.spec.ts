// tests/e2e/custom-fields-api.spec.ts
// Playwright E2E tests for board-scoped custom field definition API.
// Covers: create, list, update, and delete via API.
// Based on: tests/e2e/custom-fields-api.md (now deleted)

import { test, expect, type APIRequestContext } from '@playwright/test';
import { BASE_URL, registerAndLogin, createWorkspace, createBoard } from './_helpers';

async function createCustomField(
  request: APIRequestContext,
  token: string,
  boardId: string,
  payload: Record<string, unknown>,
) {
  return request.post(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  });
}

test.describe('Custom Fields API', () => {
  let token: string;
  let boardId: string;
  let textFieldId: string;
  let dropdownFieldId: string;

  test.beforeAll(async ({ request }) => {
    token = await registerAndLogin(request, 'cf-api');
    const wsId = await createWorkspace(request, token);
    boardId = await createBoard(request, token, wsId);
  });

  test('POST — create a TEXT field', async ({ request }) => {
    const res = await createCustomField(request, token, boardId, {
      name: 'Summary',
      field_type: 'TEXT',
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe('Summary');
    expect(body.data.field_type).toBe('TEXT');
    expect(body.data.id).toBeTruthy();
    expect(body.data.board_id).toBe(boardId);
    expect(body.data.show_on_card).toBe(false);
    textFieldId = body.data.id;
  });

  test('POST — create a DROPDOWN field with options', async ({ request }) => {
    const res = await createCustomField(request, token, boardId, {
      name: 'Priority',
      field_type: 'DROPDOWN',
      options: [
        { id: 'opt-low', label: 'Low', color: '#22c55e' },
        { id: 'opt-high', label: 'High', color: '#ef4444' },
      ],
      show_on_card: true,
      position: 1,
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe('Priority');
    expect(body.data.field_type).toBe('DROPDOWN');
    expect(body.data.show_on_card).toBe(true);
    expect(Array.isArray(body.data.options)).toBe(true);
    expect(body.data.options).toHaveLength(2);
    dropdownFieldId = body.data.id;
  });

  test('POST — create DATE, NUMBER, CHECKBOX fields', async ({ request }) => {
    for (const [name, field_type] of [['Due Date', 'DATE'], ['Story Points', 'NUMBER'], ['Blocked?', 'CHECKBOX']]) {
      const res = await createCustomField(request, token, boardId, { name, field_type });
      expect(res.status()).toBe(201);
    }
  });

  test('GET — list all fields returns at least 5 items', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(5);
    for (const field of body.data) {
      expect(field.id).toBeTruthy();
      expect(field.name).toBeTruthy();
      expect(field.field_type).toBeTruthy();
      expect(field.board_id).toBe(boardId);
    }
  });

  test('PATCH — rename a field', async ({ request }) => {
    const res = await request.patch(
      `${BASE_URL}/api/v1/boards/${boardId}/custom-fields/${textFieldId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: 'Description' },
      },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe('Description');
    expect(body.data.id).toBe(textFieldId);
  });

  test('PATCH — update show_on_card', async ({ request }) => {
    const res = await request.patch(
      `${BASE_URL}/api/v1/boards/${boardId}/custom-fields/${textFieldId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { show_on_card: true },
      },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.show_on_card).toBe(true);
  });

  test('PATCH — update DROPDOWN options', async ({ request }) => {
    const res = await request.patch(
      `${BASE_URL}/api/v1/boards/${boardId}/custom-fields/${dropdownFieldId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          options: [
            { id: 'opt-low', label: 'Low', color: '#22c55e' },
            { id: 'opt-med', label: 'Medium', color: '#f59e0b' },
            { id: 'opt-high', label: 'High', color: '#ef4444' },
          ],
        },
      },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.options).toHaveLength(3);
    expect(body.data.options.some((o: { label: string }) => o.label === 'Medium')).toBe(true);
  });

  test('POST — validation error: missing name', async ({ request }) => {
    const res = await createCustomField(request, token, boardId, { field_type: 'TEXT' });
    expect(res.status()).toBe(400);
  });

  test('POST — validation error: invalid field_type', async ({ request }) => {
    const res = await createCustomField(request, token, boardId, { name: 'X', field_type: 'INVALID' });
    expect(res.status()).toBe(400);
  });

  test('POST — validation error: options not array', async ({ request }) => {
    const res = await createCustomField(request, token, boardId, {
      name: 'X',
      field_type: 'DROPDOWN',
      options: 'not-array',
    });
    expect(res.status()).toBe(400);
  });

  test('PATCH — 404 for unknown field', async ({ request }) => {
    const res = await request.patch(
      `${BASE_URL}/api/v1/boards/${boardId}/custom-fields/00000000-0000-0000-0000-000000000000`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: 'Ghost' },
      },
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error?.name).toBe('custom-field-not-found');
  });

  test('DELETE — removes a field', async ({ request }) => {
    const delRes = await request.delete(
      `${BASE_URL}/api/v1/boards/${boardId}/custom-fields/${textFieldId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(delRes.status()).toBe(204);

    const listRes = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await listRes.json();
    expect(body.data.every((f: { id: string }) => f.id !== textFieldId)).toBe(true);
  });

  test('DELETE — 404 for already-deleted field', async ({ request }) => {
    const res = await request.delete(
      `${BASE_URL}/api/v1/boards/${boardId}/custom-fields/${textFieldId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error?.name).toBe('custom-field-not-found');
  });

  test('Permission guard — non-ADMIN cannot create fields', async ({ request }) => {
    const memberToken = await registerAndLogin(request, 'cf-member');
    const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
      headers: { Authorization: `Bearer ${memberToken}` },
      data: { name: 'Restricted', field_type: 'TEXT' },
    });
    expect(res.status()).toBe(403);
  });
});
