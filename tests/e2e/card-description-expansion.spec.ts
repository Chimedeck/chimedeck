// tests/e2e/card-description-expansion.spec.ts
// Bug regression: card description in view mode must not clip long descriptions
// to a 12rem window with no read access to the rest of the content.
//
// Defect (report 2026-10-02): opening a card showed only ~6-8 lines of the
// description; the rest was hidden behind a 192px maxHeight (overflow hidden)
// and reading the entire text required clicking into edit mode. Expected: the
// description is rendered in full in view mode.
//
// Auth note: the app authenticates via HttpOnly cookies set by POST /auth/token
// (see extensions/Auth), so the three UI-based tests log in through the real
// form as the same user that owns the API-seeded workspace/board/card. API
// seeding reuses the accessToken returned by /auth/register — login is rate
// limited (10/IP/min) and must stay reserved for the UI behaviour under test.
import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  createWorkspace,
  createBoard,
  createList,
  createCard,
} from './_helpers';

const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

// Longer than the SHOW_MORE_THRESHOLD (400) and taller than any 12rem cap.
const LONG_DESCRIPTION = Array.from(
  { length: 40 },
  (_, i) => `Line ${i + 1}: description content that must remain readable in view mode.`
).join('\n');

test.describe('Card Description — full-content visibility in view mode', () => {
  let token: string;
  let email: string;
  let password: string;
  let boardId: string;
  let cardId: string;

  test.beforeAll(async ({ request }) => {
    // Deterministic per-run user whose credentials the UI login can reuse —
    // the seeded workspace/board/card must belong to the SAME user the UI
    // signs in as.
    email = `e2e-desc-expand-${Date.now()}@example.com`;
    password = 'TestPassword1!';
    const registerRes = await request.post(`${BASE_URL}/api/v1/auth/register`, {
      data: { email, password, name: 'Test desc-expand' },
    });
    expect(registerRes.ok()).toBeTruthy();
    // Register returns the accessToken directly (no login call — login is
    // rate limited at 10/IP/min and shared by the whole e2e suite).
    const registerBody = (await registerRes.json()) as {
      data: { accessToken: string };
    };
    token = registerBody.data.accessToken;

    const wsId = await createWorkspace(request, token);
    boardId = await createBoard(request, token, wsId);
    const listId = await createList(request, token, boardId);
    cardId = await createCard(request, token, listId, 'Long Description Card');

    await request.patch(`${BASE_URL}/api/v1/cards/${cardId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { description: LONG_DESCRIPTION },
    });
  });

  test('long description is visible in view mode (no silent 12rem clip)', async ({ page }) => {
    // Log in through the real form — auth rides on HttpOnly cookies set by
    // POST /auth/token, so localStorage seeding does not work.
    await page.goto(UI_URL);
    await page.locator('input[type="email"], input[name="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page
      .locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')
      .first()
      .click();
    await page.waitForLoadState('networkidle');

    await page.goto(`${UI_URL}/b/${boardId}`);
    await page.waitForLoadState('networkidle');

    // Open the seeded card
    await page.getByText('Long Description Card').first().click();
    // The card detail modal is a section[aria-label="Description"] inside a
    // shared dialog; wait on the description section itself (waitForSelector's
    // [role="dialog"] also matches the off-canvas mobile nav).
    const descSection = page.locator('section[aria-label="Description"]');
    await expect(descSection).toBeVisible({ timeout: 10000 });

    // Find the rendered preview container inside the description section
    const container = descSection.locator('button').first();
    await expect(container).toBeVisible();

    // Assert the LAST line is within the visible (non-clipped) region of the
    // preview container: every rendered line must be readable without opening
    // edit mode.
    const lastLine = container.getByText('Line 40:', { exact: false });
    await expect(lastLine).toBeAttached();

    const metrics = await container.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        maxHeight: cs.maxHeight,
        overflow: cs.overflow,
      };
    });

    // The defect state: scrollHeight far above clientHeight with overflow hidden
    // and a small (≈192px = "12rem") maxHeight cap.
    const clipped = metrics.scrollHeight - metrics.clientHeight;
    expect
      .soft(
        clipped,
        'description content must not be hidden behind overflow-hidden clamping'
      )
      .toBeLessThanOrEqual(2);

    // Server-visible state (Principle 3): the API must hold the full text too.
    const apiRes = await page.request.get(`${BASE_URL}/api/v1/cards/${cardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(apiRes.ok()).toBeTruthy();
    const apiBody = (await apiRes.json()) as {
      data: { description?: string };
    };
    expect(apiBody.data.description ?? '').toContain('Line 40');
  });
});