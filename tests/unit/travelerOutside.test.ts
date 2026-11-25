import { describe, expect, it } from 'vitest';
import { createAvatar } from '../../src/sim/avatar';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { crowdOf, travelersSystem } from '../../src/sim/travelers/crowd';
import { isBlockedAt, openSpot, standPx } from '../../src/sim/travelers/entities';
import { PLACE_LIST } from '../../src/sim/travelers/lists';

/**
 * Travelers never stand in a building (POW-M5-24, from the Gate G5a playtest: some got stuck in
 * buildings when the square was crowded). One that finds itself on a solid tile, or is promoted onto
 * one, is put back on the nearest open ground.
 */
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;
const SQUARE = standPx(0, PLACE_LIST.indexOf('hearthford.square'))!;
const T = 16;

/** Ground that is open except for a 5 by 5 block of "building" around a point, which can be switched on. */
function gridWith(block: { x: number; y: number; on: boolean }): SimState['world'] {
  return {
    solidAt: (tx: number, ty: number): number =>
      block.on && Math.abs(tx - block.x) <= 2 && Math.abs(ty - block.y) <= 2 ? 1 : 0,
  };
}

function world(block: { x: number; y: number; on: boolean }): SimState {
  const s = createDemoState(3, 0);
  s.world = gridWith(block);
  createAvatar(s, px(SQUARE.x), px(SQUARE.y));
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

function run(s: SimState, ticks: number): void {
  const base = s.clock!.nowMs;
  const start = s.tick;
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    s.worldTick++;
    s.clock = { ...s.clock!, nowMs: base + Math.floor(((s.tick - start) * 1000) / 30) };
    s.events.list.length = 0;
    travelersSystem(s);
  }
}

describe('open spots', () => {
  it('leaves open ground alone and finds the nearest open tile for a blocked point', () => {
    const s = world({ x: 10, y: 10, on: true });
    const free = { x: 40 * T + 8, y: 40 * T + 14 };
    expect(openSpot(s, free.x, free.y)).toEqual(free);
    const inside = { x: 10 * T + 8, y: 10 * T + 14 };
    expect(isBlockedAt(s, inside.x, inside.y)).toBe(true);
    const out = openSpot(s, inside.x, inside.y);
    expect(isBlockedAt(s, out.x, out.y)).toBe(false);
    // The block is 5 tiles wide, so the nearest open tile is 3 tiles from its center.
    expect(Math.max(Math.abs(out.x - inside.x), Math.abs(out.y - inside.y))).toBeLessThanOrEqual(
      3 * T,
    );
  });

  it('skips a one-tile pocket inside a building', () => {
    const s = createDemoState(1, 0);
    // Everything solid except one pocket tile at (5, 5) and open ground from x >= 8.
    s.world = {
      solidAt: (tx: number, ty: number): number => (tx >= 8 || (tx === 5 && ty === 5) ? 0 : 1),
    };
    const out = openSpot(s, 4 * T + 8, 5 * T + 14);
    expect(Math.floor(out.x / T)).toBeGreaterThanOrEqual(8);
  });
});

describe('Travelers in a crowd', () => {
  it('puts one that finds itself in a building back outside', () => {
    const block = { x: 0, y: 0, on: false };
    const s = world(block);
    run(s, 300);
    const c = crowdOf(s);
    expect(c.ents.size).toBeGreaterThan(2);
    // A building appears around one of them.
    const id = [...c.ents.keys()][0]!;
    const p = s.entities.comps.pos[id]!;
    block.x = Math.floor(p.x / 256 / T);
    block.y = Math.floor((p.y / 256 - 1) / T);
    block.on = true;
    expect(isBlockedAt(s, p.x / 256, p.y / 256)).toBe(true);
    run(s, 90);
    const q = s.entities.comps.pos[id];
    expect(q).toBeDefined();
    expect(isBlockedAt(s, q!.x / 256, q!.y / 256)).toBe(false);
  });

  it('never promotes a Traveler onto a solid tile', () => {
    const block = { x: 0, y: 0, on: true };
    // The building covers the square where the avatar stands, so everyone promoted starts nearby.
    block.x = Math.floor(SQUARE.x / T);
    block.y = Math.floor(SQUARE.y / T);
    const s = world(block);
    run(s, 300);
    const c = crowdOf(s);
    expect(c.ents.size).toBeGreaterThan(0);
    for (const id of c.ents.keys()) {
      const p = s.entities.comps.pos[id]!;
      expect(isBlockedAt(s, p.x / 256, p.y / 256), `entity ${id}`).toBe(false);
    }
  });
});
