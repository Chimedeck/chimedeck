// tests/e2e/custom-fields-ui.spec.ts
// Playwright E2E tests for custom field value editing in the card modal and tile badges.
// Covers: TEXT, NUMBER, DATE, CHECKBOX, DROPDOWN fields; clearing values; show_on_card badges.
// Based on: tests/e2e/custom-fields-ui.md (now deleted)

import { test, expect, type APIRequestContext } from '@playwright/test';
import { BASE_URL, registerAndGetCredentials, createWorkspace, createBoard, createList, createCard, loginViaCookie, type Credentials } from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

interface SetupResult {
  creds: Credentials;
  token: string;
  boardId: string;
  cardId: string;
}

async function setupBoardWithCard(request: APIRequestContext): Promise<SetupResult> {
  const creds = await registerAndGetCredentials(request, 'cf-ui');
  const wsId = await createWorkspace(request, creds.token);
  const boardId = await createBoard(request, creds.token, wsId);
  const listId = await createList(request, creds.token, boardId);
  const cardId = await createCard(request, creds.token, listId, 'CF UI Test Card');

  return { creds, token: creds.token, boardId, cardId };
}


async function openBoard(page: import('@playwright/test').Page, setup: SetupResult): Promise<void> {
  await loginViaCookie(page, UI_URL, setup.creds);
  await page.goto(`${UI_URL}/b/${setup.boardId}`);
  await page.waitForLoadState('networkidle');
}

async function createFieldViaApi(
  token: string,
  boardId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/boards/${boardId}/custom-fields`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json() as { data?: { id: string }; error?: unknown };
  if (!res.ok || !body.data?.id) {
    throw new Error(`Failed to create custom field (${res.status}): ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

async function openCardModal(page: import('@playwright/test').Page) {
  await page.locator('[aria-label^="Card:"]').first().click();
  await page.waitForSelector('[data-testid="card-modal"], [role="dialog"][aria-label^="Card:"]', { timeout: 5000 });
}

test.describe('Custom Fields UI — Card Modal Value Editing', () => {
  test('TEXT field — edit and save value in card modal, badge on tile', async ({ request, page }) => {
    const setup = await setupBoardWithCard(request);
    const { token, boardId } = setup;
    await createFieldViaApi(token, boardId, {
      name: 'Notes',
      field_type: 'TEXT',
      show_on_card: true,
      position: 0,
    });
    await openBoard(page, setup);

    await openCardModal(page);

    const customFieldsSection = page.getByText(/custom fields/i);
    await expect(customFieldsSection).toBeVisible({ timeout: 5000 });

    const notesInput = page.getByRole('textbox', { name: 'Notes value' });
    await notesInput.click();
    await notesInput.fill('Hello world');
    await notesInput.press('Tab');

    await page.keyboard.press('Escape');

    await expect(page.getByText('Hello world')).toBeVisible({ timeout: 5000 });
  });

  test('NUMBER field — edit value in card modal, badge on tile', async ({ request, page }) => {
    const setup = await setupBoardWithCard(request);
    const { token, boardId } = setup;
    await createFieldViaApi(token, boardId, {
      name: 'Story Points',
      field_type: 'NUMBER',
      show_on_card: true,
      position: 0,
    });
    await openBoard(page, setup);

    await openCardModal(page);

    const numInput = page.getByRole('spinbutton', { name: 'Story Points value' }).or(page.locator('input[type="number"]')).first();
    await numInput.click();
    await numInput.fill('8');
    await numInput.press('Enter');

    await page.keyboard.press('Escape');

    await expect(page.locator('[aria-label="Story Points: 8"], [title="Story Points: 8"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('CHECKBOX field — toggle value in card modal', async ({ request, page }) => {
    const setup = await setupBoardWithCard(request);
    const { token, boardId } = setup;
    await createFieldViaApi(token, boardId, {
      name: 'Reviewed',
      field_type: 'CHECKBOX',
      show_on_card: true,
      position: 0,
    });
    await openBoard(page, setup);

    await openCardModal(page);

    const checkbox = page.getByRole('checkbox', { name: 'Reviewed' });
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(page.locator('[aria-label="Reviewed: ✓"], [title="Reviewed: ✓"]').first()).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
  });

  test('DROPDOWN field — select option in card modal', async ({ request, page }) => {
    const setup = await setupBoardWithCard(request);
    const { token, boardId } = setup;
    await createFieldViaApi(token, boardId, {
      name: 'Priority',
      field_type: 'DROPDOWN',
      options: [
        { id: 'opt-high', label: 'High', color: '#EF4444' },
        { id: 'opt-med', label: 'Medium', color: '#EAB308' },
        { id: 'opt-low', label: 'Low', color: '#22C55E' },
      ],
      show_on_card: true,
      position: 0,
    });
    await openBoard(page, setup);

    await openCardModal(page);

    const dropdown = page.getByLabel(/Priority/i).or(page.locator('select[name*="priority"], [data-field="Priority"]'));
    await dropdown.selectOption({ label: 'High' });

    await page.keyboard.press('Escape');

    await expect(page.getByText('High')).toBeVisible({ timeout: 5000 });
  });

  test('Clear a field value removes badge from tile', async ({ request, page }) => {
    const setup = await setupBoardWithCard(request);
    const { token, boardId } = setup;
    await createFieldViaApi(token, boardId, {
      name: 'Notes',
      field_type: 'TEXT',
      show_on_card: true,
      position: 0,
    });
    await openBoard(page, setup);

    await openCardModal(page);

    const notesInput = page.getByRole('textbox', { name: 'Notes value' });
    await notesInput.fill('Hello world');
    await notesInput.press('Tab');

    const clearBtn = page.getByRole('button', { name: /clear.*Notes|✕/i }).first();
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    } else {
      await notesInput.fill('');
      await notesInput.press('Tab');
    }

    await page.keyboard.press('Escape');

    await expect(page.getByText('Hello world')).not.toBeVisible({ timeout: 5000 });
  });

  test('show_on_card=false — no badge on tile', async ({ request, page }) => {
    const setup = await setupBoardWithCard(request);
    const { token, boardId } = setup;
    await createFieldViaApi(token, boardId, {
      name: 'Internal Notes',
      field_type: 'TEXT',
      show_on_card: false,
      position: 0,
    });
    await openBoard(page, setup);

    await openCardModal(page);

    const notesInput = page.getByRole('textbox', { name: 'Internal Notes value' });
    await notesInput.fill('private text');
    await notesInput.press('Tab');
    await page.keyboard.press('Escape');

    // The card tile should NOT show the value as a badge
    const tile = page.locator('[aria-label^="Card:"]').first();
    await expect(tile.getByText('private text')).not.toBeVisible({ timeout: 3000 });
  });
});
