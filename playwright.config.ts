import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs/tests',
  testMatch: /.*\.(test|spec)\.(ts|js)$/,
  timeout: 60000,
  retries: 0,
  reporter: [['line']],
});
