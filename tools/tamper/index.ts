/**
 * `npm run tamper -- <file.powsave> [second.powsave]`, or `npm run tamper -- --sample`.
 *
 * Applies the common hand-edit attempts to an export and shows that each is refused, then shows
 * that a deliberate edit sealed again with the real key imports but is marked Flagged. Exits 1
 * if any blind edit gets through or the re-sealed edit is not flagged. See docs/ops/gate-g2.md.
 */
import { readFileSync } from 'node:fs';

// The seal source reads a build-time constant that Vite defines. Outside Vite it is empty, which
// selects the committed material, exactly as in a normal build.
(globalThis as { __SEAL_ENV__?: string }).__SEAL_ENV__ = '';

const { runBattery } = await import('./lib');
const { sealSave } = await import('../../src/save/powsave');
const { honestPlain } = await import('../../tests/support/saves');

const args = process.argv.slice(2);
let file: Uint8Array;
let other: Uint8Array | undefined;
if (args[0] === '--sample') {
  file = await sealSave(honestPlain());
  console.log('Using a sample export of an honest 100 second game.\n');
} else if (args[0]) {
  file = new Uint8Array(readFileSync(args[0]));
  other = args[1] ? new Uint8Array(readFileSync(args[1])) : undefined;
} else {
  console.error('usage: npm run tamper -- <file.powsave> [second.powsave]   (or --sample)');
  process.exit(2);
}

const outcomes = await runBattery(file, other);
const width = Math.max(...outcomes.map((o) => o.name.length));
for (const o of outcomes)
  console.log(`${o.ok ? 'ok  ' : 'FAIL'}  ${o.name.padEnd(width)}  ${o.detail}`);
const bad = outcomes.filter((o) => !o.ok);
console.log(
  bad.length === 0
    ? `\n${outcomes.length} checks: every blind edit was refused, and the re-sealed edit was flagged.`
    : `\n${bad.length} of ${outcomes.length} checks failed.`,
);
process.exit(bad.length === 0 ? 0 : 1);
