import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
});
