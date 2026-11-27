import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { MAP_BALANCE } from '../../src/content/balance/map';
import { DIALOGUES } from '../../src/content/dialogue';
import { trialKey } from '../../src/content/skills';
import { RUMORS } from '../../src/content/world/rumors';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { validateCommand } from '../../src/sim/kernel/commands';
import { addXp, isAwake, pointsOf, xpToNext } from '../../src/sim/skills';
import {
  createDemoState,
  serializeState,
  deserializeState,
  type SimState,
} from '../../src/sim/state';
import { applyEffect } from '../../src/sim/systems/npcs';
import {
  addNote,
  hearRumor,
  mapSystem,
  regionFog,
  removeNote,
  revealPay,
  totalRevealed,
} from '../../src/sim/systems/map';
import { skillsSystem } from '../../src/sim/systems/skills';
import { stepWorld } from '../../src/sim/step';
import { Dir, SUBPX } from '../../src/sim/kernel/fixed';
import { newStream } from '../../src/sim/world/stream';
import { createChunk } from '../../src/sim/world/chunk';
import { TileWorld } from '../../src/sim/world/world';
import {
  BLOCKS_PER_CHUNK,
  FULL_CHUNK,
  countRevealed,
  isRevealed,
  revealBlock,
  revealDisc,
  revealRadius,
  rumorMark,
  type Fog,
} from '../../src/sim/world/fog';

const OPEN = { solidAt: (): number => 0 };

/** Total Cartography XP earned, points included. */
function cartographyXp(s: SimState, me: number): number {
  const sk = s.entities.comps.skills[me]!;
  return (
    (sk.xp['skill.cartography'] ?? 0) +
    Array.from({ length: pointsOf(s, me, 'skill.cartography') }, (_v, p) => xpToNext(p)).reduce(
      (a, b) => a + b,
      0,
    )
  );
}

/** Wakes Cartography the way a manual or a lesson would, without any XP. */
function awakeCartography(s: SimState, me: number): void {
  s.entities.comps.skills[me]!.awake.push('skill.cartography');
}

function world(tx = 40, ty = 40): { s: SimState; me: number } {
  const s = createDemoState(7, 0);
  s.world = OPEN;
  const f = feetAt(tx, ty);
  return { s, me: createAvatar(s, f.x, f.y) };
}

describe('fog bits', () => {
  it('reveals a block once, in any chunk, including negative coordinates', () => {
    const fog: Fog = {};
    expect(isRevealed(fog, 3, 5)).toBe(false);
    expect(revealBlock(fog, 3, 5)).toBe(true);
    expect(revealBlock(fog, 3, 5)).toBe(false);
    expect(isRevealed(fog, 3, 5)).toBe(true);
    expect(isRevealed(fog, 4, 5)).toBe(false);
    expect(revealBlock(fog, -1, -9)).toBe(true);
    expect(Object.keys(fog).sort()).toEqual(['-1,-2', '0,0']);
    expect(countRevealed(fog)).toBe(2);
  });

  it('reveals a disc and reports only the new blocks', () => {
    const fog: Fog = {};
    const n = revealDisc(fog, 20, 20, 3);
    expect(n).toBe(countRevealed(fog));
    expect(n).toBeGreaterThan(25);
    expect(revealDisc(fog, 20, 20, 3)).toBe(0);
    expect(revealDisc(fog, 21, 20, 3)).toBeGreaterThan(0);
  });

  it('never marks a chunk the region does not have', () => {
    const fog: Fog = {};
    revealDisc(fog, 0, 0, 4, (cx, cy) => cx >= 0 && cy >= 0);
    expect(Object.keys(fog)).toEqual(['0,0']);
    expect(isRevealed(fog, -1, 0)).toBe(false);
  });

  it('widens the radius with Cartography points', () => {
    expect(revealRadius(0)).toBe(3);
    expect(revealRadius(14)).toBe(3);
    expect(revealRadius(15)).toBe(4);
    expect(revealRadius(100)).toBe(11);
  });
});

