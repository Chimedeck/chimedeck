// tests/e2e/custom-field-values-api.spec.ts
// Playwright E2E tests for custom field value upsert/get/delete API.
// Covers: TEXT, NUMBER, CHECKBOX, DATE, DROPDOWN values, validation, cross-board guard.
// Based on: tests/e2e/custom-field-values-api.md (now deleted)

import { test, expect, type APIRequestContext } from '@playwright/test';
import { BASE_URL, registerAndLogin, createWorkspace, createBoard, createList, createCard } from './_helpers';

async function createField(
  request: APIRequestContext,
  token: string,
  boardId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function upsertValue(
  request: APIRequestContext,
  token: string,
  cardId: string,
  fieldId: string,
  value: unknown,
) {
  return request.put(`${BASE_URL}/api/v1/cards/${cardId}/custom-field-values/${fieldId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { value },
  });
}

test.describe('Custom Field Values API', () => {
  let token: string;
  let boardId: string;
  let cardId: string;
  let textFieldId: string;

  test.beforeAll(async ({ request }) => {
    token = await registerAndLogin(request, 'cfv-api');
    const wsId = await createWorkspace(request, token);
    boardId = await createBoard(request, token, wsId);
    const listId = await createList(request, token, boardId);
    cardId = await createCard(request, token, listId, 'Test Card for Custom Field Values');
    textFieldId = await createField(request, token, boardId, {
      name: 'Notes',
      field_type: 'TEXT',
      show_on_card: true,
      position: 0,
    });
  });

  test('PUT — upsert TEXT value creates new record (201)', async ({ request }) => {
    const res = await upsertValue(request, token, cardId, textFieldId, 'My custom note');
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.value_text).toBe('My custom note');
    expect(body.data.card_id).toBe(cardId);
    expect(body.data.custom_field_id).toBe(textFieldId);
  });

  test('PUT — upsert TEXT value again updates record (200)', async ({ request }) => {
    const res = await upsertValue(request, token, cardId, textFieldId, 'Updated note');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.value_text).toBe('Updated note');
  });

  test('GET — retrieve custom field value directly', async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/v1/cards/${cardId}/custom-field-values/${textFieldId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.value_text).toBe('Updated note');
  });

  test('GET card — includes customFieldValues', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/cards/${cardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const vals = body.includes?.customFieldValues as Array<{ custom_field_id: string; value_text: string }>;
    expect(Array.isArray(vals)).toBe(true);
    const match = vals.find(v => v.custom_field_id === textFieldId);
    expect(match).toBeTruthy();
    expect(match!.value_text).toBe('Updated note');
  });

  test('POST board batch custom-field-values — accepts cardIds in request body', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/custom-field-values`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { cardIds: [cardId] },
    });
    expect(res.status()).toBe(200);
    const body = await res.json() as { data: Array<{ card_id: string; custom_field_id: string; value_text?: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    const value = body.data.find((v) => v.card_id === cardId && v.custom_field_id === textFieldId);
    expect(value).toBeTruthy();
    expect(value?.value_text).toBe('Updated note');
  });

  test('PUT — NUMBER value creates record', async ({ request }) => {
    const numFieldId = await createField(request, token, boardId, {
      name: 'Score',
      field_type: 'NUMBER',
      show_on_card: false,
      position: 1,
    });
    const res = await upsertValue(request, token, cardId, numFieldId, 42);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.value_number).toBe(42);
  });

  test('PUT — NUMBER value wrong type returns 400', async ({ request }) => {
    const numFieldId = await createField(request, token, boardId, {
      name: 'Score2',
      field_type: 'NUMBER',
      show_on_card: false,
      position: 5,
    });
    const res = await upsertValue(request, token, cardId, numFieldId, 'not-a-number');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error?.name).toBe('bad-request');
  });

  test('PUT — CHECKBOX value creates record', async ({ request }) => {
    const cbFieldId = await createField(request, token, boardId, {
      name: 'Done',
      field_type: 'CHECKBOX',
      show_on_card: true,
      position: 2,
    });
    const res = await upsertValue(request, token, cardId, cbFieldId, true);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.value_checkbox).toBe(true);
  });

  test('PUT — CHECKBOX wrong type returns 400', async ({ request }) => {
    const cbFieldId = await createField(request, token, boardId, {
      name: 'Done2',
      field_type: 'CHECKBOX',
      show_on_card: false,
      position: 6,
    });
    const res = await upsertValue(request, token, cardId, cbFieldId, 'yes');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error?.name).toBe('bad-request');
  });

  test('PUT — DATE value creates record', async ({ request }) => {
    const dateFieldId = await createField(request, token, boardId, {
      name: 'Deadline',
      field_type: 'DATE',
      show_on_card: false,
      position: 3,
    });
    const res = await upsertValue(request, token, cardId, dateFieldId, '2026-06-01T00:00:00.000Z');
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.value_date).toBeTruthy();
  });

  test('PUT — DATE invalid value returns 400', async ({ request }) => {
    const dateFieldId = await createField(request, token, boardId, {
      name: 'Deadline2',
      field_type: 'DATE',
      show_on_card: false,
      position: 7,
    });
    const res = await upsertValue(request, token, cardId, dateFieldId, 'not-a-date');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error?.name).toBe('bad-request');
  });

  test('PUT — DROPDOWN value creates record', async ({ request }) => {
    const dropFieldId = await createField(request, token, boardId, {
      name: 'Priority',
      field_type: 'DROPDOWN',
      options: [
        { id: 'opt-high', label: 'High', color: '#ef4444' },
        { id: 'opt-low', label: 'Low', color: '#22c55e' },
      ],
      show_on_card: true,
      position: 4,
    });
    const res = await upsertValue(request, token, cardId, dropFieldId, 'opt-high');
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.value_option_id).toBe('opt-high');
  });

  test('DELETE — removes a custom field value', async ({ request }) => {
    const delRes = await request.delete(
      `${BASE_URL}/api/v1/cards/${cardId}/custom-field-values/${textFieldId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(delRes.status()).toBe(204);

    const getRes = await request.get(
      `${BASE_URL}/api/v1/cards/${cardId}/custom-field-values/${textFieldId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(getRes.status()).toBe(404);
    const body = await getRes.json();
    expect(body.error?.name).toBe('custom-field-value-not-found');
  });

  test('GET card — deleted value not in includes', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/cards/${cardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    const vals = (body.includes?.customFieldValues ?? []) as Array<{ custom_field_id: string }>;
    expect(vals.every(v => v.custom_field_id !== textFieldId)).toBe(true);
  });

  test('PUT — field from different board returns 422', async ({ request }) => {
    const wsId2 = await createWorkspace(request, token);
    const boardId2 = await createBoard(request, token, wsId2);
    const otherFieldId = await createField(request, token, boardId2, {
      name: 'Other Board Field',
      field_type: 'TEXT',
      show_on_card: false,
      position: 0,
    });
    const res = await upsertValue(request, token, cardId, otherFieldId, 'should fail');
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error?.name).toBe('custom-field-board-mismatch');
  });

  test('PUT — unauthenticated request returns 401', async ({ request }) => {
    const res = await request.put(
      `${BASE_URL}/api/v1/cards/${cardId}/custom-field-values/${textFieldId}`,
      { data: { value: 'no auth' } },
    );
    expect(res.status()).toBe(401);
  });
});
