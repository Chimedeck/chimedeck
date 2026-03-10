// Playwright E2E tests for board view preference (Sprint 52)
//
// Covers:
// - User logs in and navigates to a board; verifies the current view preference is loaded (KANBAN by default).
// - User changes the board view (e.g., to TABLE or CALENDAR); verifies the preference is saved and persists after reload.
// - User attempts to access or update view preference without authentication; verifies access is denied.
// - User tries to set an invalid view type; verifies error response.
// - User with access to multiple boards verifies independent view preferences per board.

import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

async function registerAndLogin(request: APIRequestContext, suffix: string): Promise<string> {
  const email = `bv-test-${suffix}-${Date.now()}@example.com`;
  const password = 'TestPassword1!';
  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `BV ${suffix}` },
  });
  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email, password },
  });
  const body = await loginRes.json() as { data: { access_token: string } };
  return body.data.access_token;
}

async function createWorkspace(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `WS-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function createBoard(request: APIRequestContext, token: string, workspaceId: string): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `Board-${Date.now()}`, workspaceId },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

test.describe('Board View Preference API', () => {
  test('User logs in and gets default view preference', async ({ request }) => {
    const token = await registerAndLogin(request, 'default');
    const wsId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, wsId);
    const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/view-preference`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.viewType).toBe('KANBAN');
  });

  test('User changes view and it persists', async ({ request }) => {
    const token = await registerAndLogin(request, 'persist');
    const wsId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, wsId);
    // Change to TABLE
    let res = await request.put(`${BASE_URL}/api/v1/boards/${boardId}/view-preference`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { viewType: 'TABLE' },
    });
    expect(res.status()).toBe(200);
    let body = await res.json();
    expect(body.data.viewType).toBe('TABLE');
    // Reload
    res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/view-preference`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    body = await res.json();
    expect(body.data.viewType).toBe('TABLE');
  });

  test('Access denied without authentication', async ({ request }) => {
    // Try GET
    const res = await request.get(`${BASE_URL}/api/v1/boards/board123/view-preference`);
    expect(res.status()).toBe(401);
    // Try PUT
    const res2 = await request.put(`${BASE_URL}/api/v1/boards/board123/view-preference`, {
      data: { viewType: 'KANBAN' },
    });
    expect(res2.status()).toBe(401);
  });

  test('Invalid view type returns error', async ({ request }) => {
    const token = await registerAndLogin(request, 'invalid');
    const wsId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, wsId);
    const res = await request.put(`${BASE_URL}/api/v1/boards/${boardId}/view-preference`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { viewType: 'NOT_A_VIEW' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.name).toBe('invalid-view-type');
  });

  test('Multiple boards have independent preferences', async ({ request }) => {
    const token = await registerAndLogin(request, 'multi');
    const wsId = await createWorkspace(request, token);
    const boardA = await createBoard(request, token, wsId);
    const boardB = await createBoard(request, token, wsId);
    // Set boardA to CALENDAR
    await request.put(`${BASE_URL}/api/v1/boards/${boardA}/view-preference`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { viewType: 'CALENDAR' },
    });
    // Set boardB to TIMELINE
    await request.put(`${BASE_URL}/api/v1/boards/${boardB}/view-preference`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { viewType: 'TIMELINE' },
    });
    // Check boardA
    let res = await request.get(`${BASE_URL}/api/v1/boards/${boardA}/view-preference`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let body = await res.json();
    expect(body.data.viewType).toBe('CALENDAR');
    // Check boardB
    res = await request.get(`${BASE_URL}/api/v1/boards/${boardB}/view-preference`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    body = await res.json();
    expect(body.data.viewType).toBe('TIMELINE');
  });
});
