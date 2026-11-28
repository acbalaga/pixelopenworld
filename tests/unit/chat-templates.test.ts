import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../../src/content/chat/types';
import { RUMORS } from '../../src/content/chat/rumors';
import { EXCHANGES, TEMPLATES } from '../../src/content/chat/templates';
import { validateShippedChat } from '../../src/content/chat/validate';
import { HAND_TUNED } from '../../src/content/travelers/handTuned';
import { createAvatar } from '../../src/sim/avatar';
import { chatSystem, pairPool, templatesFor } from '../../src/sim/chat/engine';
import { PLACE_SPOTS } from '../../src/content/people/placeSpots';
import { TIME, type Weather } from '../../src/content/balance/time';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { findAvatar } from '../../src/shared/summary';
import { createDemoState, type SimState } from '../../src/sim/state';
import { travelersSystem } from '../../src/sim/travelers/crowd';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { hold, stagedSeeds, type Cast } from '../support/stage';

/**
 * The full chat template set (POW-M5-15): its size and spread, the lines only one Traveler says,
 * the exchanges for the standing ties, the deed reactions, and how an evening hour in Hearthford
 * reads with all of it (design/12 4.4 and 4.8).
 */
/**
 * Rate checks (POW-M6-20): the own-lines and pair-exchange coverage sweeps run the whole crowd over
 * a real day on many seeds with no staging. They measure how often the dice reach those lines on
 * their own, so they move when a chat rate or roll changes, and only then. The staged tests at the
 * bottom prove every own line and every pair exchange works, whatever the dice.
 */
const RATE = {
  own: { seeds: [3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181], need: 8 },
  pair: { seeds: [3, 5, 8, 13, 21, 34, 55, 89], need: 1 },
} as const;

const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);

