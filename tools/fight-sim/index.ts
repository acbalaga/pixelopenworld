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
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { BUILDS } from './builds';
import { DEVIATIONS } from './deviations';
import { fight, type FightResult } from './harness';
import { BANDS, PAR_TIER, ROLES, TARGETS } from './targets';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const SEEDS = Number(arg('--seeds') ?? 20);
const OUT = arg('--out') ?? 'reports/fight-sim.md';
const thresholds = JSON.parse(readFileSync('tools/balance-thresholds.json', 'utf8')) as {
  fightSim: {
    maxDeathPct: number;
    maxDeviationsUnlisted: number;
    preparedPackMaxDeathPct: number;
    unpreparedPackMinDeathPct: number;
    toleranceSec: number;
  };
};

const par = SKILLS_BALANCE.challenge.parRank;
const TIERS = [1, 2] as const;

interface Cell {
  build: string;
  tier: 1 | 2;
  rank: number;
  creature: string;
  /** How many creatures stand at once. */
  count: number;
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

/** How many of a creature a spawner keeps standing together: the pack a player meets. */
const packOf = (creature: string): number =>
  Math.max(
    1,
    ...Object.values(SPAWNERS)
      .filter((sp) => sp.creature === creature)
      .map((sp) => sp.cap),
  );

const cells: Cell[] = [];
const cell = (b: (typeof BUILDS)[number], tier: 1 | 2, creature: string, count: number): void => {
  const rank = par[tier] as number;
  const results = Array.from({ length: SEEDS }, (_, i) =>
    fight(b, tier, rank, creature, i + 1, count),
  );
  const won = results.filter((r) => r.ttk !== null).map((r) => r.ttk as number);
  cells.push({
    build: b.id,
    tier,
    rank,
    creature,
    count,
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
};
for (const b of BUILDS)
  for (const tier of TIERS)
    for (const creature of TARGETS) {
      cell(b, tier, creature, 1);
      // A tier 2 creature is met in a pack, by the prepared and by the unprepared.
      if (CREATURES[creature]?.tier === 2 && packOf(creature) > 1)
        cell(b, tier, creature, packOf(creature));
    }

const parTierOf = (creature: string): 1 | 2 =>
  PAR_TIER[creature] ?? ((CREATURES[creature]?.tier ?? 1) >= 2 ? 2 : 1);

/** The cells the time-to-kill targets apply to: one creature, met by a build at its par tier. */
const atPar = (c: Cell): boolean => c.count === 1 && c.tier === parTierOf(c.creature);
/** A pack of tier 2 creatures met by a character with tier 1 gear at rank 0. */
const unprepared = (c: Cell): boolean => c.count > 1 && c.tier === 1;
/** The same pack met with tier 2 gear at rank 15. */
const preparedPack = (c: Cell): boolean => c.count > 1 && c.tier === 2;
/** Inside the band, give or take the tolerance: a median of a spread, not a stopwatch. */
const inBand = (c: Cell): boolean => {
  const [lo, hi] = BANDS[ROLES[c.creature] as keyof typeof BANDS];
  const tol = thresholds.fightSim.toleranceSec;
  return c.median !== null && c.median >= lo - tol && c.median <= hi + tol;
};
const listed = (c: Cell): string | undefined => DEVIATIONS[`${c.build}|${c.creature}`];

const label = (id: string): string => BUILDS.find((b) => b.id === id)?.label ?? id;
const name = (id: string): string => CREATURES[id]?.name ?? id;
const f1 = (n: number | null): string => (n === null ? 'never' : n.toFixed(1));

const section = (tier: 1 | 2): string => {
  const rows = cells
    .filter((c) => c.tier === tier && c.count === 1)
    .map((c) => {
      const role = ROLES[c.creature] as keyof typeof BANDS;
      const [lo, hi] = BANDS[role];
      const verdict = !atPar(c) ? 'n/a' : inBand(c) ? 'ok' : listed(c) ? 'listed' : 'DEVIATION';
      return `| ${label(c.build)} | ${name(c.creature)} (${role}) | ${f1(c.median)} | ${f1(c.p90)} | ${lo} to ${hi} | ${c.damage.toFixed(0)} | ${c.sta.toFixed(0)} | ${c.foc.toFixed(0)} | ${c.eaten.toFixed(1)} | ${c.deaths} | ${verdict} |`;
    });
  return [
    '| Build | Creature | TTK median s | TTK p90 s | Target s | Damage taken | Stamina | Focus | Food | Deaths | At par |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
};

/** A listed deviation whose cell is back in its band is stale and must go. */
const stale = Object.keys(DEVIATIONS).filter((k) =>
  cells.some((c) => atPar(c) && `${c.build}|${c.creature}` === k && inBand(c)),
);
const deviations = cells.filter((c) => atPar(c) && !inBand(c));
const unlisted = deviations.filter((c) => !listed(c));
const deaths = cells.reduce((n, c) => n + c.deaths, 0);
/** Deaths of a prepared character against one common creature: the fight a player is meant to win. */
const parCommon = cells.filter((c) => atPar(c) && ROLES[c.creature] === 'common');
const commonDeaths = parCommon.reduce((n, c) => n + c.deaths, 0);
const commonFights = parCommon.reduce((n, c) => n + c.results.length, 0);
const fights = cells.reduce((n, c) => n + c.results.length, 0);
const tier2Creatures = Object.values(CREATURES).filter((c) => c.tier === 2).length;
const deathPctOf = (cs: Cell[]): number => {
  const n = cs.reduce((a, c) => a + c.results.length, 0);
  return n === 0 ? 0 : (cs.reduce((a, c) => a + c.deaths, 0) / n) * 100;
};
const packDeaths = {
  prepared: deathPctOf(cells.filter(preparedPack)),
  unprepared: deathPctOf(cells.filter(unprepared)),
};
const packTable = (pick: (c: Cell) => boolean): string => {
  const rows = cells
    .filter(pick)
    .map(
      (c) =>
        `| ${label(c.build)} | ${name(c.creature)} x${c.count} | ${f1(c.median)} | ${c.damage.toFixed(0)} | ${c.eaten.toFixed(1)} | ${((c.deaths / c.results.length) * 100).toFixed(0)}% |`,
    );
  return [
    '| Build | Pack | TTK median s | Damage taken | Food | Fell |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
};

const md = `# Fight simulator report

Made by \`npm run fight-sim\` (POW-M3-12). Do not edit by hand. Headless fights on the real sim: ${SEEDS} seeds per cell, ${fights} fights. The avatar stands at the start of a fight with the creatures a tile or so away. The policy is the same for every build: lock the nearest, close in, swing, cast the best affordable spell, eat when hurt, and dodge a blow as its telegraph runs out (\`tools/fight-sim/harness.ts\`). The seed varies the starting distance and the first swing, so each cell is a spread.

- Par ranks (\`balance/skills.ts\`): tier 1 is ${par[1]}, tier 2 is ${par[2]}. Each build wears the best gear of its tier the content has. Mages carry Focus potions and everyone carries bread; both count under Food. Every family has a tier 2 weapon.
- Targets (design/04): common 4 to 8 s, elite 20 to 40 s, miniboss 60 to 90 s, regional boss 180 to 300 s, with 0.75 s of give on either side for a median of a spread. Targets are checked at par: a build of the creature's own tier against one creature. The cave miniboss is the gate out of the first map, so it is met by a tier 2 build (rank ${par[2]}, tier 2 gear).
- **Outside the first map.** The ${tier2Creatures} tier 2 creatures belong to Whisperwood (\`content/world/regions.ts\`), which has no map yet. They are tuned for rank ${par[2]} and tier 2 gear, and they are not kind to anyone else: see the packs below.
- **Gaps between builds are accepted** (owner decision). A family that loses a pack fight that another wins is not a defect: each build is meant to help somewhere in its progression, and these tables show where it does not yet. The thresholds bound the average, not each family.
- Damage taken is Health lost. Stamina and Focus are whole points spent. Fell is the share of fights where the avatar went down before the creatures did.

**At par:** ${cells.filter(atPar).length - deviations.length} of ${cells.filter(atPar).length} cells are inside their target band. ${deviations.length} are outside: ${deviations.length - unlisted.length} listed with a reason, ${unlisted.length} unlisted. A prepared character fell in ${commonDeaths} of ${commonFights} fights against one common creature. Against a pack, prepared builds fell in ${packDeaths.prepared.toFixed(0)}% of fights and unprepared ones (tier 1 gear, rank ${par[1]}) in ${packDeaths.unprepared.toFixed(0)}%. ${deaths} of ${fights} fights over all ended in a fall.

## Tier 1 (par rank ${par[1]})

${section(1)}

## Tier 2 (par rank ${par[2]})

${section(2)}

## Packs: prepared (tier 2 builds, rank ${par[2]})

A pack is as many as the creature's spawner keeps standing together.

${packTable(preparedPack)}

## Packs: unprepared (tier 1 builds, rank ${par[1]})

The first map does not make a character ready by itself. These are what the outside does to one who walks out without the rank and the gear.

${packTable(unprepared)}

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
  if (stale.length > 0) bad.push(`listed deviations that are now in band: ${stale.join(', ')}`);
  const f = thresholds.fightSim;
  if (packDeaths.prepared > f.preparedPackMaxDeathPct)
    bad.push(
      `prepared builds fell in ${packDeaths.prepared.toFixed(0)}% of pack fights (limit ${f.preparedPackMaxDeathPct}%): not killable enough`,
    );
  if (packDeaths.unprepared < f.unpreparedPackMinDeathPct)
    bad.push(
      `unprepared builds fell in only ${packDeaths.unprepared.toFixed(0)}% of pack fights (at least ${f.unpreparedPackMinDeathPct}% expected): the outside is too kind`,
    );
  if (bad.length > 0) {
    console.error(`fight-sim: FAILED\n- ${bad.join('\n- ')}`);
    process.exit(1);
  }
  console.log('fight-sim: within thresholds');
}
