/**
 * Sim bot (POW-M3-12, `npm run sim-bot`). Plays the real sim headless with four v1 policies
 * (gather, fight, craft, request) and reports XP per hour per skill, coin per hour per activity,
 * and the time each of the three loops takes to bring its skill to rank 15. It autosaves every
 * sim minute, loads every snapshot back through the integrity validator, and writes the sequence
 * of save summaries. Any flagged snapshot fails the run.
 *
 *   --minutes N   sim minutes of the reporting window (default 60)
 *   --cap N       the most sim minutes a loop may run to reach rank 15 (default 600)
 *   --check       exit 1 when a number is past `tools/balance-thresholds.json`
 *   --out PATH    where to write the report (default reports/sim-bot.md)
 *   --no-write    print only
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Run, TPS } from '../../tests/support/bots';
import { SKILLS } from '../../src/content/skills';
import { pendingTrial, xpToNext } from '../../src/sim/skills';
import { POLICIES, type Policy } from './policies';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const MINUTES = Number(arg('--minutes') ?? 60);
const CAP = Number(arg('--cap') ?? 600);
const OUT = arg('--out') ?? 'reports/sim-bot.md';

interface Thresholds {
  simBot: {
    timeTo15: [number, number];
    /** The band for the gathering and crafting loops, which are meant to be slower than combat. */
    timeTo15Slow: [number, number];
    /** Per policy: the XP per hour of its skill, and coin per hour, as [min, max]. */
    xpPerHour: Record<string, [number, number]>;
    coinPerHour: Record<string, [number, number]>;
    maxFlags: number;
    maxDeaths: Record<string, number>;
  };
}
const thresholds = JSON.parse(readFileSync('tools/balance-thresholds.json', 'utf8')) as Thresholds;

/** The skill is at 14 points with a full bar: the next point waits on a Trial (design/03). */
function atThreshold(run: Run, skill: string): boolean {
  const sk = run.s.entities.comps.skills[run.me]!;
  return (
    (sk.points[skill] ?? 0) === 14 &&
    pendingTrial(sk, skill) === 15 &&
    (sk.xp[skill] ?? 0) >= xpToNext(14)
  );
}

interface Result {
  policy: Policy;
  minutes: number;
  xpPerHour: Record<string, number>;
  coinPerHour: number;
  coinBySource: Record<string, number>;
  deaths: number;
  requestsDone: number;
  to15: number | null;
  snapshots: number;
  flags: string[];
  summaries: { minute: number; summary: unknown }[];
}

async function play(policy: Policy): Promise<Result> {
  const run = new Run(policy.seed);
  policy.setup?.(run);
  let n = 0;
  let snapped = false;
  let xp: Record<string, number> = {};
  let coin: Record<string, number> = {};
  let held = 0;
  let deaths = 0;
  let wasDead = false;
  let reached: number | null = null;
  const summaries: Result['summaries'] = [];
  const flags: string[] = [];
  let seen = 0;
  while (run.ticks < CAP * 60 * TPS) {
    policy.step(run, n++);
    if (run.dead && !wasDead) deaths++;
    wasDead = run.dead;
    await run.autosave();
    for (; seen < run.snapshots.length; seen++) {
      const snap = run.snapshots[seen]!;
      const t = snap.loaded.plain.trust;
      if (t.state !== 'intact')
        flags.push(`minute ${(snap.tick / TPS / 60).toFixed(0)}: ${t.reasons.join(', ')}`);
      summaries.push({
        minute: Math.round(snap.tick / TPS / 60),
        summary: snap.loaded.plain.summary,
      });
    }
    const minutes = run.ticks / (60 * TPS);
    if (!snapped && minutes >= MINUTES) {
      xp = { ...run.s.ledger.xpEarned };
      coin = { ...run.s.ledger.coinEarned };
      held = run.s.entities.comps.avatar[run.me]!.coin;
      snapped = true;
    }
    if (policy.skill && reached === null && atThreshold(run, policy.skill)) reached = minutes;
    if (snapped && (!policy.skill || reached !== null)) break;
  }
  if (!snapped) {
    xp = { ...run.s.ledger.xpEarned };
    coin = { ...run.s.ledger.coinEarned };
    held = run.s.entities.comps.avatar[run.me]!.coin;
  }
  const hours = Math.min(MINUTES, run.ticks / (60 * TPS)) / 60;
  const per = (v: number): number => Math.round(v / hours);
  const j = run.s.entities.comps.journal[run.me]!;
  return {
    policy,
    minutes: MINUTES,
    xpPerHour: Object.fromEntries(Object.entries(xp).map(([k, v]) => [k, per(v)])),
    coinPerHour: per(held + Object.values(run.s.ledger.coinSpent).reduce((a, b) => a + b, 0)),
    coinBySource: Object.fromEntries(Object.entries(coin).map(([k, v]) => [k, per(v)])),
    deaths,
    requestsDone: Object.values(j.requests).filter((r) => r.state === 'done').length,
    to15: reached,
    snapshots: run.snapshots.length,
    flags,
    summaries,
  };
}

const only = arg('--policy');
const results: Result[] = [];
for (const p of POLICIES) if (!only || p.id === only) results.push(await play(p));

