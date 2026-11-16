// Fails if the gzip size of boot JS exceeds the budget in tools/budgets.json.
// Boot JS = JS files referenced from dist/index.html (script and modulepreload).
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.DIST_DIR ?? join(root, 'dist');
const budgets = JSON.parse(readFileSync(join(root, 'tools', 'budgets.json'), 'utf8'));
const limit = Number(process.env.BOOT_JS_BUDGET ?? budgets.bootJsGzipBytes);

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = new Set();
for (const m of html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+\.js)"/g)) {
  files.add(m[1].replace(/^\//, ''));
}
if (files.size === 0) {
  console.error('check-bundle: no boot JS found in dist/index.html');
  process.exit(1);
}

let total = 0;
for (const f of files) {
  const p = join(dist, f);
  if (!existsSync(p)) {
    console.error(`check-bundle: ${f} referenced but missing`);
    process.exit(1);
  }
  const size = gzipSync(readFileSync(p)).length;
  total += size;
  console.log(`${f}: ${size} B gzip`);
}
console.log(`boot JS total: ${total} B gzip, budget ${limit} B`);
if (total > limit) {
  console.error(
    `check-bundle: FAIL over budget by ${total - limit} B. Files: ${[...files].join(', ')}`,
  );
  process.exit(1);
}
