// tests/e2e/custom-fields-board-panel.spec.ts
// Playwright E2E tests for the Custom Fields section in Board Settings UI.
// Covers: opening the panel, creating fields, renaming, toggling show_on_card, deleting.
// Based on: tests/e2e/custom-fields-board-panel.md (now deleted)

import { test, expect, type APIRequestContext } from '@playwright/test';
import { BASE_URL, registerAndGetCredentials, createWorkspace, createBoard, loginViaCookie, type Credentials } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

async function setupBoardAndNavigate(
  request: APIRequestContext,
  page: import('@playwright/test').Page,
): Promise<{ creds: Credentials; token: string; boardId: string }> {
  const creds = await registerAndGetCredentials(request, 'cf-panel');
  const wsId = await createWorkspace(request, creds.token);
  const boardId = await createBoard(request, creds.token, wsId);

  // The app authenticates via HttpOnly cookies, so log in through the UI form.
  await loginViaCookie(page, UI_URL, creds);
  // App boot performs an async token refresh; navigating immediately can race
  // and land on /workspaces. Retry until the board header actually renders.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${UI_URL}/b/${boardId}`);
    await page.waitForLoadState('networkidle');
    if (await page.getByRole('button', { name: 'Board settings' }).first().isVisible().catch(() => false)) break;
    await page.waitForTimeout(500);
  }

  return { creds, token: creds.token, boardId };
}


// The board header renders a "Board settings" menu trigger (lowercase) which
// opens a dropdown; the settings panel itself only mounts after the menu item
// is clicked. Drive both steps so the panel is actually open.
async function openBoardSettings(page: import('@playwright/test').Page): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Board settings' }).first();
  await trigger.waitFor({ state: 'visible', timeout: 15000 });
  await trigger.click();
  await page.getByRole('button', { name: 'Board settings', exact: true }).last().click();
  await expect(page.locator('[aria-label="Board Settings"]')).toBeVisible({ timeout: 8000 });
}

test.describe('Custom Fields Board Settings Panel', () => {
  test('Open Board Settings and verify Custom Fields section is visible', async ({ request, page }) => {
    await setupBoardAndNavigate(request, page);

    await openBoardSettings(page);

    await expect(page.getByText('Custom Fields', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create custom field' })).toBeVisible();
  });

  test('Create a TEXT custom field', async ({ request, page }) => {
    await setupBoardAndNavigate(request, page);

    await openBoardSettings(page);

    await page.getByRole('button', { name: 'Create custom field' }).click();
    await page.locator('[aria-label="New custom field form"]').waitFor({ state: 'visible' });

    await page.getByLabel('Field name').fill('Priority');
    await page.getByRole('button', { name: /create field/i }).click();

    await expect(page.getByText('Priority')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Text')).toBeVisible();
  });

  test('Create a DROPDOWN custom field with options', async ({ request, page }) => {
    await setupBoardAndNavigate(request, page);

    await openBoardSettings(page);

    await page.getByRole('button', { name: 'Create custom field' }).click();
    await page.getByLabel('Field name').fill('Status');
    await page.getByLabel('Field type').selectOption('DROPDOWN');

    await expect(page.locator('[aria-label="Dropdown options editor"]')).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: '+ Add option' }).click();
    await page.getByRole('textbox', { name: 'Label for dropdown option' }).last().fill('To Do');

    await page.getByRole('button', { name: '+ Add option' }).click();
    await page.getByRole('textbox', { name: 'Label for dropdown option' }).last().fill('In Progress');

    await page.getByRole('button', { name: /create field/i }).click();

    await expect(page.getByText('Status')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Dropdown')).toBeVisible();
  });

  test('Rename a custom field', async ({ request, page }) => {
    // Create field first via API for reliability
    const { token, boardId } = await setupBoardAndNavigate(request, page);
    await fetch(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ToRename', field_type: 'TEXT' }),
    });

    await openBoardSettings(page);

    await page.getByRole('button', { name: 'Rename field ToRename' }).click();
    const renameInput = page.getByLabel('Rename field', { exact: true });
    await renameInput.clear();
    await renameInput.fill('Renamed');
    await renameInput.press('Enter');

    await expect(page.getByText('Renamed')).toBeVisible({ timeout: 5000 });
  });

  test('Toggle show_on_card checkbox', async ({ request, page }) => {
    const { token, boardId } = await setupBoardAndNavigate(request, page);
    await fetch(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Urgency', field_type: 'TEXT' }),
    });

    await openBoardSettings(page);

    const checkbox = page.getByRole('checkbox', { name: 'Show on card tile' }).first();
    await checkbox.click();
    await expect(checkbox).toBeChecked({ timeout: 5000 });
    await checkbox.click();
    await expect(checkbox).not.toBeChecked({ timeout: 5000 });
  });

  test('Delete a custom field', async ({ request, page }) => {
    const { token, boardId } = await setupBoardAndNavigate(request, page);
    await fetch(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'DeleteMe', field_type: 'TEXT' }),
    });

    await openBoardSettings(page);

    page.on('dialog', (d) => { void d.accept(); });
    await page.getByRole('button', { name: 'Delete field DeleteMe' }).click();

    await expect(page.getByText('DeleteMe')).not.toBeVisible({ timeout: 5000 });
  });

  test('Close the Board Settings panel', async ({ request, page }) => {
    await setupBoardAndNavigate(request, page);

    await openBoardSettings(page);

    const closeBtn = page.getByRole('button', { name: /close/i });
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(
      page.locator('[aria-label="Board Settings"], [data-testid="board-settings-panel"]'),
    ).not.toBeVisible({ timeout: 5000 });
  });
});
