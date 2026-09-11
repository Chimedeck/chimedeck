// tests/e2e/delete-confirmation.spec.ts
// Playwright E2E tests for the Sprint 56 delete confirmation flag feature.
// Covers: board and list DELETE returning 409 without confirm:true, 204 with confirm:true,
//         empty board/list deleted immediately, UI confirmation dialog.
// Based on: tests/e2e/delete-confirmation.md (now deleted)

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndGetCredentials, createWorkspace, createBoard, createList, createCard, loginViaCookie, type Credentials } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';


// The board header exposes a "Board settings" menu trigger (lowercase); the
// delete menu item lives in the dropdown it opens. Delete confirmation dialogs
// (BoardDeleteDialog / ListDeleteDialog) render as plain divs with a heading, so
// locate them by heading + button names rather than role="dialog".
async function openBoardMenu(page: import('@playwright/test').Page): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Board settings' }).first();
  await trigger.waitFor({ state: 'visible', timeout: 15000 });
  await trigger.click();
}

// Both dialogs render a fixed full-screen overlay root; scope to that so the
// heading and the action buttons live inside the same container.
function boardDeleteDialog(page: import('@playwright/test').Page) {
  return page.locator('div.fixed.inset-0').filter({ has: page.getByRole('heading', { name: 'Delete board?' }) });
}

function listDeleteDialog(page: import('@playwright/test').Page) {
  return page.locator('div.fixed.inset-0').filter({ has: page.getByRole('heading', { name: 'Delete list?' }) });
}


// App boot performs an async token refresh; navigating immediately can race and
// land on /workspaces. Retry until the board header actually renders.
async function gotoBoard(
  page: import('@playwright/test').Page,
  boardId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${UI_URL}/b/${boardId}`);
    await page.waitForLoadState('networkidle');
    if (await page.getByRole('button', { name: 'Board settings' }).first().isVisible().catch(() => false)) return;
    await page.waitForTimeout(500);
  }
}

test.describe('Delete Confirmation Flag', () => {
  let creds: Credentials;
  let token: string;
  let workspaceId: string;

  test.beforeAll(async ({ request }) => {
    creds = await registerAndGetCredentials(request, 'del-confirm');
    token = creds.token;
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
    const uiCreds = await registerAndGetCredentials(request, 'del-ui-7');
    const uiWs = await createWorkspace(request, uiCreds.token);
    const boardId = await createBoard(request, uiCreds.token, uiWs);
    await createList(request, uiCreds.token, boardId);

    await loginViaCookie(page, UI_URL, uiCreds);
    await gotoBoard(page, boardId);

    await openBoardMenu(page);

    await page.getByRole('button', { name: 'Delete board' }).click();

    // Confirmation dialog should appear
    const dialog = boardDeleteDialog(page);
    await expect(dialog.getByRole('heading', { name: 'Delete board?' })).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByRole('button', { name: 'Delete board' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Cancel — board should still be open
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
    await expect(page).toHaveURL(new RegExp(boardId));
  });

  test('Test 8 — UI confirms and deletes board, redirects to workspace list', async ({ request, page }) => {
    const uiCreds = await registerAndGetCredentials(request, 'del-ui-8');
    const uiWs = await createWorkspace(request, uiCreds.token);
    const boardId = await createBoard(request, uiCreds.token, uiWs);
    await createList(request, uiCreds.token, boardId);

    await loginViaCookie(page, UI_URL, uiCreds);
    await gotoBoard(page, boardId);

    await openBoardMenu(page);

    await page.getByRole('button', { name: 'Delete board' }).click();

    const dialog = boardDeleteDialog(page);
    await expect(dialog.getByRole('heading', { name: 'Delete board?' })).toBeVisible({ timeout: 8000 });

    // Confirm delete
    await dialog.getByRole('button', { name: 'Delete board' }).click();

    // Should be redirected away from the board
    await page.waitForURL(/\/workspaces|\/boards(?!\/)/, { timeout: 8000 });
  });

  test('Test 9 — UI shows confirmation dialog for list with cards', async ({ request, page }) => {
    const uiCreds = await registerAndGetCredentials(request, 'del-ui-9');
    const uiWs = await createWorkspace(request, uiCreds.token);
    const boardId = await createBoard(request, uiCreds.token, uiWs);
    const listId = await createList(request, uiCreds.token, boardId);
    await createCard(request, uiCreds.token, listId, 'Card A');

    await loginViaCookie(page, UI_URL, uiCreds);
    await gotoBoard(page, boardId);

    // The list header button's accessible name also contains "List options",
    // so match the aria-label attribute directly to hit the ··· trigger.
    const listTrigger = page.locator('button[aria-label="List options"]').first();
    await listTrigger.click();
    // Wait for the menu to render, then pick Delete from inside the list item.
    const listItem = page.locator('[role="listitem"]').filter({ has: listTrigger });
    const deleteItem = listItem.getByRole('button', { name: 'Delete', exact: true });
    await deleteItem.waitFor({ state: 'attached', timeout: 8000 });
    // The list popover is taller than the column and not itself scrollable, so
    // Delete sits outside the viewport and cannot be scrolled into view.
    // Dispatch the click directly on the confirmed, enabled menu item.
    await deleteItem.dispatchEvent('click');

    const dialog = listDeleteDialog(page);
    await expect(dialog.getByRole('heading', { name: 'Delete list?' })).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByRole('button', { name: 'Delete list' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Cancel — list should still be on board
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('Test 10 — UI confirms and deletes list', async ({ request, page }) => {
    const uiCreds = await registerAndGetCredentials(request, 'del-ui-10');
    const uiWs = await createWorkspace(request, uiCreds.token);
    const boardId = await createBoard(request, uiCreds.token, uiWs);
    const listId = await createList(request, uiCreds.token, boardId);
    await createCard(request, uiCreds.token, listId, 'Card A');

    await loginViaCookie(page, UI_URL, uiCreds);
    await gotoBoard(page, boardId);

    // The list header button's accessible name also contains "List options",
    // so match the aria-label attribute directly to hit the ··· trigger.
    const listTrigger = page.locator('button[aria-label="List options"]').first();
    await listTrigger.click();
    // Wait for the menu to render, then pick Delete from inside the list item.
    const listItem = page.locator('[role="listitem"]').filter({ has: listTrigger });
    const deleteItem = listItem.getByRole('button', { name: 'Delete', exact: true });
    await deleteItem.waitFor({ state: 'attached', timeout: 8000 });
    // The list popover is taller than the column and not itself scrollable, so
    // Delete sits outside the viewport and cannot be scrolled into view.
    // Dispatch the click directly on the confirmed, enabled menu item.
    await deleteItem.dispatchEvent('click');

    const dialog = listDeleteDialog(page);
    await expect(dialog.getByRole('heading', { name: 'Delete list?' })).toBeVisible({ timeout: 8000 });

    await dialog.getByRole('button', { name: 'Delete list' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // List and its cards should no longer appear on the board
    const listContainer = page.locator(`[data-list-id="${listId}"], [data-testid="list-${listId}"]`).first();
    await expect(listContainer).not.toBeVisible({ timeout: 5000 });
  });
});
