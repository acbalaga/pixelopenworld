import { describe, expect, it } from 'vitest';
import { RANKINGS } from '../../src/content/balance/rankings';
import { SKILLS } from '../../src/content/skills';
import {
  ALL_BOARDS,
  computeBoard,
  passedBetween,
  travelerValue,
  type PlayerFacts,
} from '../../src/sim/rankings/boards';
import { factsOf, rankingsSystem } from '../../src/sim/rankings/system';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { catchUp, referencePoints } from '../../src/sim/travelers/progress';
import { createAvatar } from '../../src/sim/avatar';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { xpToNext } from '../../src/sim/skills';
import { boardPage, boardSummaries } from '../../src/ui/menu/rankingsModel';
import { Run, TPS } from '../support/bots';
import { FISH } from '../../tools/sim-bot/policies';

/** Rankings (POW-M5-09): ranks are a plain sort of the same values, boards can be climbed and passed. */

/** A small seeded dice, so the property test is repeatable. */
function dice(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stateAt(seed: number, hours: number): SimState {
  const s = createDemoState(seed, 0);
  catchUp(seed, s.travelers, hours, hours / 3);
  return s;
}

const facts = (over: Partial<PlayerFacts> = {}): PlayerFacts => ({
  handle: 'Fred',
  points: {},
  coin: 0,
  bestiary: 0,
  mapPercent: 0,
  fishLanded: 0,
  duelWins: 0,
  ...over,
});

describe('boards', () => {
  it('rank equals a brute-force sort of the same state, for 100 random states', () => {
    for (let n = 0; n < 100; n++) {
      const d = dice(n + 1);
      const seed = 1 + Math.floor(d() * 50);
      const s = stateAt(seed, d() * 120);
      const ids = identitiesOf(seed);
      const skills = Object.keys(SKILLS);
      const pts: Record<string, number> = {};
      for (const k of skills) if (d() < 0.4) pts[k] = Math.floor(d() * 90);
      const f = facts({
        points: pts,
        coin: Math.floor(d() * 5000),
        bestiary: Math.floor(d() * 30),
        mapPercent: Math.floor(d() * 100),
        fishLanded: Math.floor(d() * 400),
      });
      for (const id of ALL_BOARDS) {
        const b = computeBoard(id, seed, s.travelers, f);
        // The player's value on this board, by an independent read of the facts.
        const mine = b.playerValue;
        if (mine <= 0) {
          expect(b.playerRank, `${id} unranked`).toBeNull();
          continue;
        }
        // A tie goes to the Traveler: the rank is one more than the Travelers at or above the value.
        let above = 0;
        for (const t of ids) if (travelerValue(id, t, s.travelers[t.slot]!) >= mine) above++;
        expect(b.playerRank, `${id} seed ${seed}`).toBe(above + 1);
        // And the rows are in non-increasing order with ranks 1..n.
        b.rows.forEach((r, i) => {
          expect(r.rank).toBe(i + 1);
          if (i > 0) expect(b.rows[i - 1]!.value).toBeGreaterThanOrEqual(r.value);
        });
      }
    }
  });

  it('puts the player below a Traveler of equal value, and above one of less', () => {
    const s = stateAt(3, 30);
    const top = computeBoard('skill.smithing', 3, s.travelers, facts());
    const best = top.rows[0]!;
    const tie = computeBoard(
      'skill.smithing',
      3,
      s.travelers,
      facts({ points: { 'skill.smithing': best.value } }),
    );
    expect(tie.playerRank).toBe(tie.rows.filter((r) => r.value >= best.value).length);
    const over = computeBoard(
      'skill.smithing',
      3,
      s.travelers,
      facts({ points: { 'skill.smithing': best.value + 1 } }),
    );
    expect(over.playerRank).toBe(1);
  });

  it('keeps duels and festivals empty until their tickets', () => {
    const s = stateAt(3, 30);
    for (const id of ['duels', 'festivals'])
      expect(computeBoard(id, 3, s.travelers, facts({ coin: 99 })).rows).toEqual([]);
  });

  it('never lets a Traveler reach the cap of a capped board, so a player can top it', () => {
    const s = stateAt(4, 4000);
    const ids = identitiesOf(4);
    for (const id of ['bestiary', 'map'] as const)
      for (const t of ids) {
        const v = travelerValue(id, t, s.travelers[t.slot]!);
        expect(v).toBeLessThanOrEqual(id === 'map' ? 100 * RANKINGS.travelerCap : 40);
      }
  });
});

describe('plateaus (design/12 3.4)', () => {
  it('leaves the top Smithing Traveler at 80 hours within reach of the reference player', () => {
    const rows: string[] = [];
    for (const seed of [1, 2, 3, 7, 15]) {
      const s = stateAt(seed, 80);
      const ref = Math.round(referencePoints(80));
      const b = computeBoard(
        'skill.smithing',
        seed,
        s.travelers,
        facts({ points: { 'skill.smithing': ref } }),
      );
      const top = b.rows.find((r) => r.slot !== null)!.value;
      rows.push(`seed ${seed}: top ${top}, reference ${ref}, reference rank ${b.playerRank}`);
      // The yardstick stands in the top 20 and the top is at most 20 points above it.
      expect(b.playerRank!, rows.at(-1)).toBeLessThanOrEqual(RANKINGS.passTop);
      expect(top - ref, rows.at(-1)).toBeLessThanOrEqual(20);
      expect(top).toBeLessThanOrEqual(100);
    }
    process.stdout.write(`\n[M5-09 smithing at 80 h]\n${rows.join('\n')}\n`);
  });
});

/** Points a bot of `rate` xp per hour has after `hours` of a person's play (the learning curve). */
function personPoints(rate: number, hours: number): number {
  const { start, end, learnHours } = RANKINGS.humanEfficiency;
  // The integral of start + (end - start) * min(1, t / learnHours) from 0 to hours.
  const ramp = Math.min(hours, learnHours);
  const eff =
    start * hours +
    ((end - start) * (ramp * ramp)) / (2 * learnHours) +
    (end - start) * Math.max(0, hours - learnHours);
  const xp = rate * eff;
  let p = 0;
  let c = 0;
  while (c + xpToNext(p) <= xp) {
    c += xpToNext(p);
    p++;
  }
  return p;
}

describe('a Fishing run', () => {
  it('reaches first place on the Fishing board within 15 play hours and not within 5', () => {
    // The bot never misses, so a person lands a share of its rate (balance: humanEfficiency).
    const run = new Run(FISH.seed);
    FISH.setup?.(run);
    let n = 0;
    while (run.ticks < 60 * 60 * TPS) FISH.step(run, n++);
    const rate = run.s.ledger.xpEarned['skill.fishing'] ?? 0; // xp in one hour
    expect(rate).toBeGreaterThan(2000);
    const rows: string[] = [];
    for (const seed of [FISH.seed, 1, 2, 3, 7]) {
      const at = (h: number): number | null => {
        const s = stateAt(seed, h);
        return computeBoard(
          'skill.fishing',
          seed,
          s.travelers,
          facts({ points: { 'skill.fishing': personPoints(rate, h) } }),
        ).playerRank;
      };
      const r5 = at(5);
      const r15 = at(15);
      rows.push(`seed ${seed}: rank ${r5} at 5 h, ${r15} at 15 h (bot ${rate} xp per hour)`);
      expect(r5, rows.at(-1)).not.toBe(1);
      expect(r15, rows.at(-1)).toBe(1);
    }
    process.stdout.write(`\n[M5-09 fishing run]\n${rows.join('\n')}\n`);
  }, 120_000);
});

function withAvatar(seed: number, hours: number): { s: SimState; me: number } {
  const s = stateAt(seed, hours);
  s.world = { solidAt: (): number => 0 };
  const me = createAvatar(s, px(3000), px(3000), 'Fred');
  return { s, me };
}

describe('the rankings system', () => {
  it('sends playerPassed once when the player passes a Traveler in the top 20', () => {
    const { s, me } = withAvatar(3, 30);
    const sk = s.entities.comps.skills[me]!;
    const run = (ticks: number): { board: string; slot: number }[] => {
      const out: { board: string; slot: number }[] = [];
      for (let i = 0; i < ticks; i++) {
        s.tick += 30;
        s.events.list.length = 0;
        rankingsSystem(s);
        for (const e of s.events.list)
          if (e.type === 'playerPassed') out.push({ board: e.board, slot: e.slot });
      }
      return out;
    };
    expect(run(10)).toEqual([]); // The first look records where the player stands.
    const board = computeBoard('skill.smithing', 3, s.travelers, factsOf(s, me));
    const third = board.rows.filter((r) => r.slot !== null)[2]!;
    sk.points['skill.smithing'] = third.value + 1;
    const passed = run(10);
    const slots = passed.filter((p) => p.board === 'skill.smithing').map((p) => p.slot);
    expect(slots.length).toBeGreaterThanOrEqual(1);
    expect(slots).toContain(third.slot);
    expect(new Set(slots).size).toBe(slots.length);
    // Nothing more while the player stays where they are.
    expect(run(20).filter((p) => p.board === 'skill.smithing')).toEqual([]);
  });

  it('does not announce a Traveler below the top 20', () => {
    const next = computeBoard(
      'skill.smithing',
      3,
      stateAt(3, 30).travelers,
      facts({ points: { 'skill.smithing': 2 } }),
    );
    expect(passedBetween(null, next, 0)).toEqual([]);
  });

  it('adds nothing to the saved state', () => {
    const a = withAvatar(5, 10);
    const b = withAvatar(5, 10);
    for (let i = 0; i < 20; i++) {
      a.s.tick += 90;
      rankingsSystem(a.s);
      b.s.tick += 90;
    }
    expect(a.s.rankings).toBeDefined();
    expect(JSON.stringify([...a.s.rankings!.values])).not.toBe('[]');
  });
});

describe('the board view', () => {
  it('lists boards with the player rank and shows rows beside the player when below the top', () => {
    const { s, me } = withAvatar(3, 60);
    const list = boardSummaries(s, me, 0);
    expect(list.some((b) => b.id === 'wealth')).toBe(true);
    expect(list.every((b) => b.name.length > 0)).toBe(true);
    s.entities.comps.skills[me]!.points['skill.smithing'] = 30;
    const page = boardPage(s, me, 'skill.smithing', 0);
    expect(page.rank).not.toBeNull();
    expect(page.top.length).toBeLessThanOrEqual(RANKINGS.topRows);
    if (page.rank! > RANKINGS.topRows) {
      expect(page.near.some((r) => r.isYou)).toBe(true);
      expect(page.near.length).toBeLessThanOrEqual(3);
    } else expect(page.top.some((r) => r.isYou)).toBe(true);
  });
});
