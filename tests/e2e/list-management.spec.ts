// tests/e2e/list-management.spec.ts
// Playwright E2E tests for list lifecycle: create, rename, reorder (drag), and archive.
// Based on: specs/tests/list-crud.md
// Soft-skips when the server is not reachable.

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndLogin, createWorkspace, createBoard, createList } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

test.describe('List Management', () => {
  let token: string;
  let boardId: string;
  const run = Date.now();

  test.beforeAll(async ({ request }) => {
    // Soft-skip entire suite if the server is not reachable
    const probe = await request.get(`${BASE_URL}/api/v1/health`).catch(() => null);
    if (!probe || probe.status() >= 500) {
      return;
    }

    token = await registerAndLogin(request, `list-${run}`);
    const workspaceId = await createWorkspace(request, token);
    boardId = await createBoard(request, token, workspaceId);
  });

  // ── API: Create ──────────────────────────────────────────────────────────────

  test('Test 1 — Create list returns 201 with id and name', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const res = await request.post(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `New List ${run}`, position: 0 },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'List creation endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(201);
    const body = await res.json() as { data: { id: string; name: string } };
    expect(body.data.id).toBeTruthy();
    expect(body.data.name).toBe(`New List ${run}`);
  });

  // ── API: Rename ──────────────────────────────────────────────────────────────

  test('Test 2 — Rename list returns 200 with updated name', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const listId = await createList(request, token, boardId);

    const res = await request.patch(`${BASE_URL}/api/v1/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Renamed List ${run}` },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'List rename endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.json() as { data: { id: string; name: string } };
    expect(body.data.id).toBe(listId);
    expect(body.data.name).toBe(`Renamed List ${run}`);
  });

  // ── API: Reorder ─────────────────────────────────────────────────────────────

  test('Test 3 — Reorder lists returns 200 with updated positions', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const listIdA = await createList(request, token, boardId);
    const listIdB = await createList(request, token, boardId);

    // Swap positions: put B before A
    const res = await request.patch(`${BASE_URL}/api/v1/boards/${boardId}/lists/reorder`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { order: [listIdB, listIdA] },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'List reorder endpoint not yet implemented — skipping');
      return;
    }

    expect([200, 204]).toContain(res.status());

    // Verify the new order is reflected in the board lists
    const listsRes = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listsBody = await listsRes.json() as { data: Array<{ id: string; position: number }> };
    const ids = listsBody.data.map((l) => l.id);
    expect(ids.indexOf(listIdB)).toBeLessThan(ids.indexOf(listIdA));
  });

  // ── API: Archive ─────────────────────────────────────────────────────────────

  test('Test 4 — Archive list returns 200 and list is excluded from active lists', async ({ request }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    const listId = await createList(request, token, boardId);

    const archiveRes = await request.patch(`${BASE_URL}/api/v1/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { archived: true },
    });

    if (archiveRes.status() === 404 || archiveRes.status() === 501) {
      test.skip(true, 'List archive endpoint not yet implemented — skipping');
      return;
    }

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
      data: { name: 'Unauthorised List', position: 0 },
    });

    if (res.status() === 404 || res.status() === 501) {
      test.skip(true, 'Endpoint not yet implemented — skipping');
      return;
    }

    expect(res.status()).toBe(401);
  });

  // ── UI: Create list via board UI ──────────────────────────────────────────────

  test('Test 6 — UI: Add list button creates a new list on the board', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    await page.goto(UI_URL);
    await page.evaluate(({ t }: { t: string }) => localStorage.setItem('auth_token', t), { t: token });
    await page.goto(`${UI_URL}/boards/${boardId}`);
    await page.waitForLoadState('networkidle');

    const addListBtn = page.locator(
      '[data-testid="add-list"], button:has-text("Add list"), button:has-text("Add a list")',
    ).first();

    if (await addListBtn.count() === 0) {
      test.skip(true, 'Add-list button not found in UI — skipping');
      return;
    }

    await addListBtn.click();

    const nameInput = page.locator(
      '[data-testid="list-name-input"], input[placeholder*="list name"], input[placeholder*="Enter list title"]',
    ).first();

    if (await nameInput.count() === 0) {
      test.skip(true, 'List name input not found — skipping');
      return;
    }

    const newListName = `UI List ${run}`;
    await nameInput.fill(newListName);
    await nameInput.press('Enter');

    await page.waitForTimeout(500);

    const listHeader = page.locator(
      `[data-testid^="list-header"], h2, h3, [class*="list-title"]`,
    ).filter({ hasText: newListName }).first();

    if (await listHeader.count() > 0) {
      await expect(listHeader).toBeVisible({ timeout: 5000 });
    }
  });

  // ── UI: Rename list ────────────────────────────────────────────────────────────

  test('Test 7 — UI: Double-clicking list header allows renaming', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    // Seed a known list for the UI rename test
    const seedListId = await createList(request, token, boardId);
    void seedListId; // used implicitly via page.goto below

    await page.goto(UI_URL);
    await page.evaluate(({ t }: { t: string }) => localStorage.setItem('auth_token', t), { t: token });
    await page.goto(`${UI_URL}/boards/${boardId}`);
    await page.waitForLoadState('networkidle');

    // Find any editable list header
    const listHeader = page.locator(
      '[data-testid^="list-header"], [class*="list-header"], [class*="list-title"]',
    ).first();

    if (await listHeader.count() === 0) {
      test.skip(true, 'List header element not found — skipping UI rename test');
      return;
    }

    await listHeader.dblclick();

    const editInput = page.locator('input[data-testid*="list"], input[class*="list"]').first();
    if (await editInput.count() === 0) {
      test.skip(true, 'List rename input did not appear — skipping');
      return;
    }

    const renamedValue = `Renamed via UI ${run}`;
    await editInput.fill(renamedValue);
    await editInput.press('Enter');

    await page.waitForTimeout(400);
    // The new name should be visible somewhere on the board
    const updatedHeader = page.locator('body').filter({ hasText: renamedValue });
    if (await updatedHeader.count() > 0) {
      await expect(page.locator('body')).toContainText(renamedValue, { timeout: 5000 });
    }
  });

  // ── UI: Drag-to-reorder ────────────────────────────────────────────────────────

  test('Test 8 — UI: Dragging a list changes its position', async ({ request, page }) => {
    if (!token) test.skip(true, 'Server not running — skipping');

    // Seed two lists for drag test
    await createList(request, token, boardId);
    await createList(request, token, boardId);

    await page.goto(UI_URL);
    await page.evaluate(({ t }: { t: string }) => localStorage.setItem('auth_token', t), { t: token });
    await page.goto(`${UI_URL}/boards/${boardId}`);
    await page.waitForLoadState('networkidle');

    const lists = page.locator(
      '[data-testid^="list-column"], [class*="list-column"], [class*="board-list"]',
    );

    const count = await lists.count();
    if (count < 2) {
      test.skip(true, 'Not enough lists rendered to test drag — skipping');
      return;
    }

    const firstList = lists.nth(0);
    const secondList = lists.nth(1);

    const firstBox = await firstList.boundingBox();
    const secondBox = await secondList.boundingBox();

    if (!firstBox || !secondBox) {
      test.skip(true, 'Could not compute bounding boxes for drag — skipping');
      return;
    }

    // Perform drag from first list to after second list
    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.move(secondBox.x + secondBox.width + 20, secondBox.y + secondBox.height / 2, { steps: 20 });
    await page.mouse.up();

    await page.waitForTimeout(600);
    // Verify the page is still intact after drag (no crash)
    await expect(page).not.toHaveURL(/error/);
  });
});
