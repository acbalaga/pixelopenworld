/**
 * Production build checks (tech/02 "Client hardening", POW-M2-06), run after `npm run build`:
 * no source maps shipped or referenced, no development-only code, no inline script or style in
 * the page (the CSP forbids both), no eval-like calls, and no code that puts the game on `window`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

const dist = join(process.cwd(), 'dist', 'client');
if (!existsSync(dist)) throw new Error('check-prod: run npm run build first');

function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((n) => {
    const full = join(dir, n);
    const site = posix.join(prefix, n);
    return statSync(full).isDirectory() ? walk(full, site) : [site];
  });
}
const files = walk(dist);
const problems: string[] = [];

for (const f of files.filter((f) => f.endsWith('.map'))) problems.push(`source map shipped: ${f}`);

for (const f of files.filter((f) => /\.(js|css)$/.test(f))) {
  const text = readFileSync(join(dist, f), 'utf8');
  if (/sourceMappingURL/.test(text)) problems.push(`${f}: refers to a source map`);
  if (/\bnew Function\s*\(|\beval\s*\(/.test(text)) problems.push(`${f}: eval or new Function`);
  if (/\.js$/.test(f)) {
    // Game state is module scope. Nothing assigns the game, the sim or the save to window.
    for (const m of text.matchAll(
      /(?:window|globalThis|self)\.(__\w+|pow\w*|game|sim\w*|state)\s*=/g,
    ))
      problems.push(`${f}: puts ${m[1]} on the global object`);
    if (/src\/dev\//.test(text)) problems.push(`${f}: mentions src/dev/`);
  }
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
for (const m of html.matchAll(/<script\b([^>]*)>/g))
  if (!/\bsrc=/.test(m[1] as string)) problems.push('index.html: inline script');
if (/<style\b/.test(html)) problems.push('index.html: inline style element');
if (/\sstyle="/.test(html)) problems.push('index.html: inline style attribute');
if (/\son\w+=/.test(html)) problems.push('index.html: inline event handler');
if (/https?:\/\//.test(html)) problems.push('index.html: refers to another origin');

if (problems.length > 0) {
  console.error(`check-prod: FAIL\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `check-prod: OK, ${files.length} files, no source maps, no eval, no inline code, no globals`,
);
