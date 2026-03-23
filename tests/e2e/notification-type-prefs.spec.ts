import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const UI_URL = process.env.TEST_UI_URL ?? 'http://localhost:5173';

interface Credentials { email: string; password: string; token: string }

async function registerAndLogin(request: APIRequestContext, suffix: string): Promise<Credentials> {
  const email = `ntp-test-${suffix}-${Date.now()}@journeyh.io`;
  const password = 'TestPassword1!';
  await request.post(`${API_URL}/api/v1/auth/register`, {
    data: { email, password, name: `NTP ${suffix}` },
  });
  const loginRes = await request.post(`${API_URL}/api/v1/auth/token`, {
    data: { email, password },
  });
  const body = await loginRes.json() as { data: { accessToken: string } };
  return { email, password, token: body.data.accessToken };
}

async function createWorkspace(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.post(`${API_URL}/api/v1/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `WS-NTP-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function createBoard(request: APIRequestContext, token: string, wsId: string): Promise<string> {
  const res = await request.post(`${API_URL}/api/v1/workspaces/${wsId}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `Board-NTP-${Date.now()}` },
  });
  const body = await res.json() as { data: { id: string } };
  return body.data.id;
}

async function goToBoard(page: Page, boardId: string, creds: Credentials) {
  await page.goto(`${UI_URL}/login`);
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${UI_URL}/workspaces**`, { timeout: 15000 });
  await page.goto(`${UI_URL}/boards/${boardId}`);
  await page.waitForLoadState('networkidle');
}

async function openBoardSettings(page: Page) {
  // Click the "···" board header menu
  await page.click('button[aria-label="Board settings"]');
  // Click "Board settings" in the dropdown
  await page.click('button:has-text("Board settings")');
  // Wait for settings panel
  await page.waitForSelector('[role="dialog"][aria-label="Board Settings"]', { timeout: 10000 });
}

async function closeSettings(page: Page) {
  // Click close button inside panel
  await page.click('button[aria-label="Close settings panel"]');
  await page.waitForSelector('[role="dialog"][aria-label="Board Settings"]', {
    state: 'detached',
    timeout: 5000,
  });
}

test.describe('BoardNotificationTypePreferences', () => {
  test('notification type preferences component works correctly', async ({ page, request }) => {
    // ── Setup: register user, create workspace + board ─────────────────────
    const creds = await registerAndLogin(request, 'ntp');
    const wsId = await createWorkspace(request, creds.token);
    const boardId = await createBoard(request, creds.token, wsId);

    // ── Step 1: Login and navigate to board ───────────────────────────────
    await goToBoard(page, boardId, creds);
    await page.screenshot({ path: 'test-screenshots-tmp/step-1-board-page.png' });

    // ── Step 2: Open board settings ───────────────────────────────────────
    await openBoardSettings(page);
    await page.screenshot({ path: 'test-screenshots-tmp/step-2-settings-open.png' });

    // ── Step 3: Verify "User settings" section ────────────────────────────
    const panel = page.locator('[role="dialog"][aria-label="Board Settings"]');

    // 3a. "Board notification preferences" heading
    const prefHeading = panel.locator('span:has-text("Board notification preferences")');
    await expect(prefHeading).toBeVisible();

    // 3b. Toggle switches (button[role="switch"])
    const switches = panel.locator('button[role="switch"]');
    const switchCount = await switches.count();
    console.log(`Found ${switchCount} toggle switches`);
    expect(switchCount).toBeGreaterThan(0);

    // 3c. "Reset to defaults" button
    const resetBtn = panel.locator('button:has-text("Reset to defaults")');
    await expect(resetBtn).toBeVisible();

    await page.screenshot({ path: 'test-screenshots-tmp/step-3-user-settings-verified.png' });

    // ── Step 4: Toggle first notification type switch OFF ─────────────────
    const firstSwitch = switches.first();
    const ariaLabelBefore = await firstSwitch.getAttribute('aria-label');
    const ariaCheckedBefore = await firstSwitch.getAttribute('aria-checked');
    console.log(`Switch "${ariaLabelBefore}" aria-checked before: ${ariaCheckedBefore}`);

    // Default is ON (opt-out model); click once to turn OFF
    await firstSwitch.click();
    await page.waitForTimeout(800); // wait for API save

    const ariaCheckedAfterToggle = await firstSwitch.getAttribute('aria-checked');
    console.log(`Switch aria-checked after toggle: ${ariaCheckedAfterToggle}`);

    // Should have changed from its initial state
    expect(ariaCheckedAfterToggle).not.toBe(ariaCheckedBefore);

    await page.screenshot({ path: 'test-screenshots-tmp/step-4-after-toggle.png' });

    // ── Step 5: Close and reopen settings, verify state persists ──────────
    await closeSettings(page);
    await page.screenshot({ path: 'test-screenshots-tmp/step-5-settings-closed.png' });

    await openBoardSettings(page);
    await page.screenshot({ path: 'test-screenshots-tmp/step-5-settings-reopened.png' });

    const switchesAfterReopen = page.locator('[role="dialog"][aria-label="Board Settings"] button[role="switch"]');
    const firstSwitchAfterReopen = switchesAfterReopen.first();
    // Wait for the preferences to load
    await page.waitForTimeout(500);
    const persistedValue = await firstSwitchAfterReopen.getAttribute('aria-checked');
    console.log(`Switch aria-checked after close/reopen: ${persistedValue}`);
    expect(persistedValue).toBe(ariaCheckedAfterToggle);

    await page.screenshot({ path: 'test-screenshots-tmp/step-5-state-persists.png' });

    // ── Step 6: Check indigo ring on board-override switch ────────────────
    const switchClass = await firstSwitchAfterReopen.getAttribute('class');
    console.log(`Switch class: ${switchClass}`);
    const hasIndigoRing = switchClass?.includes('ring-indigo') ?? false;
    console.log(`Has indigo ring (board override indicator): ${hasIndigoRing}`);
    expect(hasIndigoRing).toBe(true);

    await page.screenshot({ path: 'test-screenshots-tmp/step-6-indigo-ring.png' });

    // ── Step 7: Reset to defaults ─────────────────────────────────────────
    const resetBtnInPanel = page.locator('[role="dialog"][aria-label="Board Settings"] button:has-text("Reset to defaults")');
    await resetBtnInPanel.click();

    // Confirmation step: "Reset board overrides?"
    const confirmBtn = page.locator('[role="dialog"][aria-label="Board Settings"] button:has-text("Reset board overrides?")');
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: 'test-screenshots-tmp/step-7-reset-confirm.png' });

    await confirmBtn.click();
    await page.waitForTimeout(1000); // wait for reset API call

    // After reset, indigo ring should be gone (no board override)
    const switchesAfterReset = page.locator('[role="dialog"][aria-label="Board Settings"] button[role="switch"]');
    const firstSwitchAfterReset = switchesAfterReset.first();
    const classAfterReset = await firstSwitchAfterReset.getAttribute('class');
    console.log(`Switch class after reset: ${classAfterReset}`);
    const hasIndigoRingAfterReset = classAfterReset?.includes('ring-indigo') ?? false;
    console.log(`Has indigo ring after reset: ${hasIndigoRingAfterReset}`);
    expect(hasIndigoRingAfterReset).toBe(false);

    await page.screenshot({ path: 'test-screenshots-tmp/step-7-after-reset.png' });

    // ── Step 8: Confirm no errors ─────────────────────────────────────────
    const errorEl = page.locator('[role="dialog"][aria-label="Board Settings"] .text-red-400');
    const errorCount = await errorEl.count();
    console.log(`Error elements visible: ${errorCount}`);
    expect(errorCount).toBe(0);

    await page.screenshot({ path: 'test-screenshots-tmp/step-8-no-errors.png' });
  });
});
