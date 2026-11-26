import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PIT } from '../../src/content/balance/travelers';
import { PIT_RUMORS } from '../../src/content/chat/rumorsPit';
import { RUMORS } from '../../src/content/chat/rumors';
import { validateShippedChat } from '../../src/content/chat/validate';
import { PLACES } from '../../src/content/people/places';
import { PLACE_SPOTS } from '../../src/content/people/placeSpots';
import { FIXTURES } from '../../src/content/world/fixtures';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { createAvatar } from '../../src/sim/avatar';
import { chatSystem } from '../../src/sim/chat/engine';
import { getComp } from '../../src/sim/kernel/entities';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { interactFixture, spawnFixture } from '../../src/sim/systems/fixtures';
import { applyDelta, captureDelta } from '../../src/sim/world/deltas';
import { CHUNK_TILES, decodeChunk } from '../../src/sim/world/chunk';
import { chooseNext, crowdOf, newCrowd, travelersSystem } from '../../src/sim/travelers/crowd';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { PLACE_LIST } from '../../src/sim/travelers/lists';
import { addFlag, hasFlag, pitOpen, pitSystem } from '../../src/sim/travelers/pit';
import { bakeRegion } from '../../tools/bake-world/bake';

/**
 * The Pit, finding it (POW-M5-29): an old working at the quarry lip, closed by crates that slide
 * aside once, three rumors that lead the way in order, and Travelers who like a duel using it after.
 */

const files = bakeRegion(DAWNMEADOW, STAMPS);
const chunks = new Map<string, ReturnType<typeof decodeChunk>>();
const objs = new Map<string, string>();
for (const [name, v] of files) {
  if (!/^dawnmeadow\/chunk-/.test(name)) continue;
  const c = decodeChunk(v as Uint8Array);
  chunks.set(`${c.cx},${c.cy}`, c);
  for (const o of c.objects)
    objs.set(`${c.cx * CHUNK_TILES + o.x},${c.cy * CHUNK_TILES + o.y}`, o.kind);
}

describe('the crates', () => {
  const setup = () => {
    const s = createDemoState(5, 0);
    s.world = { solidAt: (): number => 0 };
    const me = createAvatar(s, px(10 * 16 + 8), px(11 * 16 + 16));
    getComp(s.entities, me, 'avatar')!.facing = 0;
    const id = spawnFixture(s, 'fixture.pit_crates', 10, 10);
    return { s, me, id };
  };

  it('block until used, then slide aside for good and set the flag', () => {
    const { s, me, id } = setup();
    expect(getComp(s.entities, id, 'body')!.solid).toBe(true);
    expect(pitOpen(s)).toBe(false);
    interactFixture(s, me);
    expect(getComp(s.entities, id, 'fixture')!.open).toBe(true);
    expect(getComp(s.entities, id, 'body')!.solid).toBe(false);
    expect(pitOpen(s)).toBe(true);
    expect(s.events.list.filter((e) => e.type === 'slideOpened')).toHaveLength(1);
    // Using them again does nothing.
    s.events.list.length = 0;
    interactFixture(s, me);
    expect(s.events.list.filter((e) => e.type === 'slideOpened')).toHaveLength(0);
  });

  it('stay open after a reload: the change is a chunk delta that is applied when the chunk returns', () => {
    const { s, me, id } = setup();
    interactFixture(s, me);
    const delta = captureDelta(s, id, 'fixture', 'fixture.pit_crates', 10, 10);
    expect(delta).not.toBeNull();
    const t = createDemoState(5, 0);
    const again = spawnFixture(t, 'fixture.pit_crates', 10, 10);
    expect(getComp(t.entities, again, 'body')!.solid).toBe(true);
    applyDelta(t, again, delta!);
    expect(getComp(t.entities, again, 'fixture')!.open).toBe(true);
    expect(getComp(t.entities, again, 'body')!.solid).toBe(false);
  });

  it('are a fixture the region places once, in the gap of the Pit rim', () => {
    expect(FIXTURES['fixture.pit_crates']).toMatchObject({ type: 'slide' });
    const at = [...objs].filter(([, k]) => k === 'fixture.pit_crates');
    expect(at).toHaveLength(1);
    expect(at[0]![0]).toBe('190,35');
  });
});

