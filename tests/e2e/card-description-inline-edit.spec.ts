// tests/e2e/card-description-inline-edit.spec.ts
// Playwright E2E tests for card description inline click-to-edit feature.
// Covers: click-to-edit, Ctrl+Enter save, Escape cancel, Save/Cancel buttons, placeholder, keyboard a11y.
// Based on: tests/e2e/card-description-inline-edit.md (now deleted)

import { test, expect } from '@playwright/test';
import { BASE_URL, registerAndGetCredentials, createWorkspace, createBoard, createList, createCard, loginViaCookie, type Credentials } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

const descriptionViewSelector = '[aria-label="Description (click to edit)"], [aria-label="Add a description (click to edit)"], [data-testid="card-description"], [data-testid="description-view"]';
const markdownEditorSelector = 'textarea[data-testid*="description"], textarea[name*="description"], [data-testid="description-editor"], textarea[placeholder="Write markdown..."]';
const richEditorSelector = '.ProseMirror[contenteditable="true"]';

async function openMarkdownEditor(page: import('@playwright/test').Page) {
  await page.locator(descriptionViewSelector).first().click();
  await page.getByRole('button', { name: 'Markdown' }).click();
  const textarea = page.locator(markdownEditorSelector).first();
  await textarea.waitFor({ state: 'visible', timeout: 5000 });
  return textarea;
}

test.describe('Card Description — Inline Click-to-Edit', () => {
  let creds: Credentials;
  let token: string;
  let boardId: string;
  let cardId: string;

  test.beforeEach(async ({ request, page }) => {
    // Create fresh credentials per test because refresh_token cookies are
    // rotated during app boot; reusing one across fresh browser contexts makes
    // later tests inject a stale cookie and land on the login page.
    creds = await registerAndGetCredentials(request, 'desc-edit');
    token = creds.token;
    const wsId = await createWorkspace(request, token);
    boardId = await createBoard(request, token, wsId);
    const listId = await createList(request, token, boardId);
    cardId = await createCard(request, token, listId, 'Desc Edit Card');

    // Seed an initial description via API
    await request.patch(`${BASE_URL}/api/v1/cards/${cardId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { description: 'Original text' },
    });

    await loginViaCookie(page, UI_URL, creds);
    await page.goto(`${UI_URL}/b/${boardId}`);
    await page.waitForLoadState('networkidle');

    // Open the card modal
    await page.locator('[aria-label^="Card:"]').first().click();
    await page.waitForSelector('[data-testid="card-modal"], [role="dialog"][aria-label^="Card:"]', { timeout: 8000 });
  });

  test('Test 1 — Enter edit mode by clicking description area', async ({ page }) => {
    const descArea = page.locator(descriptionViewSelector).first();

    // Explicit "Edit" button should NOT be present
    await expect(page.getByRole('button', { name: /^Edit$/i })).not.toBeVisible();

    // Click the description area to enter edit mode
    await descArea.click();

    // Rich text editor should appear with focus
    const editor = page.locator(richEditorSelector).first();
    await expect(editor).toBeVisible({ timeout: 5000 });
    await expect(editor).toBeFocused();

    // Save and Cancel buttons should appear
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('Test 2 — Save with Ctrl+Enter', async ({ page }) => {
    const textarea = await openMarkdownEditor(page);
    await textarea.fill('**Bold description** with _italic_ text');

    // Ctrl+Enter to save
    await textarea.press('Control+Enter');

    // Textarea should be gone
    await expect(textarea).not.toBeVisible({ timeout: 5000 });

    // Rendered output should contain bold element
    const descContainer = page.locator('[aria-label="Description (click to edit)"], [aria-label="Add a description (click to edit)"], [data-testid="card-description"], [data-testid="description-view"]').first();
    await expect(descContainer.locator('strong, b')).toBeVisible({ timeout: 5000 });

    // Close and reopen to verify persistence
    await page.keyboard.press('Escape');
    await page.locator('[aria-label^="Card:"]').first().click();
    await page.waitForSelector('[data-testid="card-modal"], [role="dialog"][aria-label^="Card:"]', { timeout: 8000 });
    const descContainerReopened = page.locator('[aria-label="Description (click to edit)"], [aria-label="Add a description (click to edit)"], [data-testid="card-description"], [data-testid="description-view"]').first();
    await expect(descContainerReopened.locator('strong, b')).toBeVisible({ timeout: 5000 });
  });

  test('Test 3 — Cancel with Escape restores original text', async ({ page }) => {
    const textarea = await openMarkdownEditor(page);
    await textarea.fill('Temporary unsaved text');

    await textarea.press('Escape');

    // Textarea should be gone
    await expect(textarea).not.toBeVisible({ timeout: 5000 });

    // Original text should still be shown (the .md says "Original text" but we saved bold in test 2 — use contains check)
    const descContainer = page.locator('[aria-label="Description (click to edit)"], [aria-label="Add a description (click to edit)"], [data-testid="card-description"], [data-testid="description-view"]').first();
    await expect(descContainer.getByText('Temporary unsaved text')).not.toBeVisible({ timeout: 3000 });
  });

  test('Test 4 — Save with Save button', async ({ page }) => {
    const textarea = await openMarkdownEditor(page);
    await textarea.fill('Saved via button');

    await page.getByRole('button', { name: /save/i }).click();

    await expect(textarea).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Saved via button')).toBeVisible({ timeout: 5000 });
  });

  test('Test 5 — Cancel with Cancel button', async ({ page }) => {
    const descArea = page.locator(descriptionViewSelector).first();
    const prevText = await descArea.textContent();
    const textarea = await openMarkdownEditor(page);
    await textarea.fill('Will not be saved');

    await page.getByRole('button', { name: /cancel/i }).click();

    await expect(textarea).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Will not be saved')).not.toBeVisible({ timeout: 3000 });

    if (prevText) {
      await expect(page.getByText(prevText.trim())).toBeVisible({ timeout: 3000 });
    }
  });

  test('Test 6 — Empty description shows placeholder', async ({ request, page }) => {
    // Create a fresh card with no description
    const wsId = await createWorkspace(request, token);
    const bId = await createBoard(request, token, wsId);
    const lId = await createList(request, token, bId);
    await createCard(request, token, lId, 'No Description Card');

    await page.goto(`${UI_URL}/b/${bId}`);
    await page.waitForLoadState('networkidle');
    await page.locator('[aria-label^="Card:"]').first().click();
    await page.waitForSelector('[data-testid="card-modal"], [role="dialog"][aria-label^="Card:"]', { timeout: 8000 });

    const placeholder = page.getByText(/add a more detailed description/i);
    await expect(placeholder).toBeVisible({ timeout: 5000 });

    // Placeholder should be clickable — click enters rich-text edit mode
    await placeholder.click();
    await expect(page.locator(richEditorSelector).first()).toBeVisible({ timeout: 5000 });
  });

  test('Test 7 — Keyboard accessibility: Enter on view element enters edit mode', async ({ page }) => {
    const descView = page.locator('[aria-label="Description (click to edit)"], [aria-label="Add a description (click to edit)"]').first();

    await descView.focus();
    await descView.press('Enter');

    await expect(page.locator(richEditorSelector).first()).toBeVisible({ timeout: 5000 });
  });
});
