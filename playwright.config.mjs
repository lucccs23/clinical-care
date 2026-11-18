import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', testDir: 'tests', use: { ...devices['Desktop Chrome'] } },
    { name: 'verify', testDir: '.claude/skills/verify', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node scripts/build.mjs && node scripts/serve.mjs',
    url: baseURL,
    reuseExistingServer: false,
  },
});
