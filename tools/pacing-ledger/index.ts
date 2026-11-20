// CLI: `tsx tools/pacing-ledger/index.ts [--check] [--bump] [--no-write] [--out PATH]`.
// Sums authored `estMinutes` by category and region (POW-M4-12), writes `reports/pacing-ledger.md`
// and, with `--check`, fails when a region is under its floor or (once enforced) its budget.
// `--bump` raises each region's floor to what it has now. The floor never goes down by itself.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PACING_LABELS } from '../../src/content/balance/pacing';
import { check, collectItems, sum, type Floor } from './ledger';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const OUT = arg('--out') ?? 'reports/pacing-ledger.md';
const FLOOR_FILE = 'tools/pacing-floor.json';

const { items, problems } = collectItems();
const ledgers = sum(items);
const floor = JSON.parse(readFileSync(FLOOR_FILE, 'utf8')) as Floor;

const hours = (m: number): string => `${(m / 60).toFixed(1)} h`;
const pct = (a: number, b: number): string => (b === 0 ? 'n/a' : `${Math.round((a / b) * 100)}%`);

const md = `# Pacing ledger

Made by \`npm run pacing\` (POW-M4-12). Do not edit by hand. Sums the \`estMinutes\` of every authored piece of content by category and region, against the budget in \`src/content/balance/pacing.ts\` (regions/01-dawnmeadow section 14, design/10). Estimates are planning numbers; the sim bot and owner playtests measure the real time.

${ledgers
  .map((l) => {
    const f = floor[l.region];
    return `## ${l.region}

**${l.minutes} of ${l.budgetMinutes} minutes** (${pct(l.minutes, l.budgetMinutes)}, ${hours(l.minutes)} of ${hours(l.budgetMinutes)}). Floor ${f?.minutes ?? 'unset'}. Budget enforced: ${f?.enforceBudget ? 'yes' : 'not yet'}.

| Category | Authored | Budget | Minutes | Budget minutes | Done |
| --- | --- | --- | --- | --- | --- |
${l.rows
  .map(
    (r) =>
      `| ${PACING_LABELS[r.category]} | ${r.count} | ${r.budgetCount === 0 ? 'n/a' : r.budgetCount} | ${r.minutes} | ${r.budgetMinutes} | ${pct(r.minutes, r.budgetMinutes)} |`,
  )
  .join('\n')}
`;
  })
  .join('\n')}
${problems.length > 0 ? `## Problems\n\n${problems.map((p) => `- ${p}`).join('\n')}\n` : ''}`;

if (process.argv.includes('--bump')) {
  for (const l of ledgers) {
    const f = (floor[l.region] ??= { minutes: 0, enforceBudget: false });
    if (l.minutes > f.minutes) f.minutes = l.minutes;
  }
  writeFileSync(FLOOR_FILE, `${JSON.stringify(floor, null, 2)}\n`);
}
if (!process.argv.includes('--no-write')) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md);
}
console.log(md);

if (process.argv.includes('--check')) {
  const bad = [...problems, ...check(ledgers, floor)];
  if (bad.length > 0) {
    console.error(`pacing-ledger: FAILED\n- ${bad.join('\n- ')}`);
    process.exit(1);
  }
  console.log('pacing-ledger: within floor');
}
