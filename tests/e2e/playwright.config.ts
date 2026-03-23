import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.(test|spec)\.(ts|js)$/,
  timeout: 60000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
});
