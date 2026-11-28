import { describe, expect, it } from 'vitest';
import { createAvatar } from '../../src/sim/avatar';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { chatSystem } from '../../src/sim/chat/engine';
import { crowdOf, travelersSystem } from '../../src/sim/travelers/crowd';
import { travelerViews } from '../../src/sim/travelers/entities';
import { SCENES } from '../../src/content/chat/scenes';
import { SCENES as BAL } from '../../src/content/balance/chat';
import { validateChat, validateShippedChat } from '../../src/content/chat/validate';
import { PLACE_SPOTS } from '../../src/content/people/placeSpots';
import { TEMPLATES, EXCHANGES } from '../../src/content/chat/templates';
import { VOICES } from '../../src/content/chat/voices';
import { GLYPHS } from '../../src/content/chat/glyphs';
import { RUMORS } from '../../src/content/chat/rumors';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { hold, stagedSeeds, topPoints, type Cast } from '../support/stage';

/**
 * Small scenes (POW-M5-27): fountain wishes, inn dance-offs, camp ghost stories and arguments with
 * the training dummy. A simulated evening, 19:00 to 23:00 on the device clock, with the player at
 * the place the scene is staged.
 */
/**
 * Rate checks (POW-M6-20): each sweeps `RATE.seeds` world seeds with no staging and counts how many
 * show the scene. They measure how often the dice give the scene on their own, so they move when a
 * rate or a roll in the chat dice changes, and only then. The staged tests below are the ones that
 * prove the scene works: they pick their own cast and never depend on a seed's luck.
 */
const RATE = { seeds: 10, wish: 8, dance: 8, ghost: 8, dummy: 8 } as const;

const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const DAY0 = (MON + 2) * 86_400_000;
const OPEN = { solidAt: (): number => 0 };

const centre = (id: string): { x: number; y: number } => {
  const r = PLACE_SPOTS[id]!.rect;
  return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) };
};

