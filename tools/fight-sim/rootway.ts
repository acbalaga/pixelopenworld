/**
 * Rootway scenarios (POW-M4-21, `npm run fight-sim:rootway`). Runs the cave's two fights on the
 * real sim, one after the other with Health and food carried over: the snare chamber (R5: three
 * Root Grubs, then a Bramble Boar) and, after a rest at the shortcut's rest spot (R7), Old
 * Bramblehide in the den (R8, two phases).
 *
 * Two characters go in: the bare kit (wooden dagger, ragged clothes, one bread, Blades 0) and
 * the target loadout (any weapon at rank 8, crafted tier 1 leather armor, three dishes). The
 * design asks for a win rate under 20% for the first and 65 to 80% for the second.
 *
 *   --seeds N     runs per build (default 40)
 *   --check       exit 1 when a rate is outside its band
 *   --out PATH    where to write the report (default reports/fight-sim-rootway.md)
 *   --no-write    print only
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MOVEMENT } from '../../src/content/balance/movement';
import { ROOTWAY } from '../../src/content/world/dungeons/rootway';
import { BUILDS } from './builds';
import { runScript, type Encounter, type ScriptResult } from './harness';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const SEEDS = Number(arg('--seeds') ?? 40);
const OUT = arg('--out') ?? 'reports/fight-sim-rootway.md';

/** The bands of POW-M4-21: win rates, in percent. */
export const BANDS = { bare: [0, 20], target: [65, 80] } as const;

/** R5, then R8 after a rest. */
const ROUTE: Encounter[] = [
  { creature: 'creature.root_grub', count: 3 },
  { creature: 'creature.bramble_boar', count: 1 },
  {
    creature: 'creature.old_bramblehide',
    count: 1,
    boss: 'boss.old_bramblehide',
    restBefore: true,
  },
];

/** Crafted tier 1 armor: the leather set. */
const LEATHER = ['item.cap_leather', 'item.jerkin_leather', 'item.chaps_leather'];
const RANK = 8;

interface Row {
  label: string;
  wins: number;
  runs: number;
  /** Fights lost in the snare chamber (R5) and in the den (R8). */
  fellR5: number;
  fellR8: number;
  /** Median seconds of a won run. */
  median: number | null;
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)] as number;
};

function run(label: string, make: (seed: number) => ScriptResult): Row {
  let wins = 0;
  let fellR5 = 0;
  let fellR8 = 0;
  const times: number[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = make(seed);
    const won = r.won === ROUTE.length;
    if (won) {
      wins++;
      times.push(r.seconds.reduce((a, b) => a + b, 0));
    } else if (r.died || r.ttk === null) {
      if (r.won < 2) fellR5++;
      else fellR8++;
    }
  }
  return { label, wins, runs: SEEDS, fellR5, fellR8, median: median(times) };
}

const blades = BUILDS.find((b) => b.id === 'blades')!;
const bare = run('Bare kit (wooden dagger, rags, one bread)', (seed) =>
  runScript({
    build: blades,
    tier: 1,
    rank: 0,
    seed,
    start: 'engaged',
    kit: 'bare',
    encounters: ROUTE,
  }),
);
const loadouts = BUILDS.map((b) =>
  run(`${b.label}, rank ${RANK}, leather, three dishes`, (seed) =>
    runScript({
      build: b,
      tier: 1,
      rank: RANK,
      seed,
      start: 'engaged',
      food: 3,
      armor: LEATHER,
      encounters: ROUTE,
    }),
  ),
);

/**
 * A clear time estimate (the ticket asks for a scripted clear of 12 to 18 minutes at the target
 * loadout). There is no bot that walks a dungeon, so the time is built from what is measured:
 * the fights of every room on the Root Hall route, run on the real sim in one go (the dark
 * gallery counted twice over, since its shooters are fought blind), the walk along the graph's
 * portals at the walk speed with a detour allowance, and a fixed time for what a person does with
 * their hands (the stump puzzle, reading each room, the rest at R7). The assumptions are in
 * \`ESTIMATE\` and are printed in the report.
 */