describe('fog storage budget', () => {
  // The continent is about 40 x 40 chunks (design/02). The save budget is 500 KB, and fog may use 8%.
  const BUDGET = 40 * 1024;
  const sim = (fog: Fog): string => {
    const s = createDemoState(1, 0);
    s.map.fog = { continent: fog };
    return serializeState(s);
  };

  it('a fully explored continent compresses under 40 KB', () => {
    const fog: Fog = {};
    for (let cy = 0; cy < 40; cy++) for (let cx = 0; cx < 40; cx++) fog[`${cx},${cy}`] = FULL_CHUNK;
    expect(gzipSync(sim(fog)).length).toBeLessThan(BUDGET);
  });

  it('so does the worst case: every chunk half uncovered at random', () => {
    const fog: Fog = {};
    let seed = 12345;
    const rnd = (): number => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
    for (let cy = 0; cy < 40; cy++)
      for (let cx = 0; cx < 40; cx++)
        fog[`${cx},${cy}`] = Array.from({ length: BLOCKS_PER_CHUNK }, () =>
          Math.floor(rnd() * 256)
            .toString(16)
            .padStart(2, '0'),
        ).join('');
    expect(gzipSync(sim(fog)).length).toBeLessThan(BUDGET);
  });
});

describe('the map system', () => {
  it('uncovers the ground around the avatar and pays Cartography once per block', () => {
    const { s, me } = world();
    // Past the awakening threshold, so every block pays (the threshold has its own tests below).
    awakeCartography(s, me);
    mapSystem(s);
    const fog = regionFog(s);
    expect(isRevealed(fog, 10, 10)).toBe(true);
    expect(isRevealed(fog, 10, 30)).toBe(false);
    const ev = s.events.list.find((e) => e.type === 'revealed');
    expect(ev).toMatchObject({ who: me, blocks: countRevealed(fog) });
    skillsSystem(s);
    const earned = s.entities.comps.skills[me]!;
    const total =
      (earned.xp['skill.cartography'] ?? 0) +
      Array.from({ length: pointsOf(s, me, 'skill.cartography') }, (_v, p) => xpToNext(p)).reduce(
        (a, b) => a + b,
        0,
      );
    expect(total).toBe(countRevealed(fog) * MAP_BALANCE.xpPerBlock);
    // Standing still, and walking over ground already seen, earns nothing more.
    s.events.list.length = 0;
    mapSystem(s);
    expect(s.events.list).toEqual([]);
  });

  it('a first look around the wake point does not wake Cartography', () => {
    const { s, me } = world();
    mapSystem(s);
    const fog = regionFog(s);
    expect(countRevealed(fog)).toBeGreaterThan(0);
    expect(countRevealed(fog)).toBeLessThan(MAP_BALANCE.awakenBlocks);
    skillsSystem(s);
    const sk = s.entities.comps.skills[me]!;
    expect(isAwake(sk, 'skill.cartography')).toBe(false);
    expect(s.events.list.some((e) => e.type === 'skillAwakened')).toBe(false);
  });

  it('wakes Cartography at the threshold, paid for every block uncovered so far', () => {
    const { s, me } = world();
    const fog = regionFog(s);
    for (let i = 0; i < MAP_BALANCE.awakenBlocks - 1; i++) revealBlock(fog, i, 200);
    // One short: a reveal pays nothing.
    s.events.list.length = 0;
    s.events.list.push({ type: 'revealed', who: me, blocks: 1 });
    skillsSystem(s);
    expect(isAwake(s.entities.comps.skills[me]!, 'skill.cartography')).toBe(false);
    // The block that reaches it pays the whole backlog.
    revealBlock(fog, 0, 201);
    s.events.list.length = 0;
    s.events.list.push({ type: 'revealed', who: me, blocks: 1 });
    skillsSystem(s);
    const sk = s.entities.comps.skills[me]!;
    expect(isAwake(sk, 'skill.cartography')).toBe(true);
    expect(cartographyXp(s, me)).toBe(MAP_BALANCE.awakenBlocks * MAP_BALANCE.xpPerBlock);
    expect(totalRevealed(s)).toBe(MAP_BALANCE.awakenBlocks);
  });

  it('counts blocks in every region toward the threshold', () => {
    const { s, me } = world();
    const half = Math.ceil(MAP_BALANCE.awakenBlocks / 2);
    for (let i = 0; i < half; i++) revealBlock(regionFog(s, 'dawnmeadow'), i, 0);
    for (let i = 0; i < half; i++) revealBlock(regionFog(s, 'slice'), i, 0);
    expect(revealPay(s, me, 3)).toBe(totalRevealed(s));
  });

  it('once awake, pays only the new blocks', () => {
    const { s, me } = world();
    awakeCartography(s, me);
    expect(revealPay(s, me, 3)).toBe(3);
  });

  it('reveals further as Cartography grows', () => {
    const a = world();
    mapSystem(a.s);
    const b = world();
    // Rank 15 waits on a passed Trial (design/03), so mark it passed as Hearthford will.
    b.s.entities.comps.skills[b.me]!.passed.push(trialKey('skill.cartography', 15));
    addXp(b.s, b.me, 'skill.cartography', 5000);
    expect(pointsOf(b.s, b.me, 'skill.cartography')).toBeGreaterThanOrEqual(15);
    mapSystem(b.s);
    expect(countRevealed(regionFog(b.s))).toBeGreaterThan(countRevealed(regionFog(a.s)));
  });

  it('pays Cartography when the avatar walks through stepWorld, in the shipped system order', () => {
    const { s, me } = world(10, 10);
    for (let i = 0; i < 400; i++)
      stepWorld(s, me, { commands: [{ type: 'move', dir: Dir.E, full: true }] } as never);
    const walked = Math.floor((s.entities.comps.pos[me]!.x / SUBPX - 10 * 16) / 16);
    expect(walked).toBeGreaterThanOrEqual(40);
    const blocks = countRevealed(regionFog(s));
    expect(blocks).toBeGreaterThan(0);
    expect(s.ledger.xpEarned['skill.cartography']).toBe(blocks * MAP_BALANCE.xpPerBlock);
  });

  it('keeps fog per region and keeps working through the sim step', () => {
    const { s, me } = world();
    s.region = 'dawnmeadow';
    for (let i = 0; i < 3; i++) stepWorld(s, me, { commands: [] } as never);
    expect(Object.keys(s.map.fog)).toEqual(['dawnmeadow']);
  });

  it('does not mark chunks that have not arrived, and fills them in when they do', () => {
    const { s } = world(10, 10);
    const grid = new TileWorld();
    s.stream = newStream(grid, false);
    mapSystem(s);
    expect(Object.keys(regionFog(s))).toEqual([]);
    grid.set(createChunk(0, 0));
    mapSystem(s);
    expect(Object.keys(regionFog(s))).toEqual(['0,0']);
  });

  it('survives a save and load unchanged', () => {
    const { s } = world();
    mapSystem(s);
    addNote(s, 3, 4, 'camp');
    hearRumor(s, 0, 'rumor.quarry_crane');
    const back = deserializeState(serializeState(s));
    expect(back.map).toEqual(s.map);
  });
});

