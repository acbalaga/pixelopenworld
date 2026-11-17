import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
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

/** Every file under `public/` except the headers file, as site paths. */
function publicFiles(dir = 'public', prefix = ''): string[] {
  return readdirSync(dir).flatMap((n) => {
    const full = join(dir, n);
    const site = posix.join(prefix, n);
    if (statSync(full).isDirectory()) return publicFiles(full, site);
    return n === '_headers' ? [] : [`/${site}`];
  });
}

/**
 * Writes `/sw.js` from `src/platform/pwa/sw.js` with the precache list filled in: the page, every
 * emitted asset, and the icons and manifest from `public/`. The cache name carries a hash of the
 * list, so any change to a hashed file makes a new version.
 */
function serviceWorker(): Plugin {
  return {
    name: 'pow-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      if (this.environment?.name !== 'client') return;
      const urls = [
        '/',
        ...Object.keys(bundle)
          .filter(
            (f) =>
              f !== 'index.html' &&
              f !== 'sw.js' &&
              !f.endsWith('.map') &&
              !f.startsWith('.') &&
              f !== '_headers',
          )
          .map((f) => `/${f}`),
        ...publicFiles(),
      ].sort();
      const version = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync('src/platform/pwa/sw.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('/* __PRECACHE__ */ []', JSON.stringify(urls, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [cloudflare(), serviceWorker()],
  define: {
    __SEAL_ENV__: JSON.stringify(sealEnv()),
    __APP_VERSION__: JSON.stringify(gitSha()),
    // UTC, to the minute, so a refreshed page can be told apart from a stale one.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(5, 16).replace('T', ' ')),
  },
  build: { target: 'es2022', sourcemap: false },
});
