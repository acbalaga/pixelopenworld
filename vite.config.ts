import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

function gitSha(): string {
  const env = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (env) return env.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

/**
 * Optional hardening (tech/02, off by default): `POW_SEAL_MATERIAL` holds the seal material as
 * JSON, `{"current":2,"versions":{"1":["hex",...],"2":[...]}}` with four hex fragments per
 * version. When set, the build uses it instead of the committed modules under src/save/seal/,
 * and those modules are left out of the bundle. See docs/ops/deploy.md.
 */
function sealEnv(): string {
  const raw = process.env.POW_SEAL_MATERIAL;
  if (!raw) return '';
  JSON.parse(raw); // fail the build now, not in a player's browser
  return raw;
}

export default defineConfig({
  plugins: [cloudflare()],
  define: {
    __SEAL_ENV__: JSON.stringify(sealEnv()),
    __APP_VERSION__: JSON.stringify(gitSha()),
    // UTC, to the minute, so a refreshed page can be told apart from a stale one.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(5, 16).replace('T', ' ')),
  },
  build: { target: 'es2022', sourcemap: false },
});