describe('notes', () => {
  it('adds, numbers, removes and caps notes', () => {
    const { s } = world();
    const a = addNote(s, 1, 2, '  good   fishing\n spot ');
    expect(a).toBe(1);
    expect(s.map.notes).toEqual([{ id: 1, x: 1, y: 2, text: 'good fishing spot' }]);
    expect(addNote(s, 1, 2, '   ')).toBeNull();
    expect(addNote(s, 0, 0, 'x'.repeat(100))).toBe(2);
    expect(s.map.notes[1]!.text.length).toBe(MAP_BALANCE.notes.maxLength);
    expect(removeNote(s, 1)).toBe(true);
    expect(removeNote(s, 1)).toBe(false);
    // The next id is never reused.
    expect(addNote(s, 5, 5, 'again')).toBe(3);
    while (s.map.notes.length < MAP_BALANCE.notes.max) addNote(s, 0, 0, 'n');
    expect(addNote(s, 0, 0, 'one too many')).toBeNull();
  });

  it('validates the commands', () => {
    expect(validateCommand({ type: 'noteAdd', x: 3, y: 4, text: ' hi ' })).toEqual({
      ok: true,
      command: { type: 'noteAdd', x: 3, y: 4, text: 'hi' },
    });
    for (const bad of [
      { type: 'noteAdd', x: 1.5, y: 4, text: 'a' },
      { type: 'noteAdd', x: 3, y: 4, text: '' },
      { type: 'noteAdd', x: 3, y: 4, text: 7 },
      { type: 'noteRemove', id: 0 },
      { type: 'noteRemove', id: 'x' },
    ])
      expect(validateCommand(bad).ok).toBe(false);
  });

  it('applies the commands through the avatar', () => {
    const { s, me } = world();
    stepWorld(s, me, { commands: [{ type: 'noteAdd', x: 9, y: 9, text: 'well' }] } as never);
    expect(s.map.notes.map((n) => n.text)).toEqual(['well']);
    stepWorld(s, me, { commands: [{ type: 'noteRemove', id: 1 }] } as never);
    expect(s.map.notes).toEqual([]);
  });
});

