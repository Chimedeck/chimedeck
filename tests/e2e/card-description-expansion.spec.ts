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
// (see extensions/Auth), so the spec logs in through the real UI form as the
// same user that owns the API-seeded workspace/board/card.
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
  let urlCardId: string;

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
    const loginRes = await request.post(`${BASE_URL}/api/v1/auth/token`, {
      data: { email, password },
    });
    const loginBody = (await loginRes.json()) as { data: { accessToken: string } };
    token = loginBody.data.accessToken;

    const wsId = await createWorkspace(request, token);
    boardId = await createBoard(request, token, wsId);
    const listId = await createList(request, token, boardId);
    cardId = await createCard(request, token, listId, 'Long Description Card');

    await request.patch(`${BASE_URL}/api/v1/cards/${cardId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { description: LONG_DESCRIPTION },
    });

    // Second card: a long unbroken token must wrap, not overflow horizontally.
    const unbreakable =
      'Unbreakable token: http://long-unbroken-domain.example.com/' + 'p'.repeat(240) + '/end';
    urlCardId = await createCard(request, token, listId, 'Unbreakable URL Card');
    await request.patch(`${BASE_URL}/api/v1/cards/${urlCardId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { description: unbreakable },
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

  test('long unbroken token wraps instead of overflowing horizontally', async ({ page }) => {
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

    await page.getByText('Unbreakable URL Card').first().click();
    const descSection = page.locator('section[aria-label="Description"]');
    await expect(descSection).toBeVisible({ timeout: 10000 });
    const container = descSection.locator('button').first();
    await expect(container).toBeVisible();

    // The preview must not paint outside the modal: its scrollWidth must stay
    // within its own client box (wrapping instead of horizontal overflow).
    const m = await container.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth + 2);
  });

  test('mobile: long description fully reachable by scrolling within the modal', async ({
    browser,
  }) => {
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await mobileCtx.newPage();
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

    await page.getByText('Long Description Card').first().click();
    const descSection = page.locator('section[aria-label="Description"]');
    await expect(descSection).toBeVisible({ timeout: 10000 });
    const container = descSection.locator('button').first();
    await expect(container).toBeVisible();

    // With the clamp removed and the mobile panel scrollable, the last line
    // must be reachable by scrolling the modal's scroll chain.
    const lastLine = container.getByText('Line 40:', { exact: false });
    await expect(lastLine).toBeAttached();

    // Native scrollIntoView exercises the real nested scroll container chain
    // (mobile ResizablePanels wrapper — the fix under test).
    await lastLine.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await expect(lastLine).toBeVisible();

    // And the last line must sit inside the modal's visible box, i.e. the
    // content scrolled inside the panel instead of painting off-viewport.
    const bounds = await page.evaluate(() => {
      const sec = document.querySelector('section[aria-label="Description"]') as HTMLElement;
      if (!sec) return { found: false };
      const chain: HTMLElement[] = [];
      let n: HTMLElement | null = sec;
      while (n && n !== document.body) {
        const cs = getComputedStyle(n);
        if (/(auto|scroll)/.test(cs.overflowY)) chain.push(n as HTMLElement);
        n = n.parentElement as HTMLElement | null;
      }
      if (chain.length === 0) return { found: true, scrollables: 0, inView: false };
      const box = chain[0].getBoundingClientRect();
      const r = sec.getBoundingClientRect();
      return {
        found: true,
        scrollables: chain.length,
        inView: r.top < box.bottom && r.bottom > box.top,
      };
    });
    expect(bounds.found).toBe(true);
    expect(bounds.scrollables).toBeGreaterThan(0);
    expect(bounds.inView).toBe(true);
    await mobileCtx.close();
  });
});