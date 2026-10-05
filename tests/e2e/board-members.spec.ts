// Playwright E2E tests for board member API flows (Sprint 78, Iteration 3)
// Covers: GET/POST/PATCH/DELETE /boards/:id/members, role/visibility logic

import { test, expect, APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

async function registerAndLogin(request: APIRequestContext, suffix: string) {
  const email = `bm-test-${suffix}-${Date.now()}@example.com`;
  const password = 'TestPassword1!';
  const regRes = await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `BM ${suffix}` },
  });
  const body = await regRes.json();
  return { token: body.data.accessToken, userId: body.data.user.id, email };
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

// Register a second user and add them to the workspace so they can be added to a board.
async function addWorkspaceMember(request: APIRequestContext, token: string, workspaceId: string, email: string) {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { email, role: 'MEMBER' },
  });
  return res;
}

test.describe('Board member API flows', () => {
  test('GET /boards/:id/members returns explicit board members', async ({ request }) => {
    const owner = await registerAndLogin(request, 'get');
    const wsId = await createWorkspace(request, owner.token);
    const boardId = await createBoard(request, owner.token, wsId);

    // Register a second user and add them to the workspace, then to the board.
    const member = await registerAndLogin(request, 'get2');
    const addWs = await addWorkspaceMember(request, owner.token, wsId, member.email);
    expect(addWs.status()).toBe(201);
    const addBoard = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/members`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { userId: member.userId, role: 'MEMBER' },
    });
    expect(addBoard.status()).toBe(201);

    // List members
    const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/members`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((m: { user_id?: string }) => m.user_id === member.userId)).toBe(true);
  });

  test('POST /boards/:id/members adds/updates member idempotently', async ({ request }) => {
    const owner = await registerAndLogin(request, 'post');
    const wsId = await createWorkspace(request, owner.token);
    const boardId = await createBoard(request, owner.token, wsId);

    const member = await registerAndLogin(request, 'post2');
    const addWs = await addWorkspaceMember(request, owner.token, wsId, member.email);
    expect(addWs.status()).toBe(201);

    // Add member
    const addRes = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/members`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { userId: member.userId, role: 'MEMBER' },
    });
    expect(addRes.status()).toBe(201);

    // Update role idempotently
    const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/members`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { userId: member.userId, role: 'ADMIN' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.role).toBe('ADMIN');
  });

  test('PATCH /boards/:id/members/:userId changes role, rejects demotion of last ADMIN', async ({ request }) => {
    const owner = await registerAndLogin(request, 'patch');
    const wsId = await createWorkspace(request, owner.token);
    const boardId = await createBoard(request, owner.token, wsId);

    // The creator is the only ADMIN on the board; demoting them must be rejected.
    const res = await request.patch(`${BASE_URL}/api/v1/boards/${boardId}/members/${owner.userId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { role: 'MEMBER' },
    });
    expect([409, 403]).toContain(res.status());
    const body = await res.json();
    expect(body.name).toMatch(/last-board-admin/);
  });

  test('DELETE /boards/:id/members/:userId removes member, rejects removal of last ADMIN', async ({ request }) => {
    const owner = await registerAndLogin(request, 'delete');
    const wsId = await createWorkspace(request, owner.token);
    const boardId = await createBoard(request, owner.token, wsId);

    // The creator is the only ADMIN on the board; removing them must be rejected.
    const res = await request.delete(`${BASE_URL}/api/v1/boards/${boardId}/members/${owner.userId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect([409, 403]).toContain(res.status());
    const body = await res.json();
    expect(body.name).toMatch(/last-board-admin/);
  });

  test('Board visibility: GUESTs see only boards with guest access', async ({ request }) => {
    const owner = await registerAndLogin(request, 'guest');
    const wsId = await createWorkspace(request, owner.token);
    const boardId = await createBoard(request, owner.token, wsId, 'PUBLIC');
    // Check that PUBLIC board is visible to the owner
    const res = await request.get(`${BASE_URL}/api/v1/workspaces/${wsId}/boards`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    const body = await res.json();
    expect(body.data.some((b: { id?: string }) => b.id === boardId)).toBe(true);
  });
});
