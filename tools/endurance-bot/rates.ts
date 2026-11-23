/**
 * Measures how often the real sim produces each XP event when a bot runs the shipped loops
 * (sim-bot policies), as events per sim minute. These rates feed skills.ts.
 */
import { Run, TPS } from '../../tests/support/bots';
import { CRAFT, FIGHT, GATHER } from '../sim-bot/policies';

const MIN = Number(process.argv[2] ?? 20);
const out: Record<string, Record<string, number>> = {};
for (const p of [FIGHT, GATHER, CRAFT]) {
  const run = new Run(p.seed);
  p.setup?.(run);
  const counts: Record<string, number> = {};
  let n = 0;
  while (run.ticks < MIN * 60 * TPS) {
    run.events = [];
    p.step(run, n++);
    for (const e of run.events) {
      const k = e.type === 'damageDealt' && e.src === run.me ? 'hit' : e.type;
      counts[k] = (counts[k] ?? 0) + 1;
      if (e.type === 'skillXp' && e.id === run.me) {
        counts[`paid:${e.skill}`] = (counts[`paid:${e.skill}`] ?? 0) + 1;
        counts[`xp:${e.skill}`] = (counts[`xp:${e.skill}`] ?? 0) + e.amount;
      }
    }
  }
  const m = run.ticks / TPS / 60;
  out[p.id] = Object.fromEntries(
    Object.keys(counts)
      .filter((k) => !k.startsWith('xp:') && counts[k]! / m > 0.05)
      .map((k) => [k, +((counts[k] ?? 0) / m).toFixed(2)]),
  );
}
console.log(JSON.stringify(out, null, 1));
