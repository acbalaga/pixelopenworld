import { describe, expect, it } from 'vitest';
import { SLICE_MAP } from '../../src/content/world/slice-map';
import { WAKE_IDS, WAKE_LANDMARKS, WAKE_POINTS, type WakeId } from '../../src/content/world/wake';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { knownTechniques } from '../../src/sim/combat/techniques';
import { kill } from '../../src/sim/combat/fighter';
import { Dir } from '../../src/sim/kernel/fixed';
import { countItem } from '../../src/sim/items';
import { createStreams } from '../../src/sim/kernel/rng';
import { createDemoState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { chooseWake, facingTown } from '../../src/sim/world/wake';
import { buildChunks } from '../../src/sim/world/stamp';
import { TileWorld } from '../../src/sim/world/world';
import { collisionOfCell } from '../../tools/bake-assets/world';

const chunks = buildChunks(SLICE_MAP, collisionOfCell);
const objects = chunks.flatMap((c) =>
  c.objects.map((o) => ({ kind: o.kind, x: c.cx * 32 + o.x, y: c.cy * 32 + o.y })),
);

describe('the creation seed and the start stream', () => {
  it('the start stream is new and appended, so no other stream moves', () => {
    const a = createStreams(1234);
    const before = JSON.stringify({ ...a, start: undefined });
    expect(Object.keys(a).at(-1)).toBe('start');
    expect(JSON.stringify({ ...createStreams(1234), start: undefined })).toBe(before);
  });

  it('over 1,000 seeds every wake point is chosen, none more than twice as often as another', () => {
    const tally: Record<string, number> = Object.fromEntries(WAKE_IDS.map((w) => [w, 0]));
    for (let seed = 1; seed <= 1000; seed++) {
      const s = createDemoState(seed * 2654435761, 0);
      tally[chooseWake(s).id]!++;
    }
    const counts = Object.values(tally);
    expect(Math.min(...counts)).toBeGreaterThan(0);
    expect(Math.max(...counts)).toBeLessThanOrEqual(2 * Math.min(...counts));
  });

  it('the same seed wakes in the same place, and an allowed list narrows the choice', () => {
    expect(chooseWake(createDemoState(99, 0))).toEqual(chooseWake(createDemoState(99, 0)));
    for (let seed = 1; seed <= 50; seed++)
      expect(['w3', 'w5']).toContain(chooseWake(createDemoState(seed, 0), ['w3', 'w5']).id);
  });

  it('the character faces the nearest landmark', () => {
    // w1 is west of the square: the fence corner and Waystone are to its east.
    expect(facingTown(WAKE_POINTS.w1.x, WAKE_POINTS.w1.y)).toBe(Dir.E);
    // w7 is south of it: town is north.
    expect(facingTown(WAKE_POINTS.w7.x, WAKE_POINTS.w7.y)).toBe(Dir.N);
  });
});

describe('the eight wake points on the slice map', () => {
  const solid = (x: number, y: number): boolean => {
    const c = chunks.find((k) => k.cx === Math.floor(x / 32) && k.cy === Math.floor(y / 32));
    return !c || c.collision[(y % 32) * 32 + (x % 32)] !== 0;
  };
  const waystone = objects.find((o) => o.kind === 'fixture.waystone')!;
  const spawners = objects.filter((o) => o.kind.startsWith('spawner.'));

  it('are placed as wake.w1 to wake.w8 objects', () => {
    for (const id of WAKE_IDS) {
      const o = objects.find((e) => e.kind === `wake.${id}`);
      expect(o, id).toMatchObject(WAKE_POINTS[id]);
    }
  });

  it.each(WAKE_IDS)(
    '%s is open ground, 25+ tiles from the Waystone, 12+ from any spawner, outside the fence',
    (id: WakeId) => {
      const p = WAKE_POINTS[id];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) expect(solid(p.x + dx, p.y + dy)).toBe(false);
      expect(Math.hypot(p.x - waystone.x, p.y - waystone.y)).toBeGreaterThanOrEqual(25);
      for (const sp of spawners)
        expect(Math.hypot(p.x - sp.x, p.y - sp.y)).toBeGreaterThanOrEqual(12);
      const nw = WAKE_LANDMARKS.find((l) => l.id === 'fence_nw')!;
      const se = WAKE_LANDMARKS.find((l) => l.id === 'fence_se')!;
      const inside = p.x >= nw.x && p.x <= se.x && p.y >= nw.y && p.y <= se.y;
      expect(inside).toBe(false);
    },
  );
});

describe('the bare kit', () => {
  it('a new character holds one bread, the wooden dagger and ragged clothes, and nothing else', () => {
    const s = createDemoState(5, 0);
    const f = feetAt(20, 20);
    const me = createAvatar(s, f.x, f.y);
    const inv = s.entities.comps.inventory[me]!;
    expect(inv.equipment.main?.item).toBe('item.dagger_wood');
    expect(inv.equipment.body?.item).toBe('item.outfit_ragged');
    expect(inv.equipment.off).toBeNull();
    expect(inv.equipment.head).toBeNull();
    expect(inv.equipment.legs).toBeNull();
    expect(inv.equipment.accessory).toBeNull();
    expect(inv.slots.filter(Boolean)).toHaveLength(1);
    expect(countItem(inv, 'item.dish_bread')).toBe(1);
    // No technique is known yet: the basic swing is all there is, so every slot is empty.
    expect(s.entities.comps.fighter[me]!.slots).toEqual([null, null, null, null]);
    expect(knownTechniques(s, me)).toEqual([]);
    expect(s.ledger.startKit).toBe(2);
  });
});

describe('dying before a Waystone or bed', () => {
  it('respawns at the wake point', () => {
    const s = createDemoState(8, 0);
    s.world = new TileWorld(chunks);
    const p = WAKE_POINTS.w2;
    const f = feetAt(p.x, p.y);
    const me = createAvatar(s, f.x, f.y);
    const a = s.entities.comps.avatar[me]!;
    expect(a.respawn).toEqual({ x: f.x, y: f.y });
    // Walk off a little, then die.
    for (let i = 0; i < 20; i++) stepWorld(s, me, { commands: [{ type: 'move', dir: Dir.E }] });
    const moved = s.entities.comps.pos[me]!.x;
    expect(moved).toBeGreaterThan(f.x);
    kill(s, me);
    for (let i = 0; i < 200; i++) stepWorld(s, me, { commands: [] });
    expect(s.entities.comps.pos[me]).toEqual({ x: f.x, y: f.y });
  });
});
