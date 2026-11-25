import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../../src/content/chat/types';
import { RUMORS } from '../../src/content/chat/rumors';
import { EXCHANGES, TEMPLATES } from '../../src/content/chat/templates';
import { validateShippedChat } from '../../src/content/chat/validate';
import { HAND_TUNED } from '../../src/content/travelers/handTuned';
import { createAvatar } from '../../src/sim/avatar';
import { chatSystem } from '../../src/sim/chat/engine';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { findAvatar } from '../../src/shared/summary';
import { createDemoState, type SimState } from '../../src/sim/state';
import { travelersSystem } from '../../src/sim/travelers/crowd';
import { identitiesOf } from '../../src/sim/travelers/generate';

/**
 * The full chat template set (POW-M5-15): its size and spread, the lines only one Traveler says,
 * the exchanges for the standing ties, the deed reactions, and how an evening hour in Hearthford
 * reads with all of it (design/12 4.4 and 4.8).
 */
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

function run(s: SimState, minutes: number, inject?: (m: number) => SimEvent[]): Spoke[] {
  const base = s.clock!.nowMs;
  const out: Spoke[] = [];
  for (let m = 0; m < minutes; m++) {
    s.tick += 60;
    s.worldTick += 60;
    s.clock = { ...s.clock!, nowMs: base + m * 60_000 };
    s.events.list.length = 0;
    travelersSystem(s);
    for (const e of inject?.(m) ?? []) s.events.list.push(e);
    chatSystem(s);
    for (const e of s.events.list) if (e.type === 'travelerSpoke') out.push(e);
  }
  return out;
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
  it('has a Traveler say their own lines, and only they do', () => {
    const seen = new Set<string>();
    // Camps (M5-26) move some of the evening crowd off the square, so two more seeds keep the coverage.
    for (const seed of [3, 5, 8, 13, 21, 34, 55, 89]) {
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
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  it('keeps a pair exchange between its own two, a side each, in order', () => {
    const seen = new Set<string>();
    for (const seed of [3, 5, 8, 13, 21, 34, 55, 89]) {
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
    expect(seen.size).toBeGreaterThanOrEqual(1);
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