function world(
  seed: number,
  at: { x: number; y: number },
  hour: number,
  phaseTick: number,
): SimState {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  createAvatar(s, px(at.x * 16 + 8), px(at.y * 16 + 8));
  s.worldTick = phaseTick;
  s.weatherOverride = 'clear';
  const now = DAY0 + hour * 3_600_000;
  s.clock = { nowMs: now, epochMs: now - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

interface Seen {
  templates: Map<string, number>;
  lines: { template: string; text: string; slot: number; reply: boolean }[];
}

function run(s: SimState, ticks: number, each?: () => void, cast?: Cast): Seen {
  const seen: Seen = { templates: new Map(), lines: [] };
  const base = s.clock!.nowMs;
  const start = s.tick;
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    s.worldTick++;
    s.clock = { ...s.clock!, nowMs: base + Math.floor(((s.tick - start) * 1000) / 30) };
    s.events.list.length = 0;
    if (cast && i % 30 === 0) hold(s, cast);
    travelersSystem(s);
    chatSystem(s);
    for (const e of s.events.list)
      if (e.type === 'travelerSpoke' && e.template.startsWith('scene.')) {
        seen.templates.set(e.template, (seen.templates.get(e.template) ?? 0) + 1);
        seen.lines.push({ template: e.template, text: e.text, slot: e.slot, reply: e.reply });
      }
    if (each && i % 30 === 0) each();
  }
  return seen;
}

const kindOf = (id: string): string => SCENES.find((x) => x.id === id)?.kind ?? '?';
const DUSK = (34 - 4) * 1800;
const NIGHT = (38 - 4) * 1800;

describe('the scene lines', () => {
  it('pass the validator, with at least six variants of each idea', () => {
    expect(validateShippedChat()).toEqual([]);
    for (const k of ['wish', 'dance', 'ghost', 'dummy'] as const)
      expect(SCENES.filter((s) => s.kind === k).length, k).toBeGreaterThanOrEqual(6);
  });

  it('catch a bad scene: a wrong role order, an unbaked place, an em dash', () => {
    const base = {
      templates: TEMPLATES,
      exchanges: EXCHANGES,
      voices: VOICES,
      glyphs: GLYPHS,
      rumors: RUMORS,
    };
    const good = SCENES.filter((s) => s.kind === 'dance')[0]!;
    const bad = [
      { ...good, id: 'x1', lines: [good.lines[1]!, good.lines[0]!, good.lines[2]!] },
      {
        ...good,
        id: 'x2',
        lines: [
          { role: 'a' as const, text: 'meet me at Whisperwood' },
          good.lines[1]!,
          good.lines[2]!,
        ],
      },
      {
        ...good,
        id: 'x3',
        lines: [{ role: 'a' as const, text: 'a — b' }, good.lines[1]!, good.lines[2]!],
      },
    ];
    for (const b of bad)
      expect(validateChat({ ...base, scenes: [...SCENES, b] }).length, b.id).toBeGreaterThan(0);
  });
});

describe('an evening in Hearthford', () => {
  const idea = (s: Seen, kind: string): number =>
    [...s.templates].filter(([id]) => kindOf(id) === kind).reduce((a, [, n]) => a + n, 0);

  it(`rate check: a wish at the well on ${RATE.wish} of ${RATE.seeds} seeds, under the cap, with the toss showing`, () => {
    let hits = 0;
    let tossed = 0;
    for (let seed = 1; seed <= RATE.seeds; seed++) {
      const s = world(seed, centre('hearthford.square'), 19, 9000);
      let toss = false;
      const seen = run(s, 7200, () => {
        for (const v of travelerViews(s)) if (v.glyph === '*' || v.glyph === '+') toss = true;
      });
      const n = [...seen.templates].filter(([id]) => id.startsWith('scene.wish.')).length;
      if (n > 0) hits++;
      if (toss) tossed++;
      expect(
        seen.lines.filter((l) => l.template.startsWith('scene.wish.')).length,
        `seed ${seed}`,
      ).toBeLessThanOrEqual(BAL.capPerHour * 2 * 2);
    }
    expect(hits).toBeGreaterThanOrEqual(RATE.wish);
    expect(tossed).toBeGreaterThanOrEqual(RATE.wish);
  }, 180_000);

  it(`rate check: a dance-off at the inn at dusk on ${RATE.dance} of ${RATE.seeds} seeds`, () => {
    let hits = 0;
    let dancing = 0;
    for (let seed = 1; seed <= RATE.seeds; seed++) {
      const s = world(seed, centre('hearthford.inn'), 20, DUSK - 1800);
      let danced = false;
      // A real evening holds about five in-game dusks. All of them, one after the other.
      let said = 0;
      for (let dusk = 0; dusk < 5; dusk++) {
        s.worldTick = DUSK - 1800;
        const seen = run(s, 1800 + 7200, () => {
          for (const v of travelerViews(s)) if (v.mode === 'dance') danced = true;
        });
        said += idea(seen, 'dance');
      }
      if (said >= 3) hits++;
      if (danced) dancing++;
    }
    expect(hits).toBeGreaterThanOrEqual(RATE.dance);
    expect(dancing).toBeGreaterThanOrEqual(RATE.dance);
  }, 180_000);

  it(`rate check: a ghost story at a camp at night on ${RATE.ghost} of ${RATE.seeds} seeds`, () => {
    let hits = 0;
    const camp = PLACE_SPOTS['wayside.river_camp']!.focus!;
    for (let seed = 1; seed <= RATE.seeds; seed++) {
      const s = world(seed, { x: camp[0], y: camp[1] + 3 }, 22, NIGHT - 3600);
      const seen = run(s, 3600 + 14_000);
      if (idea(seen, 'ghost') >= 3) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(RATE.ghost);
  }, 240_000);

  it(`rate check: someone arguing with the dummy on ${RATE.dummy} of ${RATE.seeds} seeds`, () => {
    let hits = 0;
    for (let seed = 1; seed <= RATE.seeds; seed++) {
      const s = world(seed, centre('hearthford.guard_yard'), 19, 9000);
      const seen = run(s, 28_800);
      if (idea(seen, 'dummy') >= 2) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(RATE.dummy);
  }, 180_000);

  it('never starts more of a scene in one real hour than the cap', () => {
    for (let seed = 1; seed <= 4; seed++) {
      // The whole run is four real minutes, so it sits inside one real hour.
      const s = world(seed, centre('hearthford.guard_yard'), 19, 9000);
      const seen = run(s, 7200);
      const starts = seen.lines.filter((l) => !l.reply && kindOf(l.template) === 'dummy');
      expect(starts.length, `seed ${seed}`).toBeLessThanOrEqual(BAL.capPerHour);
    }
  }, 120_000);

  it('only has a wish come true after a real event of theirs, and no earlier than the wait', () => {
    // Drive the engine directly: a wish is on record, then a rank-up arrives.
    const s = world(3, centre('hearthford.square'), 20, 9000);
    run(s, 600);
    const crowd = crowdOf(s);
    const slot = [...crowd.ents.values()][0]!.slot;
    const chat = s.chat!;
    const trial = (ageMin: number): number => {
      let n = 0;
      for (let i = 0; i < 40; i++) {
        chat.scenes.wished.set(slot, crowd.lastMinute - ageMin);
        chat.cooldown.clear();
        chat.lastSpoke[slot] = -1e9;
        chat.queue.length = 0;
        chat.lastMinute = -1;
        s.events.list.length = 0;
        s.events.list.push({ type: 'travelerRankUp', slot, skill: 'skill.blades', points: 10 });
        s.tick += 60;
        chatSystem(s);
        n += chat.queue.filter((q) => q.template.startsWith('scene.wishcame.')).length;
      }
      return n;
    };
    const early = trial(1);
    const later = trial(60);
    expect(early).toBe(0);
    expect(later).toBeGreaterThan(0);
  });
});

/**
 * Staged scenes (POW-M6-20). Each test puts its own cast in place: only those Travelers are online,
 * they are social at the scene's place, and the player stands there. The scene's own chance per
 * in-game minute then makes it all but certain within the run, whatever the dice are, so a new roll
 * elsewhere in chat cannot break these. `STAGED_SEEDS=20` runs each on twenty seeds.
 */
describe('a staged scene', () => {
  /** Warm the crowd up (sessions, positions), then hand the slots their cast. */
  function staged(s: SimState, cast: Cast): void {
    run(s, 2, undefined, cast);
    run(s, 300, undefined, cast);
  }
  const startsOf = (seen: Seen, kind: string): Seen['lines'] =>
    seen.lines.filter((l) => !l.reply && kindOf(l.template) === kind);
  const pick = (seed: number, n: number, ok: (slot: number) => boolean = () => true): number[] =>
    identitiesOf(seed)
      .map((t) => t.slot)
      .filter((slot) => slot >= 24 && ok(slot))
      .slice(0, n);

  it('a wish at the well, by one of the cast, with the toss showing', () => {
    for (const seed of stagedSeeds()) {
      const s = world(seed, centre('hearthford.square'), 19, 9000);
      const cast: Cast = { slots: pick(seed, 3), place: 'hearthford.square' };
      staged(s, cast);
      let toss = false;
      const seen = run(
        s,
        14_400,
        () => {
          for (const v of travelerViews(s)) if (v.glyph === '*' || v.glyph === '+') toss = true;
        },
        cast,
      );
      const wishes = startsOf(seen, 'wish');
      expect(wishes.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const w of wishes) expect(cast.slots, `seed ${seed}`).toContain(w.slot);
      expect(toss, `seed ${seed} toss`).toBe(true);
    }
  }, 240_000);

  it('a dance-off at the inn at dusk, between mates of the cast, dancing', () => {
    for (const seed of stagedSeeds()) {
      const s = world(seed, centre('hearthford.inn'), 20, DUSK - 600);
      const slots = pick(seed, 3);
      // Mates: the same guild makes them a group (design/12 7), as a real guild night would.
      for (const slot of slots) s.travelers[slot]!.guild = 7;
      const cast: Cast = { slots, place: 'hearthford.inn' };
      staged(s, cast);
      s.worldTick = DUSK;
      let danced = false;
      const seen = run(
        s,
        6600,
        () => {
          for (const v of travelerViews(s)) if (v.mode === 'dance') danced = true;
        },
        cast,
      );
      const dances = startsOf(seen, 'dance');
      expect(dances.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const d of seen.lines.filter((l) => kindOf(l.template) === 'dance'))
        expect(slots, `seed ${seed}`).toContain(d.slot);
      expect(danced, `seed ${seed} dancing`).toBe(true);
    }
  }, 240_000);

  it('a ghost story at the river camp at night, told in full by two of the cast', () => {
    const camp = PLACE_SPOTS['wayside.river_camp']!.focus!;
    for (const seed of stagedSeeds()) {
      const s = world(seed, { x: camp[0], y: camp[1] + 3 }, 22, NIGHT - 600);
      const cast: Cast = { slots: pick(seed, 3), place: 'wayside.river_camp' };
      staged(s, cast);
      s.worldTick = NIGHT;
      const seen = run(s, 14_400, undefined, cast);
      const lines = seen.lines.filter((l) => kindOf(l.template) === 'ghost');
      expect(startsOf(seen, 'ghost').length, `seed ${seed}`).toBeGreaterThan(0);
      const first = SCENES.find((x) => x.id === lines[0]!.template)!;
      expect(lines.length, `seed ${seed} whole story`).toBeGreaterThanOrEqual(first.lines.length);
      for (const l of lines) expect(cast.slots, `seed ${seed}`).toContain(l.slot);
    }
  }, 240_000);

  it('a low-rank member of the cast argues with the dummy', () => {
    for (const seed of stagedSeeds()) {
      const s = world(seed, centre('hearthford.guard_yard'), 19, 9000);
      // Pick after the crowd has caught up on login (it raises points), with a margin under the rank.
      run(s, 2);
      const slots = pick(seed, 2, (slot) => topPoints(s, slot) < BAL.dummyRankUnder - 3);
      expect(slots.length, `seed ${seed} has two low-rank Travelers`).toBe(2);
      const cast: Cast = { slots, place: 'hearthford.guard_yard' };
      staged(s, cast);
      const seen = run(s, 14_400, undefined, cast);
      const starts = startsOf(seen, 'dummy');
      expect(starts.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const l of starts) expect(slots, `seed ${seed}`).toContain(l.slot);
    }
  }, 240_000);
});