describe('the Pit as baked', () => {
  const solidAt = (x: number, y: number, crates: boolean): boolean => {
    const c = chunks.get(`${Math.floor(x / CHUNK_TILES)},${Math.floor(y / CHUNK_TILES)}`);
    if (!c) return true;
    const kind = objs.get(`${x},${y}`);
    return (
      c.collision[(y % CHUNK_TILES) * CHUNK_TILES + (x % CHUNK_TILES)] !== 0 ||
      (kind !== undefined && !(crates && kind === 'fixture.pit_crates'))
    );
  };
  const reach = (from: [number, number], crates: boolean): Set<string> => {
    const seen = new Set([`${from[0]},${from[1]}`]);
    const q = [from];
    for (let i = 0; i < q.length && i < 60_000; i++) {
      const [x, y] = q[i]!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const k = `${x + dx},${y + dy}`;
        if (seen.has(k) || solidAt(x + dx, y + dy, crates)) continue;
        seen.add(k);
        q.push([x + dx, y + dy]);
      }
    }
    return seen;
  };

  it('is a place with spectator and fighter slots, all open ground', () => {
    expect(PLACES[PIT.place]).toMatchObject({ area: 'stonecrop', indoors: false });
    const spot = PLACE_SPOTS[PIT.place]!;
    expect(spot.slots.length).toBeGreaterThanOrEqual(8);
    for (const [x, y] of spot.slots) expect(solidAt(x, y, false), `${x},${y}`).toBe(false);
    // The place is added last, so saved place indices hold.
    expect(PLACE_LIST.indexOf(PIT.place)).toBe(PLACE_LIST.length - 1);
  });

  it('cannot be entered from the quarry until the crates are open, and then can from outside', () => {
    const outside: [number, number] = [189, 35];
    const slots = PLACE_SPOTS[PIT.place]!.slots;
    const shut = reach(outside, false);
    for (const [x, y] of slots) expect(shut.has(`${x},${y}`), `shut ${x},${y}`).toBe(false);
    const open = reach(outside, true);
    for (const [x, y] of slots) expect(open.has(`${x},${y}`), `open ${x},${y}`).toBe(true);
  });

  it('keeps clear of the Stonecrop Deeps mouth, the camp and its altar, and the quarry place', () => {
    const r = { x: 190, y: 32, w: 10, h: 7 };
    const inside = (x: number, y: number): boolean =>
      x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    for (const [k, kind] of objs) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      if (!inside(x, y)) continue;
      expect(
        [
          'fixture.pit_crates',
          'tile.wall_stone_v',
          'tile.wall_stone_h',
          'tile.wall_stone_post',
          'tile.torch',
        ],
        `${kind} at ${k}`,
      ).toContain(kind);
    }
    const q = PLACE_SPOTS['stonecrop.quarry']!.rect;
    expect(q.x + q.w <= r.x || r.x + r.w <= q.x || q.y + q.h <= r.y || r.y + r.h <= q.y).toBe(true);
    // The Deeps mouth is at (175, 63) and the camp's stamp ends at x 189, y 57.
    expect(r.y + r.h).toBeLessThan(63);
    expect(r.x).toBeGreaterThanOrEqual(190);
  });
});

describe('nothing else needs the Pit', () => {
  const ALLOWED = [
    'balance/travelers.ts',
    'chat/rumorsPit.ts',
    'chat/rumors.ts',
    'people/places.ts',
    'people/placeSpots.ts',
    'world/fixtures.ts',
    'world/stamps/dawnmeadow.ts',
    'world/regions/dawnmeadow/spec.ts',
    'strings/ui.ts',
    'sprites/gen/world.ts',
  ];
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });

  it('no quest, Trial, recipe, item or Singular in content mentions the Pit or its flags', () => {
    const root = join(process.cwd(), 'src', 'content');
    for (const f of walk(root)) {
      if (!f.endsWith('.ts')) continue;
      const rel = f.slice(root.length + 1);
      if (ALLOWED.some((a) => rel === a)) continue;
      const text = readFileSync(f, 'utf8');
      expect(text, rel).not.toMatch(/pit_open|pit_crates|pit_rumor|stonecrop\.pit|quarry_pit/);
    }
  });
});

describe('the rumors', () => {
  it('are three, true, in order, and validated: no town, nothing underground, nothing hidden', () => {
    expect(PIT_RUMORS.map((r) => r.id)).toEqual(['rumor.pit_1', 'rumor.pit_2', 'rumor.pit_3']);
    expect(PIT_RUMORS.every((r) => r.true && r.about === 'place')).toBe(true);
    expect(validateShippedChat()).toEqual([]);
    for (const r of PIT_RUMORS) {
      expect(r.text).toMatch(/old cut|crane/);
      expect(r.text).not.toMatch(
        /hearthford|millbrook|reedmouth|under|beneath|below|dungeon|sealed/i,
      );
    }
    // Rumor 1 needs nothing, 2 needs 1 and a visit, 3 needs 2.
    expect(PIT_RUMORS[0]!.gate!.needs).toEqual([]);
    expect(PIT_RUMORS[1]!.gate!.needs).toEqual([PIT.flags.rumor1, PIT.flags.quarry]);
    expect(PIT_RUMORS[2]!.gate!.needs).toEqual([PIT.flags.rumor2]);
    expect(RUMORS.filter((r) => r.gate)).toHaveLength(3);
  });

  it('count a visit to the quarry as having been there', () => {
    const s = createDemoState(5, 0);
    const q = PLACE_SPOTS[PIT.visitPlace]!.rect;
    createAvatar(s, px(q.x * 16 + 8), px(q.y * 16 + 8));
    expect(hasFlag(s, PIT.flags.quarry)).toBe(false);
    s.tick = 30;
    pitSystem(s);
    expect(hasFlag(s, PIT.flags.quarry)).toBe(true);
    const far = createDemoState(5, 0);
    createAvatar(far, px(20 * 16), px(20 * 16));
    far.tick = 30;
    pitSystem(far);
    expect(hasFlag(far, PIT.flags.quarry)).toBe(false);
  });
});

