// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 6_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'Frontend - Desktop Chrome',
      testMatch: 'tests/frontend/**/*.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Frontend - Mobile Chrome',
      testMatch: 'tests/frontend/**/*.spec.js',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Backend API & WebSocket',
      testMatch: 'tests/backend/**/*.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
