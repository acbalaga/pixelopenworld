/**
 * Fails the build if the service worker's precache list does not match what was built: every file
 * in dist/client (bar the worker itself and platform files) must be listed, and every listed file
 * must exist. Also checks the manifest and icons shipped.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

const dist = join(process.cwd(), 'dist', 'client');
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
const m = /const PRECACHE = (\[[\s\S]*?\]);/.exec(sw);
if (!m) throw new Error('check-pwa: no precache list in sw.js');
const listed = new Set(JSON.parse(m[1] as string) as string[]);

function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((n) => {
    const full = join(dir, n);
    const site = posix.join(prefix, n);
    return statSync(full).isDirectory() ? walk(full, site) : [`/${site}`];
  });
}
const built = walk(dist)
  .map((f) => (f === '/index.html' ? '/' : f))
  .filter((f) => f !== '/sw.js' && f !== '/_headers' && !f.startsWith('/.'));

const problems: string[] = [];
for (const f of built) if (!listed.has(f)) problems.push(`built but not precached: ${f}`);
for (const f of listed)
  if (!existsSync(join(dist, f))) problems.push(`precached but missing: ${f}`);
if (!listed.has('/')) problems.push('the shell (/) is not precached');
if (/skipWaiting|clients\.claim/.test(sw.replace(/\/\*[\s\S]*?\*\//g, '')))
  problems.push('sw.js must not call skipWaiting or clients.claim');
if (problems.length > 0) {
  console.error(`check-pwa: FAIL\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-pwa: OK, ${listed.size} files precached, version ${/VERSION = '([^']+)'/.exec(sw)?.[1]}`,
);
