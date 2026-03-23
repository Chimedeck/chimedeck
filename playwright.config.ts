import { defineConfig } from '@playwright/test';

export default defineConfig({
  // testMatch scoped to *.spec.ts only — keeps bun:test files (specs/tests/board.test.ts) out of Playwright
  testMatch: /.*\.spec\.(ts|js)$/,
  timeout: 60000,
  retries: 0,
  reporter: [['line']],
  projects: [
    { name: 'e2e', testDir: './tests/e2e' },
    { name: 'specs', testDir: './specs/tests' },
  ],
});
