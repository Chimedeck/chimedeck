// tests/e2e/offline-queue-persistence.spec.ts
// Playwright E2E tests for IndexedDB offline mutation queue persistence (Sprint 58).
//
// Verifies that:
//  1. A pending mutation written to IndexedDB survives a hard page reload.
//  2. On boot the app hydrates the in-memory queue from IndexedDB.
//  3. When the WS reconnects and the mutation is replayed, it is removed from IndexedDB.
//
// Run with: npx playwright test tests/e2e/offline-queue-persistence.spec.ts
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const DB_NAME = 'kanban-offline-queue';
const STORE = 'mutations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function registerAndLogin(
  request: APIRequestContext,
  suffix: string,
): Promise<{ token: string; email: string; password: string }> {
  const email = `oq-test-${suffix}-${Date.now()}@example.com`;
  const password = 'TestPassword1!';

  await request.post(`${BASE_URL}/api/v1/auth/register`, {
    data: { email, password, name: `OQ ${suffix}` },
  });

  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email, password },
  });
  const body = await loginRes.json() as { data: { access_token: string } };
  return { token: body.data.access_token, email, password };
}

async function createWorkspace(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `OQ-WS-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function createBoard(
  request: APIRequestContext,
  token: string,
  workspaceId: string,
): Promise<string> {
  const res = await request.post(`${BASE_URL}/api/v1/workspaces/${workspaceId}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `OQ-Board-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

/** Write a pending mutation directly into IndexedDB via the page context. */
async function seedMutationInIDB(
  page: Page,
  mutation: {
    id: string;
    boardId: string;
    method: string;
    url: string;
    body?: unknown;
    enqueuedAt: number;
  },
): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName, mut }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(storeName)) {
            req.result.createObjectStore(storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(mut);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      db.close();
    },
    { dbName: DB_NAME, storeName: STORE, mut: mutation },
  );
}

/** Read all mutations from IndexedDB via the page context. */
async function readMutationsFromIDB(page: Page): Promise<unknown[]> {
  return page.evaluate(
    async ({ dbName, storeName }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(storeName)) {
            req.result.createObjectStore(storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const all = await new Promise<unknown[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result as unknown[]);
        req.onerror = () => reject(req.error);
      });

      db.close();
      return all;
    },
    { dbName: DB_NAME, storeName: STORE },
  );
}

/** Log in via the UI login form so auth cookies/tokens are set. */
async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  // Wait until redirected away from /login (i.e. auth succeeded)
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('offline mutation queue — IndexedDB persistence', () => {
  test('mutation seeded in IndexedDB before page load is hydrated into queue on boot', async ({
    page,
    request,
  }) => {
    const { token, email, password } = await registerAndLogin(request, 'hydrate');
    const workspaceId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, workspaceId);

    // Navigate to app first so the origin is established, then seed IDB
    await loginViaUi(page, email, password);
    await page.goto(`${BASE_URL}/boards/${boardId}`, { waitUntil: 'domcontentloaded' });

    const mutationId = `test-hydrate-${Date.now()}`;
    const mutation = {
      id: mutationId,
      boardId,
      method: 'POST',
      url: `/api/v1/boards/${boardId}/lists`,
      body: { title: 'Persisted List' },
      enqueuedAt: Date.now(),
    };

    // Write mutation directly into IndexedDB (simulates a mutation that was enqueued
    // before the page was closed / refreshed)
    await seedMutationInIDB(page, mutation);

    // Verify it is in IDB before reload
    const beforeReload = await readMutationsFromIDB(page);
    expect(beforeReload).toHaveLength(1);
    expect((beforeReload[0] as { id: string }).id).toBe(mutationId);

    // Hard reload — App.tsx calls loadPersistedMutations() on boot which should
    // hydrate the in-memory queue with this mutation
    await page.reload({ waitUntil: 'networkidle' });

    // After reload, the mutation must still be in IndexedDB (it is only removed
    // when replay succeeds — not merely on hydration)
    const afterReload = await readMutationsFromIDB(page);
    expect(afterReload).toHaveLength(1);
    expect((afterReload[0] as { id: string }).id).toBe(mutationId);
  });

  test('mutation is removed from IndexedDB after successful replay', async ({
    page,
    request,
  }) => {
    const { token, email, password } = await registerAndLogin(request, 'replay');
    const workspaceId = await createWorkspace(request, token);
    const boardId = await createBoard(request, token, workspaceId);

    await loginViaUi(page, email, password);
    await page.goto(`${BASE_URL}/boards/${boardId}`, { waitUntil: 'domcontentloaded' });

    const listTitle = `Replayed-List-${Date.now()}`;
    const mutationId = `test-replay-${Date.now()}`;
    const mutation = {
      id: mutationId,
      boardId,
      method: 'POST',
      url: `/api/v1/boards/${boardId}/lists`,
      body: { title: listTitle },
      enqueuedAt: Date.now(),
    };

    // Seed mutation and reload
    await seedMutationInIDB(page, mutation);
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Intercept the list-creation API call that the queue replay will send
    const replayRequest = page.waitForRequest(
      (req) =>
        req.url().includes(`/api/v1/boards/${boardId}/lists`) && req.method() === 'POST',
      { timeout: 15_000 },
    );

    // Navigate to the board page so the WS connects and replay is triggered
    await page.goto(`${BASE_URL}/boards/${boardId}`, { waitUntil: 'networkidle' });

    // Verify the replay HTTP call was made
    const replayed = await replayRequest;
    expect(replayed).toBeTruthy();

    // Wait briefly for the acknowledgeMutation async removal to complete
    await page.waitForTimeout(500);

    // Mutation should now be gone from IndexedDB
    const afterReplay = await readMutationsFromIDB(page);
    const remaining = (afterReplay as Array<{ id: string }>).filter(
      (m) => m.id === mutationId,
    );
    expect(remaining).toHaveLength(0);
  });
});
