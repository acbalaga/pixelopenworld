import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests do not boot the Cloudflare plugin.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  // The bake test files run the whole asset bake, which takes a few seconds on a slow runner.
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
});