const ESTIMATE = {
  /** Walking is slower than a straight line: pillars, stumps and the odd wrong turn. */
  detour: 1.3,
  /** Seconds to read a room and choose a way, per room. */
  readRoomSec: 8,
  /** The stump puzzle in R6: two stumps pushed onto plates, the key, the chest. */
  puzzleSec: 90,
  /** The rest at R7, eating and re-reading the bar. */
  restSec: 20,
  /** Fighting Glowcaps in the dark gallery takes this many times the lit time. */
  darkFactor: 2,
};

/** The fights of the Root Hall route in order, each the creatures of a room. */
const FULL: { room: string; enc: Encounter }[] = [
  { room: 'r3a', enc: { creature: 'creature.mossling', count: 3 } },
  { room: 'r3a', enc: { creature: 'creature.mossling', count: 3 } },
  { room: 'r3a', enc: { creature: 'creature.spitbloom', count: 1 } },
  { room: 'r4', enc: { creature: 'creature.glowcap', count: 1 } },
  { room: 'r4', enc: { creature: 'creature.glowcap', count: 1 } },
  { room: 'r4', enc: { creature: 'creature.glowcap', count: 1 } },
  { room: 'r5', enc: { creature: 'creature.root_grub', count: 3 } },
  { room: 'r5', enc: { creature: 'creature.bramble_boar', count: 1 } },
  {
    room: 'r8',
    enc: {
      creature: 'creature.old_bramblehide',
      count: 1,
      boss: 'boss.old_bramblehide',
      restBefore: true,
    },
  },
];

/** Tiles walked from the mouth to the den along the Root Hall route, from the room graph. */
function walkTiles(): number {
  const route = ['r1', 'r2', 'r3a', 'r4', 'r5', 'r6', 'r7', 'r8'];
  const edge = (a: string, b: string) => ROOTWAY.edges.find((e) => e.from === a && e.to === b)!;
  let d = 6;
  for (let i = 0; i < route.length - 1; i++) {
    const out = edge(route[i]!, route[i + 1]!);
    const prev = i === 0 ? null : edge(route[i - 1]!, route[i]!);
    const from = prev ? prev.arrive : { x: 4, y: 6 };
    d += Math.hypot(out.at.x - from.x, out.at.y - from.y);
  }
  return d;
}

