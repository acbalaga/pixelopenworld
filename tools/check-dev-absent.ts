// Fails if the production client bundle contains anything from src/dev (dev overlay, dev pages).
// Dev code is reachable only behind `import.meta.env.DEV`, which the production build removes.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Strings that exist only in dev modules. Any hit in a production file is a leak. */
export const DEV_MARKERS: readonly string[] = [
  'pow-dev-',
  '/dev/sprites',
  '/dev/audio',
  '/dev/map',
  'dev-page',
  'src/dev/',
];

const TEXT = /\.(js|mjs|css|html|map|json|txt)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Returns one message per leaked marker or dev-named file under `dir`. */
export function findDevLeaks(dir: string): string[] {
  const leaks: string[] = [];
  for (const file of walk(dir)) {
    const rel = relative(dir, file);
    if (/(^|\/)dev(\/|\.|-)/.test(rel)) leaks.push(`${rel}: dev-named file`);
    if (!TEXT.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of DEV_MARKERS) if (text.includes(m)) leaks.push(`${rel}: contains "${m}"`);
  }
  return leaks;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = process.env.DIST_DIR ?? join(root, 'dist', 'client');
  const files = walk(dist).length;
  const leaks = findDevLeaks(dist);
  if (leaks.length > 0) {
    console.error(`check-dev-absent: FAIL, dev code in production bundle\n  ${leaks.join('\n  ')}`);
    process.exit(1);
  }
  console.log(
    `check-dev-absent: OK, scanned ${files} files in ${relative(root, dist)}, no dev code`,
  );
}
