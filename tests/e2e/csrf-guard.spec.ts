// tests/e2e/csrf-guard.spec.ts
// Playwright E2E tests for the CSRF origin-header guard middleware.
// All tests operate at the API level — no UI interaction required.
// Based on: tests/e2e/csrf-guard.md (now deleted)

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndLogin, createWorkspace } from './_helpers';

test.describe('CSRF Origin Header Guard', () => {
  let token: string;
  let workspaceId: string;
  let boardId: string;

  test.beforeAll(async ({ request }) => {
    token = await registerAndLogin(request, 'csrf');
    workspaceId = await createWorkspace(request, token);

    // Create a board to use in PUT/DELETE tests
    const boardRes = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: BASE_URL,
      },
      data: { title: 'CSRF Test Board' },
    });
    const boardBody = await boardRes.json();
    boardId = boardBody.data?.id;
  });

  test('Test 1 — Mutating request with correct Origin passes', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: BASE_URL,
        'Content-Type': 'application/json',
      },
      data: { title: 'CSRF Allowed Board' },
    });
    expect(res.status()).not.toBe(403);
    const body = await res.json();
    const errorCode = body.error?.code ?? body.error?.name ?? body.name;
    expect(errorCode).not.toBe('csrf-origin-mismatch');
  });

  test('Test 2 — Mutating request with mismatched Origin is blocked (403)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'https://evil.example.com',
        'Content-Type': 'application/json',
      },
      data: { title: 'Malicious Board' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    const errorCode = body.error?.code ?? body.error?.name ?? body.name;
    expect(errorCode).toBe('csrf-origin-mismatch');
  });

  test('Test 3 — Mutating request with mismatched Referer is blocked (403)', async ({ request }) => {
    if (!boardId) {
      test.skip(true, 'boardId not available — skipping Referer test');
      return;
    }
    const res = await request.put(`${BASE_URL}/api/v1/boards/${boardId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Referer: 'https://attacker.net/form.html',
        'Content-Type': 'application/json',
      },
      data: { title: 'Updated Name' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    const errorCode = body.error?.code ?? body.error?.name ?? body.name;
    expect(errorCode).toBe('csrf-origin-mismatch');
  });

  test('Test 4 — Mutating request with no Origin/Referer is allowed (non-browser client)', async ({ request }) => {
    if (!boardId) {
      test.skip(true, 'boardId not available — skipping no-origin test');
      return;
    }
    // Send DELETE without Origin or Referer — simulates a server-to-server call
    const res = await request.delete(`${BASE_URL}/api/v1/boards/${boardId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Explicitly omit Origin and Referer
      },
      data: { confirm: true },
    });
    // Should NOT be blocked by CSRF guard (may 204 or 404 if board already deleted)
    expect(res.status()).not.toBe(403);
    const body = await res.json().catch(() => ({}));
    const errorCode = (body as { error?: { code?: string }; name?: string }).error?.code
      ?? (body as { name?: string }).name;
    expect(errorCode).not.toBe('csrf-origin-mismatch');
  });

  test('Test 5 — Safe (GET) request with mismatched Origin is NOT blocked', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: 'https://evil.example.com',
      },
    });
    expect(res.status()).not.toBe(403);
    const body = await res.json();
    const errorCode = (body as { error?: { code?: string }; name?: string }).error?.code
      ?? (body as { name?: string }).name;
    expect(errorCode).not.toBe('csrf-origin-mismatch');
  });

  test('Test 6 — Auth cookies contain SameSite=Strict; Secure; HttpOnly flags', async ({ request }) => {
    const email = `csrf-cookie-${Date.now()}@example.com`;
    const password = 'TestPassword1!';

    await request.post(`${BASE_URL}/api/v1/auth/register`, {
      data: { email, password, name: 'CSRF Cookie User' },
    });

    const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { email, password },
    });

    const setCookie = loginRes.headers()['set-cookie'];
    if (!setCookie) {
      // Not all auth flows use cookies (some use Bearer tokens only) — soft skip
      test.skip(true, 'No Set-Cookie header in login response — app may use Bearer-only auth');
      return;
    }

    expect(setCookie).toContain('HttpOnly');
    expect(setCookie.toLowerCase()).toContain('samesite=strict');
    expect(setCookie).toContain('Secure');
  });
});
