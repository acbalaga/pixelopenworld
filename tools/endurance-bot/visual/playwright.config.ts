import { defineConfig, devices } from '@playwright/test';

// Visual endurance bot: the production build, served the way it ships, on a phone profile.
export default defineConfig({
  testDir: '.',
  outputDir: '../../../test-results/endurance',
  timeout: 30 * 60_000,
  workers: 1,
  reporter: [['list']],
  use: { ...devices['Pixel 5'], baseURL: 'http://127.0.0.1:4173', trace: 'off', video: 'off' },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
