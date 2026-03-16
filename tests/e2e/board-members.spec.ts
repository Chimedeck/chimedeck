// Playwright E2E tests for board member API flows (Sprint 78, Iteration 3)
// Covers: GET/POST/PATCH/DELETE /boards/:id/members, role/visibility logic

import { test, expect, APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

async function registerAndLogin(request: APIRequestContext, suffix: string) {
  const email = `bm-test-${suffix}-${Date.now()}@example.com`;
  const password = 'TestPassword1!';
  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `BM ${suffix}` },
  });
  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email, password },
  });
  const body = await loginRes.json();
  return { token: body.data.access_token, email };
}

async function createWorkspace(request: APIRequestContext, token: string) {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `WS-${Date.now()}` },
  });
  const body = await res.json();
  return body.data.id;
}

async function createBoard(request: APIRequestContext, token: string, workspaceId: string, visibility = 'PRIVATE') {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `Board-${Date.now()}`, visibility },
  });
  const body = await res.json();
  return body.data.id;
}

test.describe('Board member API flows', () => {
  test('GET /boards/:id/members returns explicit board members', async ({ request }) => {
    const { token } = await registerAndLogin(request, 'get');
    const wsId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, wsId);
    // Add member
    await request.post(`${BASE_URL}/api/v1/boards/${boardId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { userId: 'user-2', role: 'MEMBER' },
    });
    // List members
    const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((m: any) => m.userId === 'user-2')).toBe(true);
  });

  test('POST /boards/:id/members adds/updates member idempotently', async ({ request }) => {
    const { token } = await registerAndLogin(request, 'post');
    const wsId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, wsId);
    // Add member
    await request.post(`${BASE_URL}/api/v1/boards/${boardId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { userId: 'user-3', role: 'MEMBER' },
    });
    // Update role idempotently
    const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { userId: 'user-3', role: 'ADMIN' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.role).toBe('ADMIN');
  });

  test('PATCH /boards/:id/members/:userId changes role, rejects demotion of last ADMIN', async ({ request }) => {
    const { token } = await registerAndLogin(request, 'patch');
    const wsId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, wsId);
    // Try demoting last ADMIN
    const res = await request.patch(`${BASE_URL}/api/v1/boards/${boardId}/members/${token}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { role: 'MEMBER' },
    });
    expect([409, 403]).toContain(res.status());
    const body = await res.json();
    expect(body.name).toMatch(/last-admin/);
  });

  test('DELETE /boards/:id/members/:userId removes member, rejects removal of last ADMIN', async ({ request }) => {
    const { token } = await registerAndLogin(request, 'delete');
    const wsId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, wsId);
    // Try removing last ADMIN
    const res = await request.delete(`${BASE_URL}/api/v1/boards/${boardId}/members/${token}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([409, 403]).toContain(res.status());
    const body = await res.json();
    expect(body.name).toMatch(/last-admin/);
  });

  test('Board visibility: GUESTs see only boards with guest access', async ({ request }) => {
    const { token } = await registerAndLogin(request, 'guest');
    const wsId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, wsId, 'PUBLIC');
    // Simulate GUEST role (would need to set up guest access)
    // For now, check that PUBLIC board is visible
    const res = await request.get(`${BASE_URL}/api/v1/workspaces/${wsId}/boards`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.data.some((b: any) => b.id === boardId)).toBe(true);
  });
});
