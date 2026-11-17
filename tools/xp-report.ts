/**
 * XP rate report (POW-M3-02, `npm run xp-report`). Drives the sim headless with the test bots for
 * 30 minutes of sim time on three loops, and writes `reports/xp-rate.md`: XP per hour, and the
 * time it takes to bank the rank 15 Trial threshold in Blades, Foraging and Cooking.
 *
 * Targets are derived from the curve, never typed: design/10 budgets about 4 hours of focused
 * use to reach 50, so rank 15 should take `4 h * xpTo(15) / xpTo(50)`.
 *
 * "Reached 15" means the skill sits at 14 points with a full bar: the next point waits on a
 * Trial (design/03), so this is the moment the player is asked for one. A loop that has not got
 * there after 30 minutes keeps running, up to {@link CAP_MIN}, so the time is measured, not guessed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { MOSSLING, Run, TPS } from '../tests/support/bots';
import { pendingTrial, xpToNext } from '../src/sim/skills';

const REPORT_MIN = 30;
const CAP_MIN = 1200;
const HERB_NODES: [number, number][] = [
  [25, 30],
  [25, 32],
  [25, 34],
];

interface Loop {
  name: string;
  skill: string;
  seed: number;
  /** One iteration of the loop. */
  step(run: Run, n: number): void;
}

const LOOPS: Loop[] = [
  {
    name: 'Fight Mosslings with the sword',
    skill: 'skill.blades',
    seed: 11,
    step(run) {
      run.fight(MOSSLING, { eatBelow: 40 });
      if (run.dead) run.recover();
      run.run(60);
    },
  },
  {
    name: 'Forage the herb patch',
    skill: 'skill.foraging',
    seed: 12,
    step(run, n) {
      const [x, y] = HERB_NODES[n % HERB_NODES.length]!;
      run.gather(x, y, true);
      run.run(200);
    },
  },
  {
    name: 'Cook herb tea (foraging the herbs between pots)',
    skill: 'skill.cooking',
    seed: 13,
    step(run, n) {
      const [x, y] = HERB_NODES[n % HERB_NODES.length]!;
      run.gather(x, y, true);
      while (run.count('item.sunwort') >= 1 && run.count('item.dewmint') >= 1)
        run.cook(['item.sunwort', 'item.dewmint']);
      run.run(200);
    },
  },
];

const xpTo = (points: number): number => {
  let n = 0;
  for (let p = 0; p < points; p++) n += xpToNext(p);
  return n;
};

/** At 14 points with the bar full: the next point is the Trial's to give. */
function atThreshold(run: Run, skill: string): boolean {
  const sk = run.s.entities.comps.skills[run.me]!;
  return (
    (sk.points[skill] ?? 0) === 14 &&
    pendingTrial(sk, skill) === 15 &&
    (sk.xp[skill] ?? 0) >= xpToNext(14)
  );
}

interface Result {
  loop: Loop;
  xp30: number;
  perHour: number;
  minutes: number | null;
}

function runLoop(loop: Loop): Result {
  const run = new Run(loop.seed);
  let n = 0;
  let xp30 = 0;
  let snapped = false;
  let reached: number | null = null;
  while (run.ticks < CAP_MIN * 60 * TPS) {
    loop.step(run, n++);
    const minutes = run.ticks / (60 * TPS);
    if (!snapped && minutes >= REPORT_MIN) {
      xp30 = run.s.ledger.xpEarned[loop.skill] ?? 0;
      snapped = true;
    }
    if (reached === null && atThreshold(run, loop.skill)) reached = minutes;
    if (snapped && reached !== null) break;
  }
  return { loop, xp30, perHour: Math.round(xp30 * 2), minutes: reached };
}

const target = (4 * 60 * xpTo(15)) / xpTo(50);
const results = LOOPS.map(runLoop);

const rows = results.map((r) => {
  const t = r.minutes;
  const ok = t !== null && t >= 20 && t <= 40;
  return `| ${r.loop.name} | ${r.loop.skill} | ${r.xp30} | ${r.perHour} | ${
    t === null ? `not in ${CAP_MIN}` : t.toFixed(1)
  } | ${ok ? 'yes' : 'deviation'} |`;
});

const md = `# XP rate report

Made by \`npm run xp-report\` (POW-M3-02). Do not edit by hand. Each loop is a test bot driving the real sim for ${REPORT_MIN} minutes of sim time (the loop then runs on, if it has not yet got there, to find the time to rank 15).

- XP to reach 15 points: ${xpTo(15)}. To reach 50: ${xpTo(50)}.
- Target time to 15: \`4 h * xpTo(15) / xpTo(50)\` = **${target.toFixed(1)} minutes** (design/10). The acceptance band is 20 to 40 minutes.
- "Time to 15" is when the skill has 14 points and a full bar: the next point waits on a Trial (design/03).

| Loop | Skill | XP in 30 min | XP per hour | Minutes to 15 | In 20 to 40 |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

Notes for M3-12 (balance harness):

- XP per event falls as the skill rises past the par rank of a tier 1 target (design/03): a tier 1 target is at the 10% floor by rank 15. A loop on tier 1 targets alone therefore slows down hard in the teens, and the time to 15 is far longer than the first 30 minutes of rate suggest. Base XP and par ranks are tuned by M3-12, not by this report.
- Cooking has no timer in the sim yet (the pot is instant), so its loop is paced by foraging the herbs. M3-07 adds the stir step.
- The bots take the sweet spot every time and never miss, so these are fast-player times.
`;

mkdirSync('reports', { recursive: true });
writeFileSync('reports/xp-rate.md', md);
console.log(md);
