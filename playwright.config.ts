import { defineConfig } from '@playwright/test';

export default defineConfig({
  // testMatch scoped to *.spec.ts only — keeps bun:test files out of Playwright
  testMatch: /.*\.spec\.(ts|js)$/,
  timeout: 60000,
  retries: 0,
  reporter: [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3000',
  },
  projects: [
    { name: 'e2e', testDir: './tests/e2e' },
  ],
});