function clearEstimate(): {
  minutes: number;
  parts: Record<string, number>;
  fights: ScriptResult[];
} {
  const per: number[][] = FULL.map(() => []);
  const fights: ScriptResult[] = [];
  for (const b of BUILDS) {
    for (let seed = 1; seed <= Math.min(SEEDS, 20); seed++) {
      const r = runScript({
        build: b,
        tier: 1,
        rank: RANK,
        seed,
        start: 'engaged',
        food: 3,
        armor: LEATHER,
        encounters: FULL.map((f) => f.enc),
      });
      fights.push(r);
      // Only runs that got through count towards a clear.
      if (r.won === FULL.length) r.seconds.forEach((sec, i) => per[i]!.push(sec));
    }
  }
  const fightSec = (room: string): number =>
    FULL.reduce((n, f, i) => (f.room === room ? n + (median(per[i]!) ?? 0) : n), 0);
  const pxPerSec = (MOVEMENT.walkSpeed / 256) * 30;
  const walk = (walkTiles() * 16 * ESTIMATE.detour) / pxPerSec;
  const parts: Record<string, number> = {
    'fights, lit rooms (R3a, R5, R8)': fightSec('r3a') + fightSec('r5') + fightSec('r8'),
    [`fights, dark gallery (R4, x${ESTIMATE.darkFactor})`]: fightSec('r4') * ESTIMATE.darkFactor,
    'walking the portals': walk,
    'stump puzzle (R6)': ESTIMATE.puzzleSec,
    [`reading ${ROOTWAY_ROOMS_ON_ROUTE} rooms`]: ESTIMATE.readRoomSec * ROOTWAY_ROOMS_ON_ROUTE,
    'rest (R7)': ESTIMATE.restSec,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { minutes: total / 60, parts, fights };
}
const ROOTWAY_ROOMS_ON_ROUTE = 8;

const rate = (r: Row): number => (r.wins / r.runs) * 100;
const all = loadouts.reduce((n, r) => n + r.wins, 0);
const total = loadouts.reduce((n, r) => n + r.runs, 0);
const targetRate = (all / total) * 100;
const f1 = (n: number | null): string => (n === null ? 'n/a' : n.toFixed(1));

const est = clearEstimate();
const lost = est.fights.filter((r) => r.won < FULL.length);
const byRoom = new Map<string, number>();
for (const r of lost) byRoom.set(FULL[r.won]!.room, (byRoom.get(FULL[r.won]!.room) ?? 0) + 1);
const fellByRoom =
  [...byRoom.entries()].map(([room, n]) => `${room.toUpperCase()} ${n}`).join(', ') || 'none';
const fullWon = est.fights.filter((r) => r.won === FULL.length).length;
const estimateMd = `There is no bot that walks a dungeon, so this is built from measured parts, not a run (see the header of \`tools/fight-sim/rootway.ts\`). The whole Root Hall route as one script, target loadout, ${est.fights.length} runs: ${fullWon} cleared it (${((fullWon / est.fights.length) * 100).toFixed(0)}%).

| Part | Seconds |
| --- | --- |
${Object.entries(est.parts)
  .map(([k, v]) => `| ${k} | ${v.toFixed(0)} |`)
  .join('\n')}

**Estimated clear: ${est.minutes.toFixed(1)} minutes** for a character that does not fail and does not wander (design: 12 to 18 for a person). This line is informational: it is not held by \`--check\`.

Where the full Root Hall route is lost (runs that fell, by the room of the fight they fell in): ${fellByRoom}.`;

const md = `# Rootway fight simulator report

Made by \`npm run fight-sim:rootway\` (POW-M4-21). Do not edit by hand. ${SEEDS} runs per row on the real sim. Each run is the cave's two hard fights back to back: the snare chamber (R5: three Root Grubs, then a Bramble Boar) and, after a rest at the R7 rest spot, Old Bramblehide in the den (R8). Health and bread carry over between fights; the policy is the one of \`npm run fight-sim\`.

- **Bare kit** (wooden dagger, ragged clothes, one bread, Blades 0). Design: lost, under ${BANDS.bare[1]}% won.
- **Target loadout** (any weapon at rank ${RANK}, crafted tier 1 leather armor, three dishes). Design: ${BANDS.target[0]} to ${BANDS.target[1]}% won, taken over all eight builds.

**Bare kit:** ${rate(bare).toFixed(0)}% won (${bare.wins} of ${bare.runs}).
**Target loadout:** ${targetRate.toFixed(0)}% won over all builds (${all} of ${total}).

| Character | Won | Win % | Fell in R5 | Fell in R8 | Median clear s |
| --- | --- | --- | --- | --- | --- |
${[bare, ...loadouts]
  .map(
    (r) =>
      `| ${r.label} | ${r.wins} of ${r.runs} | ${rate(r).toFixed(0)}% | ${r.fellR5} | ${r.fellR8} | ${f1(r.median)} |`,
  )
  .join('\n')}

## Clear time (estimate)

${estimateMd}

A build that wins less than another is accepted (owner decision, as in the main report): the bound is on the average.
`;

if (!process.argv.includes('--no-write')) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md);
}
console.log(md);

if (process.argv.includes('--check')) {
  const bad: string[] = [];
  if (rate(bare) >= BANDS.bare[1])
    bad.push(`the bare kit won ${rate(bare).toFixed(0)}% (must be under ${BANDS.bare[1]}%)`);
  if (targetRate < BANDS.target[0] || targetRate > BANDS.target[1])
    bad.push(
      `the target loadout won ${targetRate.toFixed(0)}% (must be ${BANDS.target[0]} to ${BANDS.target[1]}%)`,
    );
  if (bad.length > 0) {
    console.error(`fight-sim:rootway: FAILED\n- ${bad.join('\n- ')}`);
    process.exit(1);
  }
  console.log('fight-sim:rootway: within bands');
}
