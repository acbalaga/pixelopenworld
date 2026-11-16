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

export default defineConfig({
  plugins: [cloudflare()],
  define: { __APP_VERSION__: JSON.stringify(gitSha()) },
  build: { target: 'es2022', sourcemap: false },
});
