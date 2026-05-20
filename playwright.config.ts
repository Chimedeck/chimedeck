import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Keep Playwright scoped to e2e directories while discovering both *.spec and *.test files.
  testMatch: /.*\.(spec|test)\.(ts|js)$/,
  timeout: 60000,
  retries: 0,
  reporter: [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3000',
  },
  projects: [
    { name: 'e2e', testDir: './tests/e2e', testMatch: /.*\.(spec|test)\.(ts|js)$/ },
  ],
});
