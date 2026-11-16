import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests do not boot the Cloudflare plugin.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: { include: ['tests/**/*.test.ts'] },
});