function world(seed: number, hour: number, day = 2): SimState {
  const T0 = (MON + day) * 86_400_000 + hour * 3_600_000;
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  createAvatar(s, px(3000), px(3000), 'Fred');
  s.clock = { nowMs: T0, epochMs: T0 - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

type Spoke = Extract<SimEvent, { type: 'travelerSpoke' }>;

function run(
  s: SimState,
  minutes: number,
  inject?: (m: number) => SimEvent[],
  cast?: Cast,
): Spoke[] {
  const base = s.clock!.nowMs;
  const out: Spoke[] = [];
  for (let m = 0; m < minutes; m++) {
    s.tick += 60;
    s.worldTick += 60;
    s.clock = { ...s.clock!, nowMs: base + m * 60_000 };
    s.events.list.length = 0;
    if (cast) hold(s, cast);
    travelersSystem(s);
    for (const e of inject?.(m) ?? []) s.events.list.push(e);
    chatSystem(s);
    for (const e of s.events.list) if (e.type === 'travelerSpoke') out.push(e);
  }
  return out;
}

/** The next world tick after `from` that falls in the middle of a phase of the in-game day. */
function phaseTick(phase: string, from: number): number {
  const cycle = TIME.phases.reduce((n, p) => n + p.minutes, 0) * TIME.ticksPerMinute;
  let start = 0;
  for (const p of TIME.phases) {
    if (p.phase === phase) {
      // Cycle offset of the phase's middle, then back to a tick (tick 0 is `startMinute` in).
      const mid = (start + p.minutes / 2 - TIME.startMinute) * TIME.ticksPerMinute;
      let t = Math.floor(from / cycle) * cycle + (((mid % cycle) + cycle) % cycle);
      while (t <= from) t += cycle;
      return t;
    }
    start += p.minutes;
  }
  throw new Error(phase);
}

const own = (l: Spoke): boolean => !l.reply && !l.template.startsWith('exchange.');
const byId = new Map(TEMPLATES.map((t) => [t.id, t]));

describe('the full template set', () => {
  it('passes the validator', () => {
    expect(validateShippedChat()).toEqual([]);
  });

  it('has about 600 templates, weighted toward trade, lfg, questions, answers and weather', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(560);
    expect(TEMPLATES.length).toBeLessThanOrEqual(680);
    const n = (c: string): number => TEMPLATES.filter((t) => t.category === c).length;
    for (const c of CATEGORIES) if (c !== 'banter') expect(n(c), c).toBeGreaterThanOrEqual(12);
    const mean = TEMPLATES.length / CATEGORIES.length;
    for (const c of ['trade', 'lfg', 'question', 'answer'] as const)
      expect(n(c), c).toBeGreaterThan(mean * 0.7);
    expect(n('trade')).toBeGreaterThan(n('farewell') * 2);
    expect(n('weather') + n('event')).toBeGreaterThan(n('joke') * 2);
  });

  it('gives each of the 24 hand-tuned Travelers lines only they say', () => {
    for (const h of HAND_TUNED) {
      const mine = TEMPLATES.filter((t) => t.when?.handle?.includes(h.handle));
      expect(mine.length, h.handle).toBeGreaterThanOrEqual(3);
      for (const t of mine) expect(t.when?.handle, t.id).toEqual([h.handle]);
    }
  });

  it('has at least 40 exchanges for the standing ties, covering every tie', () => {
    const pair = EXCHANGES.filter((x) => x.between);
    expect(pair.length).toBeGreaterThanOrEqual(40);
    const seen = new Set<string>();
    for (const h of HAND_TUNED)
      for (const t of h.ties) {
        const other = HAND_TUNED[t.slot]!;
        if (pair.some((x) => x.between!.includes(h.handle) && x.between!.includes(other.handle)))
          seen.add(`${h.slot}|${t.slot}`);
      }
    // Nine standing ties, each with at least two exchanges of its own.
    for (const x of pair) expect(x.lines.length).toBeGreaterThanOrEqual(2);
    const per = new Map<string, number>();
    for (const x of pair) per.set(x.between!.join('|'), (per.get(x.between!.join('|')) ?? 0) + 1);
    expect(per.size).toBeGreaterThanOrEqual(9);
    for (const [k, v] of per) expect(v, k).toBeGreaterThanOrEqual(2);
  });

  it('has about 80 rumors, about one in four wrong, none about the hidden layer', () => {
    expect(RUMORS.length).toBeGreaterThanOrEqual(75);
    expect(RUMORS.length).toBeLessThanOrEqual(110);
    const wrong = RUMORS.filter((r) => !r.true).length / RUMORS.length;
    expect(wrong).toBeGreaterThan(0.2);
    expect(wrong).toBeLessThan(0.3);
    for (const r of RUMORS) expect(r.text, r.id).not.toMatch(/keeper|echo|unwritten|truth/i);
  });

  it('has deed lines for each public deed that exists today', () => {
    for (const trigger of ['deed.boss', 'deed.trial', 'deed.rank', 'deed.singular', 'deed.passed'])
      expect(TEMPLATES.filter((t) => t.trigger === trigger).length, trigger).toBeGreaterThanOrEqual(
        4,
      );
  });
});

describe('an evening hour in Hearthford with the full set', () => {
  it('repeats no template in World, and Local lines come from distinct templates', () => {
    const rows: string[] = [];
    for (const seed of [3, 5, 8]) {
      const s = world(seed, 21);
      run(s, 30);
      const lines = run(s, 60).filter(own);
      const w = lines.filter((l) => l.channel === 'world').map((l) => l.template);
      const loc = lines.filter((l) => l.channel === 'local').map((l) => l.template);
      expect(new Set(w).size, `seed ${seed} world repeats`).toBe(w.length);
      const distinct = loc.length === 0 ? 1 : new Set(loc).size / loc.length;
      expect(distinct, `seed ${seed} local distinct`).toBeGreaterThanOrEqual(0.7);
      rows.push(
        `seed ${seed}: world ${w.length} lines, ${new Set(w).size} templates; local ${loc.length} lines, ${Math.round(distinct * 100)}% distinct`,
      );
      expect(w.length).toBeGreaterThan(10);
    }
    process.stdout.write(`\n[M5-15 evening hour 21:00 to 22:00]\n${rows.join('\n')}\n`);
  });
});

describe('the engine reads the new fields', () => {
  it(`rate check: own lines from at least ${RATE.own.need} templates over ${RATE.own.seeds.length} seeds, only by their owners`, () => {
    const seen = new Set<string>();
    // Camps (M5-26) move some of the crowd off the square at dusk and night, so more seeds keep the coverage.
    for (const seed of RATE.own.seeds) {
      const ids = identitiesOf(seed);
      const s = world(seed, 6);
      for (const l of run(s, 24 * 60)) {
        const t = byId.get(l.template);
        const who = t?.when?.handle;
        if (who) {
          expect(who, `${l.template} said by ${ids[l.slot]!.handle}`).toContain(
            ids[l.slot]!.handle,
          );
          seen.add(l.template);
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(RATE.own.need);
  });

  it(`rate check: a pair exchange between its own two, in order, over ${RATE.pair.seeds.length} seeds`, () => {
    const seen = new Set<string>();
    for (const seed of RATE.pair.seeds) {
      const ids = identitiesOf(seed);
      const s = world(seed, 6);
      const lines = run(s, 24 * 60).filter((l) => l.template.startsWith('exchange.'));
      const last = new Map<string, number>();
      for (const l of lines) {
        const x = EXCHANGES.find((e) => e.id === l.template)!;
        if (!x.between) continue;
        const handle = ids[l.slot]!.handle;
        expect(x.between, l.template).toContain(handle);
        // The two speak in turn, and the first line is the first handle's.
        const prev = last.get(l.source);
        if (prev === undefined) expect(handle, `${l.template} opens`).toBe(x.between[0]);
        else expect(prev, `${l.template} alternates`).not.toBe(l.slot);
        last.set(l.source, l.slot);
        seen.add(x.id);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(RATE.pair.need);
  });

  it('remarks on the avatar deeds, each from its own event, and not on anyone else', () => {
    const deeds: [string, (me: number) => SimEvent][] = [
      ['deed.boss', (me) => ({ type: 'bossResolved', id: me, boss: 'boss.test', how: 'fight' })],
      ['deed.trial', (me) => ({ type: 'trialPassed', id: me, trial: 'trial.test' })],
      ['deed.singular', (me) => ({ type: 'singularDone', who: me, id: 'singular.test' })],
      [
        'deed.rank',
        (me) => ({ type: 'skillRankUp', id: me, skill: 'skill.blades', points: 10, mastery: null }),
      ],
    ];
    for (const [trigger, make] of deeds) {
      let said = 0;
      let other = 0;
      for (const seed of [3, 5, 8]) {
        const s = world(seed, 20);
        run(s, 30);
        const me = findAvatar(s)!;
        const lines = run(s, 40 * 4, (m) => (m % 4 === 0 ? [make(me)] : []));
        said += lines.filter((l) => byId.get(l.template)?.trigger === trigger).length;
        const noise = run(s, 40 * 4, (m) => (m % 4 === 0 ? [make(me + 9999)] : []));
        other += noise.filter((l) => byId.get(l.template)?.trigger === trigger).length;
      }
      expect(said, trigger).toBeGreaterThan(0);
      expect(other, `${trigger} for someone else`).toBe(0);
    }
  });
});

/**
 * Staged lines (POW-M6-20). Each test puts its own cast online for a whole real day and nobody else,
 * so what it checks does not hang on who a seed's dice happened to log in. `STAGED_SEEDS=20` runs
 * each on twenty seeds.
 */
describe('staged own lines and pair exchanges', () => {
  const owners = [...new Set(TEMPLATES.flatMap((t) => t.when?.handle ?? []))];
  const slotOf = (handle: string): number => HAND_TUNED.findIndex((h) => h.handle === handle);

  it('has every own line open to its owner, staged in its weather and phase, and to nobody else', () => {
    const own = TEMPLATES.filter((t) => t.when?.handle);
    expect(owners.length).toBeGreaterThanOrEqual(8);
    const square = PLACE_SPOTS['hearthford.square']!.rect;
    for (const seed of stagedSeeds()) {
      for (const handle of owners) {
        const slot = slotOf(handle);
        expect(slot, handle).toBeGreaterThanOrEqual(0);
        const other = identitiesOf(seed).find((t) => t.slot >= 24)!.slot;
        // The owner and one other Traveler, at the square where the player stands, so Local works.
        const s = world(seed, 20);
        const me = findAvatar(s)!;
        const pos = s.entities.comps.pos[me]!;
        pos.x = px((square.x + (square.w >> 1)) * 16 + 8);
        pos.y = px((square.y + (square.h >> 1)) * 16 + 8);
        s.weatherOverride = 'clear';
        const cast: Cast = { slots: [slot, other], place: 'hearthford.square' };
        run(s, 20, undefined, cast);
        for (const tpl of own.filter((t) => t.when!.handle!.includes(handle))) {
          s.weatherOverride = (tpl.when!.weather?.[0] ?? 'clear') as Weather;
          if (tpl.when!.phase) s.worldTick = phaseTick(tpl.when!.phase[0]!, s.worldTick);
          run(s, 1, undefined, cast);
          // Said already in the warm-up (a login greeting, say)? Clear its cooldown and window first.
          s.chat!.cooldown.delete(`${slot}|${tpl.id}`);
          for (const ch of ['world', 'local'] as const)
            s.chat!.recent[ch] = s.chat!.recent[ch].filter((id) => id !== tpl.id);
          const where = `seed ${seed} ${tpl.id}`;
          expect(templatesFor(s, slot, tpl.trigger), where).toContain(tpl.id);
          expect(templatesFor(s, other, tpl.trigger), `${where} for another`).not.toContain(tpl.id);
        }
      }
    }
  });

  it('has every named pair exchange open to its own two, through their tie, and to no other pair', () => {
    const named = EXCHANGES.filter((x) => x.between);
    expect(named.length).toBeGreaterThan(0);
    for (const seed of stagedSeeds()) {
      const ids = identitiesOf(seed);
      for (const x of named) {
        const [h1, h2] = x.between!;
        const a = ids[slotOf(h1)]!;
        const b = ids[slotOf(h2)]!;
        // The pair holds the tie the exchange is for, so the engine can pick them as a pair.
        const tie = [...a.ties, ...b.ties].some(
          (t) => (t.slot === a.slot || t.slot === b.slot) && t.kind === x.tie,
        );
        expect(tie, `seed ${seed} ${x.id} tie`).toBe(true);
        expect(pairPool(x.tie, h1, h2), `seed ${seed} ${x.id}`).toContain(x);
        expect(pairPool(x.tie, h2, h1), `seed ${seed} ${x.id} either way`).toContain(x);
        // Anyone else with that tie to either of them never gets it.
        for (const t of [...a.ties, ...b.ties].filter((y) => y.kind === x.tie)) {
          const other = ids[t.slot]!.handle;
          if (other === h1 || other === h2) continue;
          expect(pairPool(x.tie, h1, other), `seed ${seed} ${x.id} with ${other}`).not.toContain(x);
          expect(pairPool(x.tie, h2, other), `seed ${seed} ${x.id} with ${other}`).not.toContain(x);
        }
      }
    }
  });
});
