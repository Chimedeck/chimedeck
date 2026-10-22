// Opt-in smoke proof for the local dev stack. Creates a retained local test account.
// Run with Bun from the checkout root; Chrome must be installed and push disabled.
import assert from 'node:assert/strict';
import { chmod, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'http://localhost:5173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
const account = {
  name: 'Local Push Tester',
  email: `push-${crypto.randomUUID()}@example.test`,
  password: `Local1-${crypto.randomUUID()}`,
};

try {
  await page.goto(`${base}/signup`);
  await page.locator('#signup-name').fill(account.name);
  await page.locator('#signup-email').fill(account.email);
  await page.locator('#signup-password').fill(account.password);
  await page.locator('#signup-confirm').fill(account.password);
  const signup = page.waitForResponse((response) =>
    response.url().endsWith('/api/v1/auth/register')
  );
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const registration = await signup;
  assert.equal(registration.status(), 201);
  const session = await registration.json();
  const token: string = session.data.accessToken;
  await page.waitForURL((url) => !url.pathname.includes('signup'));

  const api = async ({
    path,
    method = 'GET',
    body,
    authenticated = true,
  }: {
    path: string;
    method?: string;
    body?: unknown;
    authenticated?: boolean;
  }) =>
    page.evaluate(
      async ({ path, method, body, token }) => {
        const response = await fetch(`/api/v1/notifications${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: response.status, data: await response.json() };
      },
      { path, method, body, token: authenticated ? token : null }
    );

  assert.equal((await api({ path: '/unread-count', authenticated: false })).status, 401);
  assert.deepEqual(await api({ path: '/unread-count' }), {
    status: 200,
    data: { data: { count: 0 } },
  });
  assert.deepEqual(await api({ path: '/push-capabilities' }), {
    status: 200,
    data: { data: { development: false, production: false } },
  });
  assert.equal(
    (
      await api({
        path: '/devices',
        method: 'PUT',
        body: {
          id: crypto.randomUUID(),
          secret: crypto.randomUUID().repeat(2),
          token: 'synthetic-browser-verification-token',
          platform: 'android',
          environment: 'development',
        },
      })
    ).status,
    503
  );
  assert.equal(
    (await api({ path: `/devices/${crypto.randomUUID()}/revoke`, method: 'POST', body: null }))
      .status,
    400
  );

  await page
    .getByRole('button', { name: /notifications/i })
    .first()
    .click();
  await page
    .getByText(/no notifications/i)
    .first()
    .waitFor();
  await mkdir('.secrets', { recursive: true, mode: 0o700 });
  await Bun.write('.secrets/local-access.json', JSON.stringify({ url: base, ...account }, null, 2));
  await chmod('.secrets/local-access.json', 0o600);
  await page.screenshot({ path: '.secrets/mobile-push-browser.png', fullPage: true });

  // A fresh browser context proves real UI login rather than reusing the signup session.
  const loginContext = await browser.newContext();
  const login = await loginContext.newPage();
  await login.goto(`${base}/login`);
  await login.locator('#login-email').fill(account.email);
  await login.locator('#login-password').fill('incorrect-local-password');
  await login.getByRole('button', { name: 'Sign in', exact: true }).click();
  await login.getByRole('alert').waitFor();
  await login.locator('#login-password').fill(account.password);
  await login.getByRole('button', { name: 'Sign in', exact: true }).click();
  await login.waitForURL((url) => !url.pathname.includes('login'));
  await login.goto(`${base}/developer/api-docs`);
  await login.getByRole('heading', { name: 'API Docs', exact: true }).waitFor();
  const reference = await login.request.get(`${base}/api-docs/native-openapi.yaml`);
  assert.equal(reference.status(), 200);
  assert.ok((await reference.text()).includes('/notifications/push-capabilities:'));
  await login
    .locator('.opblock-summary-path')
    .filter({ hasText: '/notifications/push-capabilities' })
    .first()
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: browser signup, rejected/valid login, bell inbox, API reference rendering, authenticated count/capabilities, disabled sender, malformed revoke; no page errors.'
  );
  console.log(
    'Local-only login and screenshot saved under ignored .secrets/. No tokens or passwords printed.'
  );
} finally {
  await browser.close();
}
