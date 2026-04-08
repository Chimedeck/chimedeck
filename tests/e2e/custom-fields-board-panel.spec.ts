// tests/e2e/custom-fields-board-panel.spec.ts
// Playwright E2E tests for the Custom Fields section in Board Settings UI.
// Covers: opening the panel, creating fields, renaming, toggling show_on_card, deleting.
// Based on: tests/e2e/custom-fields-board-panel.md (now deleted)

import { test, expect, type APIRequestContext } from '@playwright/test';
import { BASE_URL, registerAndLogin, createWorkspace, createBoard } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

async function setupBoardAndNavigate(
  request: APIRequestContext,
  page: import('@playwright/test').Page,
): Promise<{ token: string; boardId: string }> {
  const token = await registerAndLogin(request, 'cf-panel');
  const wsId = await createWorkspace(request, token);
  const boardId = await createBoard(request, token, wsId);

  // Navigate to the board using the API token via cookie/localStorage auth
  await page.goto(`${UI_URL}`);
  await page.evaluate(
    ({ t }: { t: string }) => localStorage.setItem('auth_token', t),
    { t: token },
  );
  await page.goto(`${UI_URL}/boards/${boardId}`);
  await page.waitForLoadState('networkidle');

  return { token, boardId };
}

test.describe('Custom Fields Board Settings Panel', () => {
  test('Open Board Settings and verify Custom Fields section is visible', async ({ request, page }) => {
    await setupBoardAndNavigate(request, page);

    await page.click('[aria-label="Board Settings"], [data-testid="board-settings-btn"], button:has-text("Settings")');
    await expect(page.locator('[aria-label="Board Settings"], [data-testid="board-settings-panel"]')).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('Custom Fields')).toBeVisible();
    await expect(page.getByRole('button', { name: /add custom field/i })).toBeVisible();
  });

  test('Create a TEXT custom field', async ({ request, page }) => {
    await setupBoardAndNavigate(request, page);

    await page.click('[aria-label="Board Settings"], [data-testid="board-settings-btn"], button:has-text("Settings")');
    await page.waitForSelector('[aria-label="Board Settings"], [data-testid="board-settings-panel"]');

    await page.getByRole('button', { name: /add custom field/i }).click();
    await page.waitForSelector('[aria-label="New custom field form"], [data-testid="new-custom-field-form"]');

    await page.getByLabel(/new field name|field name/i).fill('Priority');
    await page.getByRole('button', { name: /create field/i }).click();

    await expect(page.getByText('Priority')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Text')).toBeVisible();
  });

  test('Create a DROPDOWN custom field with options', async ({ request, page }) => {
    await setupBoardAndNavigate(request, page);

    await page.click('[aria-label="Board Settings"], [data-testid="board-settings-btn"], button:has-text("Settings")');
    await page.waitForSelector('[aria-label="Board Settings"], [data-testid="board-settings-panel"]');

    await page.getByRole('button', { name: /add custom field/i }).click();
    await page.getByLabel(/new field name|field name/i).fill('Status');
    await page.getByLabel(/field type/i).selectOption('DROPDOWN');

    await expect(page.locator('[aria-label="Dropdown options editor"], [data-testid="dropdown-options-editor"]')).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: /add option/i }).click();
    await page.locator('input[placeholder*="option"], input[aria-label*="option"]').last().fill('To Do');

    await page.getByRole('button', { name: /add option/i }).click();
    await page.locator('input[placeholder*="option"], input[aria-label*="option"]').last().fill('In Progress');

    await page.getByRole('button', { name: /create field/i }).click();

    await expect(page.getByText('Status')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Dropdown')).toBeVisible();
  });

  test('Rename a custom field', async ({ request, page }) => {
    await setupBoardAndNavigate(request, page);

    // Create field first via API for reliability
    const { token, boardId } = await setupBoardAndNavigate(request, page);
    await fetch(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ToRename', field_type: 'TEXT' }),
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.click('[aria-label="Board Settings"], [data-testid="board-settings-btn"], button:has-text("Settings")');
    await page.waitForSelector('[aria-label="Board Settings"], [data-testid="board-settings-panel"]');

    await page.getByRole('button', { name: /rename.*ToRename|ToRename/i }).click();
    const renameInput = page.getByLabel(/rename field/i);
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
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.click('[aria-label="Board Settings"], [data-testid="board-settings-btn"], button:has-text("Settings")');
    await page.waitForSelector('[aria-label="Board Settings"], [data-testid="board-settings-panel"]');

    const checkbox = page.getByLabel(/show on card/i).first();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  test('Delete a custom field', async ({ request, page }) => {
    const { token, boardId } = await setupBoardAndNavigate(request, page);
    await fetch(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'DeleteMe', field_type: 'TEXT' }),
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.click('[aria-label="Board Settings"], [data-testid="board-settings-btn"], button:has-text("Settings")');
    await page.waitForSelector('[aria-label="Board Settings"], [data-testid="board-settings-panel"]');

    await page.getByRole('button', { name: /delete.*DeleteMe|DeleteMe/i }).click();
    page.on('dialog', d => d.accept());

    await expect(page.getByText('DeleteMe')).not.toBeVisible({ timeout: 5000 });
  });

  test('Close the Board Settings panel', async ({ request, page }) => {
    await setupBoardAndNavigate(request, page);

    await page.click('[aria-label="Board Settings"], [data-testid="board-settings-btn"], button:has-text("Settings")');
    await page.waitForSelector('[aria-label="Board Settings"], [data-testid="board-settings-panel"]');

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
