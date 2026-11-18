/**
 * Fight simulator (POW-M3-12, `npm run fight-sim`). Runs data-defined fights on the real sim,
 * headless: each build at the par ranks of tiers 1 and 2 against every creature with a role, over
 * many seeds. Reports time-to-kill, damage taken and resources used, and writes
 * `reports/fight-sim.md`.
 *
 *   --seeds N     seeds per cell (default 20)
 *   --check       exit 1 when a number is past `tools/balance-thresholds.json`
 *   --out PATH    where to write the report (default reports/fight-sim.md)
 *   --no-write    print only
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SKILLS_BALANCE } from '../../src/content/balance/skills';
import { CREATURES } from '../../src/content/creatures';
import { BUILDS } from './builds';
import { DEVIATIONS } from './deviations';
import { fight, type FightResult } from './harness';
import { BANDS, ROLES, TARGETS } from './targets';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const SEEDS = Number(arg('--seeds') ?? 20);
const OUT = arg('--out') ?? 'reports/fight-sim.md';
const thresholds = JSON.parse(readFileSync('tools/balance-thresholds.json', 'utf8')) as {
  fightSim: { maxDeathPct: number; maxDeviationsUnlisted: number };
};

const par = SKILLS_BALANCE.challenge.parRank;
const TIERS = [1, 2] as const;

interface Cell {
  build: string;
  tier: 1 | 2;
  rank: number;
  creature: string;
  results: FightResult[];
  median: number | null;
  p90: number | null;
  damage: number;
  sta: number;
  foc: number;
  deaths: number;
  unwon: number;
  eaten: number;
}

const pct = (xs: number[], p: number): number | null => {
  if (xs.length === 0) return null;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((a.length * p) / 100))] as number;
};
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const cells: Cell[] = [];
for (const b of BUILDS)
  for (const tier of TIERS)
    for (const creature of TARGETS) {
      const rank = par[tier] as number;
      const results = Array.from({ length: SEEDS }, (_, i) =>
        fight(b, tier, rank, creature, i + 1),
      );
      const won = results.filter((r) => r.ttk !== null).map((r) => r.ttk as number);
      cells.push({
        build: b.id,
        tier,
        rank,
        creature,
        results,
        median: pct(won, 50),
        p90: pct(won, 90),
        damage: mean(results.map((r) => r.damage)),
        sta: mean(results.map((r) => r.staSpent)),
        foc: mean(results.map((r) => r.focSpent)),
        deaths: results.filter((r) => r.died).length,
        unwon: results.filter((r) => r.ttk === null && !r.died).length,
        eaten: mean(results.map((r) => r.eaten)),
      });
    }

/** The cells the targets apply to: a tier 1 build at its par rank against a tier 1 creature. */
const atPar = (c: Cell): boolean => c.tier === 1 && CREATURES[c.creature]?.tier === 1;
const inBand = (c: Cell): boolean => {
  const [lo, hi] = BANDS[ROLES[c.creature] as keyof typeof BANDS];
  return c.median !== null && c.median >= lo && c.median <= hi;
};
const listed = (c: Cell): string | undefined => DEVIATIONS[`${c.build}|${c.creature}`];

const label = (id: string): string => BUILDS.find((b) => b.id === id)?.label ?? id;
const name = (id: string): string => CREATURES[id]?.name ?? id;
const f1 = (n: number | null): string => (n === null ? 'never' : n.toFixed(1));

