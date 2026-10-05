// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const phoneTests = { testIgnore: /content\.spec\.js/ };

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // More than 2 parallel WebKit (iPhone) sessions exhausts memory on Windows.
  workers: 2,
  retries: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'node tests/serve.js',
    url: 'http://localhost:4175',
    env: { PORT: '4175' },
    reuseExistingServer: true
  },
  use: {
    baseURL: 'http://localhost:4175',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry'
  },
  projects: [
    // Content checks need no browser, so they run once.
    { name: 'content', testMatch: /content\.spec\.js/ },
    { name: 'android-chrome', use: { ...devices['Pixel 7'] }, ...phoneTests },
    { name: 'iphone-safari', use: { ...devices['iPhone 14'] }, ...phoneTests },
    { name: 'small-iphone', use: { ...devices['iPhone SE'] }, ...phoneTests }
  ]
});
