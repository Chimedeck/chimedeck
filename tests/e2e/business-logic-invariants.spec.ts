// tests/e2e/business-logic-invariants.spec.ts
// Playwright E2E tests for Sprint 56 business logic invariants:
//   1. Archived board mutations are blocked (403 board-is-archived)
//   2. Workspace must always have at least one OWNER (422 workspace-must-have-one-owner)
// Based on: tests/e2e/business-logic-invariants-1.md (now deleted)

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndLogin, registerAndGetCredentials, createWorkspace, createBoard, createList, createCard } from './_helpers';

test.describe('Business Logic Invariants', () => {
  test.describe('Part 1 — Archived Board Read-Only Guard', () => {
    let token: string;
    let boardId: string;
    let listId: string;
    let cardId: string;

    test.beforeAll(async ({ request }) => {
      token = await registerAndLogin(request, 'biz-inv');
      const wsId = await createWorkspace(request, token);
      boardId = await createBoard(request, token, wsId);
      listId = await createList(request, token, boardId);
      cardId = await createCard(request, token, listId, 'Test Card');

      // Archive the board — the archive endpoint is PATCH /boards/:id/archive
      // and toggles ACTIVE <-> ARCHIVED.
      const archiveRes = await request.patch(`${BASE_URL}/api/v1/boards/${boardId}/archive`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(archiveRes.status()).toBeLessThan(300);
    });

    test('PATCH /cards/:id returns 403 board-is-archived', async ({ request }) => {
      const res = await request.patch(`${BASE_URL}/api/v1/cards/${cardId}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { title: 'Should fail' },
      });
      expect(res.status()).toBe(403);
      const body = await res.json();
      const errorCode = body.error?.code ?? body.error?.name ?? body.name;
      expect(errorCode).toBe('board-is-archived');
    });

    test('POST /lists/:listId/cards returns 403 board-is-archived', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/v1/lists/${listId}/cards`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { title: 'New card on archived board' },
      });
      expect(res.status()).toBe(403);
      const body = await res.json();
      const errorCode = body.error?.code ?? body.error?.name ?? body.name;
      expect(errorCode).toBe('board-is-archived');
    });

    test('POST /cards/:id/comments returns 403 board-is-archived', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/v1/cards/${cardId}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { content: 'This should fail' },
      });
      expect(res.status()).toBe(403);
      const body = await res.json();
      const errorCode = body.error?.code ?? body.error?.name ?? body.name;
      expect(errorCode).toBe('board-is-archived');
    });

    test('GET /boards/:boardId/lists still works on archived board (200)', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  test.describe('Part 2 — Workspace ≥1 Owner Invariant', () => {
    let token: string;
    let workspaceId: string;
    let userId: string;

    test.beforeAll(async ({ request }) => {
      token = await registerAndLogin(request, 'ws-owner');
      workspaceId = await createWorkspace(request, token);

      // Fetch the current user id. Fail loudly rather than leaving userId
      // unset, which previously made every test in this block soft-skip and
      // masked the fact that the route was wrong.
      const meRes = await request.get(`${BASE_URL}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.status() !== 200) {
        throw new Error(`GET /api/v1/users/me returned ${meRes.status()}`);
      }
      const meBody = await meRes.json();
      userId = meBody.data?.id ?? meBody.id;
      if (!userId) {
        throw new Error('GET /api/v1/users/me returned no id');
      }
    });

    test('DELETE last owner returns 422 workspace-must-have-one-owner', async ({ request }) => {
      const res = await request.delete(
        `${BASE_URL}/api/v1/workspaces/${workspaceId}/members/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(res.status()).toBe(422);
      const body = await res.json();
      const errorCode = body.error?.code ?? body.error?.name ?? body.name;
      expect(errorCode).toBe('workspace-must-have-one-owner');
    });

    test('PATCH role change for last owner returns 422', async ({ request }) => {
      const res = await request.patch(
        `${BASE_URL}/api/v1/workspaces/${workspaceId}/members/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { role: 'ADMIN' },
        },
      );
      expect(res.status()).toBe(422);
      const body = await res.json();
      const errorCode = body.error?.code ?? body.error?.name ?? body.name;
      expect(errorCode).toBe('workspace-must-have-one-owner');
    });

    test('Role change succeeds when a second OWNER is promoted first', async ({ request }) => {

      // Register a second user. POST /workspaces/:id/members adds an existing
      // user by email (not id), so we need the credentials, not just a token.
      const secondCreds = await registerAndGetCredentials(request, 'ws-owner2');

      // Promote the second user to OWNER.
      const inviteRes = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { email: secondCreds.email, role: 'OWNER' },
      });
      expect(inviteRes.status()).toBeLessThan(300);

      // With a second OWNER present, demoting the first must succeed rather than
      // tripping the >=1 owner invariant.
      const patchRes = await request.patch(
        `${BASE_URL}/api/v1/workspaces/${workspaceId}/members/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { role: 'ADMIN' },
        },
      );
      expect([200, 204]).toContain(patchRes.status());

      // The second user is now an owner; the invariant held.
      const membersRes = await request.get(`${BASE_URL}/api/v1/workspaces/${workspaceId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(membersRes.status()).toBe(200);
      const membersBody = await membersRes.json();
      const owners = (membersBody.data ?? []).filter((m: { role: string }) => m.role === 'OWNER');
      expect(owners.length).toBeGreaterThanOrEqual(1);
    });
  });
});