const section = (tier: 1 | 2): string => {
  const rows = cells
    .filter((c) => c.tier === tier)
    .map((c) => {
      const role = ROLES[c.creature] as keyof typeof BANDS;
      const [lo, hi] = BANDS[role];
      const verdict = !atPar(c) ? 'n/a' : inBand(c) ? 'ok' : listed(c) ? 'listed' : 'DEVIATION';
      return `| ${label(c.build)} | ${name(c.creature)} (${role}) | ${f1(c.median)} | ${f1(c.p90)} | ${lo} to ${hi} | ${c.damage.toFixed(0)} | ${c.sta.toFixed(0)} | ${c.foc.toFixed(0)} | ${c.eaten.toFixed(1)} | ${c.deaths} | ${verdict} |`;
    });
  return [
    '| Build | Creature | TTK median s | TTK p90 s | Target s | Damage taken | Stamina | Focus | Bread | Deaths | At par |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
};

const deviations = cells.filter((c) => atPar(c) && !inBand(c));
const unlisted = deviations.filter((c) => !listed(c));
const deaths = cells.reduce((n, c) => n + c.deaths, 0);
/** Deaths against common enemies only: a miniboss is a fight the policy is not built to win. */
const commonDeaths = cells
  .filter((c) => ROLES[c.creature] === 'common')
  .reduce((n, c) => n + c.deaths, 0);
const commonFights = cells
  .filter((c) => ROLES[c.creature] === 'common')
  .reduce((n, c) => n + c.results.length, 0);
const fights = cells.reduce((n, c) => n + c.results.length, 0);
const tier2Creatures = Object.values(CREATURES).filter((c) => c.tier === 2).length;

const md = `# Fight simulator report

Made by \`npm run fight-sim\` (POW-M3-12). Do not edit by hand. Headless fights on the real sim: ${SEEDS} seeds per cell, ${fights} fights. The avatar stands at the start of a fight with the creature one tile away. The policy is the same for every build: swing every tick, cast the best affordable spell, dodge on a fixed rhythm (\`tools/fight-sim/harness.ts\`). The seed varies the starting distance and the first swing, so each cell is a spread.

- Par ranks (\`balance/skills.ts\`): tier 1 is ${par[1]}, tier 2 is ${par[2]}. Each build wears the best gear of its tier the content has. Heavy Arms, Archery and Unarmed have no tier 2 weapon yet, so they wear their tier 1 weapon at both ranks.
- Targets (design/04): common 4 to 8 s, elite 20 to 40 s, miniboss 60 to 90 s, regional boss 180 to 300 s.
- **Tier 2.** The content has ${tier2Creatures} tier 2 creatures, so the tier 2 table shows each build at rank ${par[2]} against tier 1 creatures. It reads how much faster an over-par build kills, and the table gains real tier 2 rows the day a tier 2 creature is added with a role in \`tools/fight-sim/targets.ts\`. Targets are checked at par only: tier 1 builds against tier 1 creatures.
- Damage taken is Health lost. Stamina and Focus are whole points spent. Deaths are fights where the avatar fell first (of ${SEEDS}).

**At par:** ${cells.filter(atPar).length - deviations.length} of ${cells.filter(atPar).length} cells are inside their target band. ${deviations.length} are outside: ${deviations.length - unlisted.length} listed with a reason, ${unlisted.length} unlisted. Deaths: ${commonDeaths} of ${commonFights} fights against common enemies, ${deaths} of ${fights} over all.

## Tier 1 (par rank ${par[1]})

${section(1)}

## Tier 2 (par rank ${par[2]})

${section(2)}

## Listed deviations

${
  Object.keys(DEVIATIONS).length === 0
    ? 'None.'
    : Object.entries(DEVIATIONS)
        .map(([k, why]) => `- \`${k}\`: ${why}`)
        .join('\n')
}
`;

if (!process.argv.includes('--no-write')) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md);
}
console.log(md);

if (process.argv.includes('--check')) {
  const deathPct = (commonDeaths / commonFights) * 100;
  const bad: string[] = [];
  if (unlisted.length > thresholds.fightSim.maxDeviationsUnlisted)
    bad.push(`${unlisted.length} cells outside their time-to-kill band and not listed`);
  if (deathPct > thresholds.fightSim.maxDeathPct)
    bad.push(
      `${deathPct.toFixed(1)}% of fights ended in a death (limit ${thresholds.fightSim.maxDeathPct}%)`,
    );
  if (bad.length > 0) {
    console.error(`fight-sim: FAILED\n- ${bad.join('\n- ')}`);
    process.exit(1);
  }
  console.log('fight-sim: within thresholds');
}