const name = (id: string): string => SKILLS[id]?.name ?? id;
const th = thresholds.simBot;
const bandOf = (p: Policy): [number, number] => (p.pace === 'slow' ? th.timeTo15Slow : th.timeTo15);
const xpRows = results.flatMap((r) =>
  Object.entries(r.xpPerHour)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([skill, v]) => `| ${r.policy.id} | ${name(skill)} | ${v} |`),
);
const coinRows = results.map(
  (r) =>
    `| ${r.policy.id} | ${r.coinPerHour} | ${
      Object.entries(r.coinBySource)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ') || 'none'
    } | ${r.deaths} | ${r.requestsDone} |`,
);
const timeRows = results
  .filter((r) => r.policy.skill)
  .map((r) => {
    const [lo, hi] = bandOf(r.policy);
    const t = r.to15;
    return `| ${r.policy.label} | ${name(r.policy.skill as string)} | ${
      t === null ? `not in ${CAP}` : t.toFixed(1)
    } | ${lo} to ${hi} | ${t !== null && t >= lo && t <= hi ? 'yes' : 'NO'} |`;
  });
const flagged = results.flatMap((r) => r.flags.map((f) => `${r.policy.id} ${f}`));

const md = `# Sim bot report

Made by \`npm run sim-bot\` (POW-M3-12). Do not edit by hand. Four v1 policies drive the real sim in the slice's own supply (three herb patches, two berry bushes, a camp pot, a shopkeeper, the guard). Each reports over ${MINUTES} sim minutes. The bots take every sweet spot and never miss, so these are a fast player's numbers. Every minute the bot saves, and every snapshot is loaded back through the integrity validator.

- Policies: ${results.map((r) => `**${r.policy.id}** (${r.policy.label})`).join('; ')}.
- Snapshots validated: ${results.reduce((n, r) => n + r.snapshots, 0)}. Flagged: **${flagged.length}**.${flagged.length ? '\n' + flagged.map((f) => `  - ${f}`).join('\n') : ''}

## Time to rank 15

"Time to 15" is when the skill has 14 points and a full bar: the next point waits on a Trial (design/03). The target is derived from the curve: \`4 h * xpTo(15) / xpTo(50)\`, about 27 minutes. The band is ${th.timeTo15[0]} to ${th.timeTo15[1]} minutes (M3-02) for combat. Foraging and Cooking are slower on purpose, ${th.timeTo15Slow[0]} to ${th.timeTo15Slow[1]} minutes: on the first map they are paced by how fast the nodes come back, and the slow pace pays in kind (a large first-time bonus for every new herb and dish, and a sale price for what is made).

| Loop | Skill | Minutes to 15 | Band | In band |
| --- | --- | --- | --- | --- |
${timeRows.join('\n')}

## XP per hour, top four skills of each policy

| Policy | Skill | XP per hour |
| --- | --- | --- |
${xpRows.join('\n')}

## Coin per hour, by activity

Coin per hour is the coin held at the end plus the coin spent, over the window. By source is coin earned.

| Policy | Coin per hour | By source | Deaths | Requests done |
| --- | --- | --- | --- | --- |
${coinRows.join('\n')}

## Save summaries

The summary of every snapshot is in \`reports/sim-bot-summaries.json\` (one per sim minute, per policy).
`;

if (!process.argv.includes('--no-write')) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md);
  writeFileSync(
    OUT.replace(/sim-bot\.md$/, 'sim-bot-summaries.json'),
    JSON.stringify(Object.fromEntries(results.map((r) => [r.policy.id, r.summaries])), null, 1) +
      '\n',
  );
}
console.log(md);

const bad: string[] = [];
if (flagged.length > th.maxFlags)
  bad.push(`${flagged.length} snapshots were flagged by the validator`);
if (process.argv.includes('--check')) {
  for (const r of results) {
    const [blo, bhi] = bandOf(r.policy);
    if (r.policy.skill && (r.to15 === null || r.to15 < blo || r.to15 > bhi))
      bad.push(
        `${r.policy.id}: time to 15 is ${r.to15?.toFixed(1) ?? 'never'}, outside ${blo} to ${bhi}`,
      );
    const [cl, ch] = th.coinPerHour[r.policy.id] ?? [0, Infinity];
    if (r.coinPerHour < cl || r.coinPerHour > ch)
      bad.push(`${r.policy.id}: coin per hour ${r.coinPerHour} outside ${cl} to ${ch}`);
    const xr = th.xpPerHour[r.policy.id];
    const top = Math.max(0, ...Object.values(r.xpPerHour));
    if (xr && (top < xr[0] || top > xr[1]))
      bad.push(`${r.policy.id}: top XP per hour ${top} outside ${xr.join(' to ')}`);
    if (r.deaths > (th.maxDeaths[r.policy.id] ?? 0))
      bad.push(`${r.policy.id}: ${r.deaths} deaths, limit ${th.maxDeaths[r.policy.id] ?? 0}`);
  }
}
if (bad.length > 0) {
  console.error(`sim-bot: FAILED\n- ${bad.join('\n- ')}`);
  process.exit(1);
}
if (process.argv.includes('--check')) console.log('sim-bot: within thresholds');
