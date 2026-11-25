import { defineConfig, devices } from '@playwright/test';

const PROD = 'http://127.0.0.1:4173';
const DEV = 'http://127.0.0.1:5173';
const mobile = devices['Pixel 5'];

// Two projects. `smoke` runs against the production build served by `vite preview` (the Worker
// and static assets exactly as shipped). `dev-tools` runs against the dev server, because the
// dev pages and overlay do not exist in the production build.
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { ...mobile, trace: 'off', video: 'off' },
  projects: [
    {
      name: 'smoke',
      testMatch:
        /(smoke|menu|slice|talk|save|frontend|secure|backup|time|pwa|hardening|requests|actionMeter|temperament|messages|menuParts|setupV2|streamingOffline|map)\.spec\.ts/,
      use: { baseURL: PROD },
    },
    {
      name: 'dev-tools',
      testMatch:
        /(devtools|requestsHandIn|stationSheet|sliceRun|streaming|weather|dawnmeadow|waystone|rootway|travelers|rankings|restPoint)\.spec\.ts/,
      use: { baseURL: DEV },
    },
  ],
  webServer: [
    {
      command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
      url: `${PROD}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5173 --strictPort',
      url: `${DEV}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
