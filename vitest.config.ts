import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests do not boot the Cloudflare plugin.
export default defineConfig({
  define: {
    __SEAL_ENV__: JSON.stringify(''),
    __APP_VERSION__: JSON.stringify('test'),
    __BUILD_TIME__: JSON.stringify('01-01 00:00'),
  },
  // The bake test files run the whole asset bake, which takes a few seconds on a slow runner.
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
});
