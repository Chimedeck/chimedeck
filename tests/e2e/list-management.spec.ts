// tests/e2e/list-management.spec.ts
// Playwright E2E tests for list lifecycle: create, rename, reorder (drag), and archive.
// Based on: specs/tests/list-crud.md
// Soft-skips when the server is not reachable.

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndGetCredentials, createWorkspace, createBoard, createList, loginViaCookie, type Credentials } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

// The app boot performs an async token refresh, so navigating straight after
// login can race it and land on /workspaces instead of the board.
async function gotoBoard(page: import('@playwright/test').Page, boardId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${UI_URL}/b/${boardId}`);
    await page.waitForLoadState('networkidle');
    try {
      await page.waitForSelector('[aria-label="Board lists"]', { timeout: 8000 });
      return;
    } catch {
      await page.waitForTimeout(500);
    }
  }
  throw new Error(`Board ${boardId} did not render (url: ${page.url()})`);
}

test.describe('List Management', () => {
  let creds: Credentials;
  let token: string;
  let boardId: string;
  const run = Date.now();

  test.beforeAll(async ({ request }) => {
    // Soft-skip entire suite if the server is not reachable
    const probe = await request.get(`${BASE_URL}/api/v1/health`).catch(() => null);
    if (!probe || probe.status() >= 500) {
      return;
    }

    creds = await registerAndGetCredentials(request, `list-${run}`);
    token = creds.token;
    const workspaceId = await createWorkspace(request, token);
    boardId = await createBoard(request, token, workspaceId);
  });

  // ── API: Create ──────────────────────────────────────────────────────────────

  test('Test 1 — Create list returns 201 with id and title', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: `New List ${run}` },
    });

    expect(res.status()).toBe(201);
    const body = await res.json() as { data: { id: string; title: string } };
    expect(body.data.id).toBeTruthy();
    expect(body.data.title).toBe(`New List ${run}`);
  });

  // ── API: Rename ──────────────────────────────────────────────────────────────

  test('Test 2 — Rename list returns 200 with updated title', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const listId = await createList(request, token, boardId);

    const res = await request.patch(`${BASE_URL}/api/v1/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: `Renamed List ${run}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json() as { data: { id: string; title: string } };
    expect(body.data.id).toBe(listId);
    expect(body.data.title).toBe(`Renamed List ${run}`);
  });

  // ── API: Reorder ─────────────────────────────────────────────────────────────

  test('Test 3 — Reorder lists returns 200 with updated positions', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    // Reorder validates that the payload lists every ACTIVE list on the board,
    // so work on a fresh board with a known list count.
    const workspaceId = await createWorkspace(request, token);
    const reorderBoardId = await createBoard(request, token, workspaceId);
    const listIdA = await createList(request, token, reorderBoardId);
    const listIdB = await createList(request, token, reorderBoardId);

    // Swap positions: put B before A. POST, not PATCH.
    const res = await request.post(`${BASE_URL}/api/v1/boards/${reorderBoardId}/lists/reorder`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { order: [listIdB, listIdA] },
    });

    expect([200, 204]).toContain(res.status());

    // Verify the new order is reflected in the board lists
    const listsRes = await request.get(`${BASE_URL}/api/v1/boards/${reorderBoardId}/lists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listsBody = await listsRes.json() as { data: Array<{ id: string }> };
    const ids = listsBody.data.map((l) => l.id);
    expect(ids.indexOf(listIdB)).toBeLessThan(ids.indexOf(listIdA));
  });

  test('Test 3b — Reorder rejects a payload that omits an active list', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const workspaceId = await createWorkspace(request, token);
    const reorderBoardId = await createBoard(request, token, workspaceId);
    const listIdA = await createList(request, token, reorderBoardId);
    await createList(request, token, reorderBoardId);

    // Only one of two active lists supplied — must be rejected.
    const res = await request.post(`${BASE_URL}/api/v1/boards/${reorderBoardId}/lists/reorder`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { order: [listIdA] },
    });

    expect(res.status()).toBe(400);
  });

  // ── API: Archive ─────────────────────────────────────────────────────────────

  test('Test 4 — Archive list returns 200 and list is excluded from active lists', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const listId = await createList(request, token, boardId);

    // Archive is PATCH, not POST.
    const archiveRes = await request.patch(`${BASE_URL}/api/v1/lists/${listId}/archive`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(archiveRes.status()).toBe(200);

    // The archived list should not appear in the default (active) list endpoint
    const activeRes = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const activeBody = await activeRes.json() as { data: Array<{ id: string }> };
    const activeIds = activeBody.data.map((l) => l.id);
    expect(activeIds).not.toContain(listId);
  });

  // ── API: Unauthenticated guard ────────────────────────────────────────────────

  test('Test 5 — Create list without auth returns 401', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
      data: { title: 'Unauthorised List' },
    });

    expect(res.status()).toBe(401);
  });

  // ── UI: Create list via board UI ──────────────────────────────────────────────

  test('Test 6 — UI: Add list button creates a new list on the board', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    // Fresh user/board so the assertion is about this list only.
    const uiCreds = await registerAndGetCredentials(request, `list-ui6-${run}`);
    const uiToken = uiCreds.token;
    const uiWorkspaceId = await createWorkspace(request, uiToken);
    const uiBoardId = await createBoard(request, uiToken, uiWorkspaceId);

    await loginViaCookie(page, UI_URL, uiCreds);
    await gotoBoard(page, uiBoardId);

    // The board renders a "+ Add a list" button (no data-testid).
    await page.getByRole('button', { name: /Add a list/i }).first().click();
    const nameInput = page.locator('input:visible, textarea:visible').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    const newListName = `UI List ${run}`;
    await nameInput.fill(newListName);
    await nameInput.press('Enter');

    // The new list header appears. List headers are buttons labelled
    // "Rename list <name>"; match exactly, because the wrapping column button's
    // accessible name concatenates its nested controls and also matches loosely.
    await expect(page.getByRole('button', { name: `Rename list ${newListName}`, exact: true }))
      .toBeVisible({ timeout: 8000 });

    // And it is reflected in the API.
    const listsRes = await request.get(`${BASE_URL}/api/v1/boards/${uiBoardId}/lists`, {
      headers: { Authorization: `Bearer ${uiToken}` },
    });
    const listsBody = await listsRes.json() as { data: Array<{ title: string }> };
    expect(listsBody.data.some((l) => l.title === newListName)).toBe(true);
  });

  // ── UI: Rename list ────────────────────────────────────────────────────────────

  test('Test 7 — UI: Renaming a list via its header updates the name', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const uiCreds = await registerAndGetCredentials(request, `list-ui7-${run}`);
    const uiToken = uiCreds.token;
    const uiWorkspaceId = await createWorkspace(request, uiToken);
    const uiBoardId = await createBoard(request, uiToken, uiWorkspaceId);
    const originalName = `Original ${run}`;
    const uiListId = await createList(request, uiToken, uiBoardId, originalName);

    await loginViaCookie(page, UI_URL, uiCreds);
    await gotoBoard(page, uiBoardId);

    // List headers are buttons whose accessible name starts "Rename list <name>".
    const renameBtn = page.getByRole('button', { name: `Rename list ${originalName}`, exact: true }).first();
    await expect(renameBtn).toBeVisible({ timeout: 8000 });
    await renameBtn.click();

    const editInput = page.locator('input:visible, textarea:visible').first();
    await expect(editInput).toBeVisible({ timeout: 5000 });

    const renamedValue = `Renamed via UI ${run}`;
    await editInput.fill(renamedValue);
    await editInput.press('Enter');

    // The header now shows the new name.
    await expect(page.getByRole('button', { name: `Rename list ${renamedValue}`, exact: true }))
      .toBeVisible({ timeout: 8000 });

    // And the API agrees.
    const listRes = await request.get(`${BASE_URL}/api/v1/boards/${uiBoardId}/lists`, {
      headers: { Authorization: `Bearer ${uiToken}` },
    });
    const listBody = await listRes.json() as { data: Array<{ id: string; title: string }> };
    const updated = listBody.data.find((l) => l.id === uiListId);
    expect(updated?.title).toBe(renamedValue);
  });

  // ── UI: Drag-to-reorder ────────────────────────────────────────────────────────

  test('Test 8 — UI: Dragging a list changes its position', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const uiCreds = await registerAndGetCredentials(request, `list-ui8-${run}`);
    const uiToken = uiCreds.token;
    const uiWorkspaceId = await createWorkspace(request, uiToken);
    const uiBoardId = await createBoard(request, uiToken, uiWorkspaceId);
    const nameA = `Drag A ${run}`;
    const nameB = `Drag B ${run}`;
    await createList(request, uiToken, uiBoardId, nameA);
    await createList(request, uiToken, uiBoardId, nameB);

    // Order as the API sees it — the drag must change THIS, not just the DOM.
    const apiOrder = async (): Promise<string[]> => {
      const res = await request.get(`${BASE_URL}/api/v1/boards/${uiBoardId}/lists`, {
        headers: { Authorization: `Bearer ${uiToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json() as { data: Array<{ title: string }> };
      return body.data.map((l) => l.title);
    };
    const apiOrderBefore = await apiOrder();
    expect(apiOrderBefore.slice(0, 2)).toEqual([nameA, nameB]);

    await loginViaCookie(page, UI_URL, uiCreds);
    await gotoBoard(page, uiBoardId);

    // Columns are listitems whose accessible name is "List: <name>".
    const columns = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Rename list/ }) });
    const first = columns.first();
    await expect(first).toBeVisible({ timeout: 8000 });

    // Inner rename buttons carry aria-label exactly "Rename list <name>"; the
    // wrapping column button concatenates nested labels too, so filter to leaf
    // buttons by requiring no nested button.
    const renameButtons = page.locator('button[aria-label^="Rename list "]').filter({ hasNot: page.locator('button') });
    const orderBefore = (await renameButtons.allInnerTexts()).filter((x) => x.trim());
    expect(orderBefore.length).toBeGreaterThanOrEqual(2);

    const firstBox = await first.boundingBox();
    expect(firstBox).toBeTruthy();
    if (!firstBox) return;

    // Drag the first column's header to the right of the second column.
    const secondBox = await renameButtons.nth(1).boundingBox();
    expect(secondBox).toBeTruthy();
    if (!secondBox) return;

    await page.mouse.move(firstBox.x + 20, firstBox.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.move(secondBox.x + secondBox.width + 30, secondBox.y + 10, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    // The board persists a new order: the first list is no longer first.
    const orderAfter = (await renameButtons.allInnerTexts()).filter((x) => x.trim());
    expect(orderAfter.length).toBe(orderBefore.length);
    expect(orderAfter[0]).not.toBe(orderBefore[0]);

    // And the change reached the server. Without this the test would pass even
    // if the drag only mutated local state and never called the reorder endpoint.
    await expect
      .poll(apiOrder, { timeout: 8000 })
      .toEqual([nameB, nameA]);
  });
});