const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const START = (MON + 2) * 86_400_000 + 8 * 3_600_000;

function world(seed: number): SimState {
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  createAvatar(s, px(192 * 16 + 8), px(193 * 16 + 8));
  s.weatherOverride = 'clear';
  s.clock = { nowMs: START, epochMs: START - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

/** One minute of the crowd and the chat, as in the chat tests. */
function minute(s: SimState, m: number): void {
  const base = START;
  s.tick += 60;
  s.worldTick += 60;
  s.clock = { ...s.clock!, nowMs: base + m * 60_000 };
  s.events.list.length = 0;
  travelersSystem(s);
  chatSystem(s);
}

describe('over a simulated week', () => {
  it('each rumor is said at least once, in order, and only after its gate', () => {
    const s = world(3);
    const heardAt = new Map<string, number>();
    const quarryAt = new Map<string, number>();
    let visitAt = -1;
    for (let m = 0; m < 7 * 1440; m++) {
      const flagsBefore = new Set(getComp(s.entities, 0, 'journal')!.flags);
      minute(s, m);
      for (const e of s.events.list) {
        if (e.type !== 'travelerSpoke' || e.slots.rumor === undefined) continue;
        const r = PIT_RUMORS.find((x) => x.text === e.slots.rumor);
        if (!r) continue;
        // Only after its gate: every flag it needs was already in the journal before this minute.
        for (const need of r.gate!.needs)
          expect(flagsBefore.has(need), `${r.id} needs ${need}`).toBe(true);
        if (!heardAt.has(r.id)) heardAt.set(r.id, m);
      }
      // The player walks to the quarry an hour after hearing the first.
      if (heardAt.has('rumor.pit_1') && visitAt < 0 && m - heardAt.get('rumor.pit_1')! >= 60) {
        visitAt = m;
        addFlag(s, PIT.flags.quarry);
      }
    }
    void quarryAt;
    expect([...heardAt.keys()].sort()).toEqual(['rumor.pit_1', 'rumor.pit_2', 'rumor.pit_3']);
    expect(heardAt.get('rumor.pit_1')!).toBeLessThan(heardAt.get('rumor.pit_2')!);
    expect(heardAt.get('rumor.pit_2')!).toBeLessThan(heardAt.get('rumor.pit_3')!);
    expect(heardAt.get('rumor.pit_2')!).toBeGreaterThanOrEqual(visitAt);
  }, 180_000);

  it('rumors 2 and 3 are never told to a player who has not been to the quarry', () => {
    const s = world(5);
    const told = new Set<string>();
    for (let m = 0; m < 3 * 1440; m++) {
      minute(s, m);
      for (const e of s.events.list)
        if (e.type === 'travelerSpoke' && e.slots.rumor !== undefined)
          for (const r of PIT_RUMORS) if (r.text === e.slots.rumor) told.add(r.id);
    }
    expect(told.has('rumor.pit_2')).toBe(false);
    expect(told.has('rumor.pit_3')).toBe(false);
  }, 180_000);
});

describe('who goes to the Pit', () => {
  const pitIdx = PLACE_LIST.indexOf(PIT.place);
  const count = (
    s: SimState,
    pick: (t: ReturnType<typeof identitiesOf>[number]) => boolean,
  ): number => {
    const crowd = newCrowd(5);
    let n = 0;
    for (const t of identitiesOf(5).filter(pick))
      for (let i = 0; i < 30; i++) {
        const d = chooseNext(s, crowd, t);
        if (d.kind === 'social' && d.place === pitIdx) n++;
      }
    return n;
  };

  it('nobody until it is open, then duel-minded Travelers only', () => {
    const s = world(5);
    s.worldTick = 9000;
    const duel = (t: ReturnType<typeof identitiesOf>[number]): boolean =>
      t.temper === 'bold' ||
      s.travelers[t.slot]!.guild === 9 ||
      t.handle === 'NoScopeNed' ||
      t.handle === 'Skarrow';
    expect(count(s, () => true)).toBe(0);
    addFlag(s, PIT.flags.open);
    expect(count(s, duel)).toBeGreaterThan(0);
    expect(count(s, (t) => !duel(t))).toBe(0);
    void crowdOf;
  });
});
