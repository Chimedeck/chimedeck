import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.(test|spec)\.(ts|js)$/,
  timeout: 60000,
  retries: 0,
  reporter: [['line']],
});
