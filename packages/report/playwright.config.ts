import { defineConfig } from '@playwright/test';

const port = Number(process.env.CPQ_E2E_PORT ?? 3590);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  webServer: {
    command: `node packages/report/e2e/server.mjs`,
    cwd: '../..',
    port,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { CPQ_E2E_PORT: String(port) },
  },
});
