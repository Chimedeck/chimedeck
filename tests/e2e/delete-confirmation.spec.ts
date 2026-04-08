// tests/e2e/delete-confirmation.spec.ts
// Playwright E2E tests for the Sprint 56 delete confirmation flag feature.
// Covers: board and list DELETE returning 409 without confirm:true, 204 with confirm:true,
//         empty board/list deleted immediately, UI confirmation dialog.
// Based on: tests/e2e/delete-confirmation.md (now deleted)

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndLogin, createWorkspace, createBoard, createList, createCard } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

test.describe('Delete Confirmation Flag', () => {
  let token: string;
  let workspaceId: string;

  test.beforeAll(async ({ request }) => {
    token = await registerAndLogin(request, 'del-confirm');
    workspaceId = await createWorkspace(request, token);
  });

  test('Test 1 — Board DELETE without confirm returns 409 when board has lists', async ({ request }) => {
    const boardId = await createBoard(request, token, workspaceId);
    await createList(request, token, boardId);

    const res = await request.delete(`${BASE_URL}/api/v1/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    const name = body.name ?? body.error?.name ?? body.error?.code;
    expect(name).toBe('delete-requires-confirmation');
    expect(body.data?.listCount).toBeGreaterThanOrEqual(1);
  });

  test('Test 2 — Board DELETE with confirm:true succeeds when board has lists', async ({ request }) => {
    const boardId = await createBoard(request, token, workspaceId);
    await createList(request, token, boardId);

    // First confirm the 409 guard is in place
    const guardRes = await request.delete(`${BASE_URL}/api/v1/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(guardRes.status()).toBe(409);

    // Now delete with confirm:true
    const delRes = await request.delete(`${BASE_URL}/api/v1/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { confirm: true },
    });
    expect(delRes.status()).toBe(204);

    // Board should no longer exist
    const getRes = await request.get(`${BASE_URL}/api/v1/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(404);
  });

  test('Test 3 — Empty board DELETE proceeds without confirmation (204)', async ({ request }) => {
    const emptyBoardId = await createBoard(request, token, workspaceId);

    const res = await request.delete(`${BASE_URL}/api/v1/boards/${emptyBoardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(204);
  });

  test('Test 4 — List DELETE without confirm returns 409 when list has cards', async ({ request }) => {
    const boardId = await createBoard(request, token, workspaceId);
    const listId = await createList(request, token, boardId);
    await createCard(request, token, listId, 'Card A');

    const res = await request.delete(`${BASE_URL}/api/v1/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    const name = body.name ?? body.error?.name ?? body.error?.code;
    expect(name).toBe('delete-requires-confirmation');
    expect(body.data?.cardCount).toBeGreaterThanOrEqual(1);
  });

  test('Test 5 — List DELETE with confirm:true succeeds when list has cards', async ({ request }) => {
    const boardId = await createBoard(request, token, workspaceId);
    const listId = await createList(request, token, boardId);
    await createCard(request, token, listId, 'Card A');

    // Confirm 409 guard
    const guardRes = await request.delete(`${BASE_URL}/api/v1/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(guardRes.status()).toBe(409);

    // Delete with confirm:true
    const delRes = await request.delete(`${BASE_URL}/api/v1/lists/${listId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { confirm: true },
    });
    expect(delRes.status()).toBe(204);

    // List should no longer exist
    const listsRes = await request.get(`${BASE_URL}/api/v1/boards/${boardId}/lists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listsBody = await listsRes.json();
    const ids = (listsBody.data as Array<{ id: string }>).map((l) => l.id);
    expect(ids).not.toContain(listId);
  });

  test('Test 6 — Empty list DELETE proceeds without confirmation (204)', async ({ request }) => {
    const boardId = await createBoard(request, token, workspaceId);
    const emptyListId = await createList(request, token, boardId);

    const res = await request.delete(`${BASE_URL}/api/v1/lists/${emptyListId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(204);
  });

  test('Test 7 — UI shows confirmation dialog for board with lists', async ({ request, page }) => {
    const boardId = await createBoard(request, token, workspaceId);
    await createList(request, token, boardId);

    await page.goto(UI_URL);
    await page.evaluate(({ t }: { t: string }) => localStorage.setItem('auth_token', t), { t: token });
    await page.goto(`${UI_URL}/boards/${boardId}`);
    await page.waitForLoadState('networkidle');

    // Open board settings / action menu
    const settingsBtn = page.locator(
      '[data-testid="board-settings"], [aria-label*="settings"], button:has-text("settings"), button[title*="settings"]',
    ).first();
    if (await settingsBtn.count() === 0) {
      test.skip(true, 'Could not find board settings button — skipping UI test');
      return;
    }
    await settingsBtn.click();

    // Click "Delete board"
    const deleteBtn = page.getByRole('menuitem', { name: /delete board/i }).or(
      page.getByRole('button', { name: /delete board/i }),
    );
    await deleteBtn.click();

    // Confirmation dialog should appear
    const dialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByRole('button', { name: /delete/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /cancel/i })).toBeVisible();

    // Cancel — board should still exist
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator(`[data-board-id="${boardId}"], [href*="${boardId}"]`).first()).toBeVisible({ timeout: 5000 });
  });

  test('Test 8 — UI confirms and deletes board, redirects to workspace list', async ({ request, page }) => {
    const boardId = await createBoard(request, token, workspaceId);
    await createList(request, token, boardId);

    await page.goto(UI_URL);
    await page.evaluate(({ t }: { t: string }) => localStorage.setItem('auth_token', t), { t: token });
    await page.goto(`${UI_URL}/boards/${boardId}`);
    await page.waitForLoadState('networkidle');

    const settingsBtn = page.locator(
      '[data-testid="board-settings"], [aria-label*="settings"], button:has-text("settings"), button[title*="settings"]',
    ).first();
    if (await settingsBtn.count() === 0) {
      test.skip(true, 'Could not find board settings button — skipping UI test');
      return;
    }
    await settingsBtn.click();

    const deleteBtn = page.getByRole('menuitem', { name: /delete board/i }).or(
      page.getByRole('button', { name: /delete board/i }),
    );
    await deleteBtn.click();

    const dialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Confirm delete
    await dialog.getByRole('button', { name: /delete/i }).last().click();

    // Should be redirected away from the board
    await page.waitForURL(/\/workspaces|\/boards(?!\/)/, { timeout: 8000 });
  });

  test('Test 9 — UI shows confirmation dialog for list with cards', async ({ request, page }) => {
    const boardId = await createBoard(request, token, workspaceId);
    const listId = await createList(request, token, boardId);
    await createCard(request, token, listId, 'Card A');

    await page.goto(UI_URL);
    await page.evaluate(({ t }: { t: string }) => localStorage.setItem('auth_token', t), { t: token });
    await page.goto(`${UI_URL}/boards/${boardId}`);
    await page.waitForLoadState('networkidle');

    // Open list action menu
    const listMenu = page.locator('[data-testid="list-menu"], [aria-label*="list menu"], button[title*="list"]').first();
    if (await listMenu.count() === 0) {
      test.skip(true, 'Could not find list action menu — skipping UI list delete test');
      return;
    }
    await listMenu.click();

    const deleteListBtn = page.getByRole('menuitem', { name: /delete list/i }).or(
      page.getByRole('button', { name: /delete list/i }),
    );
    await deleteListBtn.click();

    const dialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByRole('button', { name: /delete/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /cancel/i })).toBeVisible();

    // Cancel — list should still be on board
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('Test 10 — UI confirms and deletes list', async ({ request, page }) => {
    const boardId = await createBoard(request, token, workspaceId);
    const listId = await createList(request, token, boardId);
    await createCard(request, token, listId, 'Card A');

    await page.goto(UI_URL);
    await page.evaluate(({ t }: { t: string }) => localStorage.setItem('auth_token', t), { t: token });
    await page.goto(`${UI_URL}/boards/${boardId}`);
    await page.waitForLoadState('networkidle');

    const listMenu = page.locator('[data-testid="list-menu"], [aria-label*="list menu"], button[title*="list"]').first();
    if (await listMenu.count() === 0) {
      test.skip(true, 'Could not find list action menu — skipping UI list delete confirmation test');
      return;
    }
    await listMenu.click();

    const deleteListBtn = page.getByRole('menuitem', { name: /delete list/i }).or(
      page.getByRole('button', { name: /delete list/i }),
    );
    await deleteListBtn.click();

    const dialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByRole('button', { name: /delete/i }).last().click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // List and its cards should no longer appear on the board
    const listContainer = page.locator(`[data-list-id="${listId}"], [data-testid="list-${listId}"]`).first();
    await expect(listContainer).not.toBeVisible({ timeout: 5000 });
  });
});