describe('rumor marks', () => {
  const r = RUMORS['rumor.quarry_crane']!;
  const seed = 99;

  it('is off the true spot at low rank, closer as Cartography grows, and exact from 75', () => {
    const d = (p: number): number => {
      const m = rumorMark(seed, r.id, r.x, r.y, p);
      return Math.max(Math.abs(m.x - r.x), Math.abs(m.y - r.y));
    };
    expect(d(0)).toBeGreaterThan(0);
    expect(d(0)).toBeLessThanOrEqual(MAP_BALANCE.rumor.maxOffsetTiles);
    for (let p = 0; p < 75; p += 5) expect(d(p + 5)).toBeLessThanOrEqual(d(p));
    expect(d(75)).toBe(0);
    expect(d(100)).toBe(0);
  });

  it('is the same mark every time for one save, and differs between saves and rumors', () => {
    const a = rumorMark(seed, r.id, r.x, r.y, 0);
    expect(rumorMark(seed, r.id, r.x, r.y, 0)).toEqual(a);
    const others = [
      rumorMark(seed + 1, r.id, r.x, r.y, 0),
      rumorMark(seed, 'rumor.mill_sails', r.x, r.y, 0),
    ];
    expect(others.some((o) => o.x !== a.x || o.y !== a.y)).toBe(true);
  });

  it('is learned from dialogue once, and unknown rumors do nothing', () => {
    const { s, me } = world();
    applyEffect(s, me, { rumor: 'rumor.quarry_crane' });
    applyEffect(s, me, { rumor: 'rumor.quarry_crane' });
    applyEffect(s, me, { rumor: 'rumor.nothing' });
    expect(s.map.rumors).toEqual(['rumor.quarry_crane']);
  });

  it('never points at a wake point', () => {
    // Wake points are where a character starts, and the map never marks them (design/02).
    for (const def of Object.values(RUMORS)) expect(def.id.includes('wake')).toBe(false);
  });

  it('only names rumors dialogue can tell', () => {
    for (const d of Object.values(DIALOGUES))
      for (const e of JSON.stringify(d).matchAll(/"rumor":"([^"]+)"/g))
        expect(RUMORS[e[1]!]).toBeDefined();
  });
});
