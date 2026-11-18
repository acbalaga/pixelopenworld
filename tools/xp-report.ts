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
import { Run, TPS } from '../tests/support/bots';
import { readFileSync } from 'node:fs';
import { CRAFT, FIGHT, GATHER } from './sim-bot/policies';
import { pendingTrial, xpToNext } from '../src/sim/skills';

const REPORT_MIN = 30;
const CAP_MIN = 1200;

interface Loop {
  name: string;
  slow: boolean;
  skill: string;
  seed: number;
  /** One iteration of the loop. */
  step(run: Run, n: number): void;
}

// The loops are the sim bot's (POW-M3-12), so this report and `npm run sim-bot` agree.
const LOOPS: Loop[] = [FIGHT, GATHER, CRAFT].map((p) => ({
  name: p.label,
  slow: p.pace === 'slow',
  skill: p.skill as string,
  seed: p.seed,
  step: p.step,
}));

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

const bands = JSON.parse(readFileSync('tools/balance-thresholds.json', 'utf8')) as {
  simBot: { timeTo15: [number, number]; timeTo15Slow: [number, number] };
};
const target = (4 * 60 * xpTo(15)) / xpTo(50);
const results = LOOPS.map(runLoop);

const rows = results.map((r) => {
  const t = r.minutes;
  const [lo, hi] = r.loop.slow ? bands.simBot.timeTo15Slow : bands.simBot.timeTo15;
  const ok = t !== null && t >= lo && t <= hi;
  return `| ${r.loop.name} | ${r.loop.skill} | ${r.xp30} | ${r.perHour} | ${
    t === null ? `not in ${CAP_MIN}` : t.toFixed(1)
  } | ${ok ? 'yes' : 'deviation'} |`;
});

const md = `# XP rate report

Made by \`npm run xp-report\` (POW-M3-02). Do not edit by hand. Each loop is a test bot driving the real sim for ${REPORT_MIN} minutes of sim time (the loop then runs on, if it has not yet got there, to find the time to rank 15).

- XP to reach 15 points: ${xpTo(15)}. To reach 50: ${xpTo(50)}.
- Target time to 15: \`4 h * xpTo(15) / xpTo(50)\` = **${target.toFixed(1)} minutes** (design/10). The band is ${bands.simBot.timeTo15.join(' to ')} minutes for combat and ${bands.simBot.timeTo15Slow.join(' to ')} for Foraging and Cooking, which are slower on purpose (reports/sim-bot.md).
- "Time to 15" is when the skill has 14 points and a full bar: the next point waits on a Trial (design/03).

| Loop | Skill | XP in 30 min | XP per hour | Minutes to 15 | In its band |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

Notes for M3-12 (balance harness):

- XP per event falls as the skill rises past the par rank of a tier 1 target (design/03): a tier 1 target is at the 10% floor by rank 15, so the time to 15 is longer than the first 30 minutes of rate suggest.
- Tuned by M3-12: the loops are the sim bot's (\`tools/sim-bot/policies.ts\`). Foraging and Cooking are paced by node supply (three herb patches and two berry bushes on the slice), so their XP per event is high; see reports/sim-bot.md and the M3-12 PR for before and after.
- The bots take the sweet spot every time and never miss, so these are fast-player times.
`;

mkdirSync('reports', { recursive: true });
writeFileSync('reports/xp-rate.md', md);
console.log(md);
