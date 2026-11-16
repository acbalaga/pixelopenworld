import { describe, expect, it } from 'vitest';
import { COMBAT } from '../../src/content/balance/combat';
import { MOVEMENT as M } from '../../src/content/balance/movement';
import { applyAvatarCommand, createAvatar, feetAt } from '../../src/sim/avatar';
import { createDemoState, hashState, type SimState } from '../../src/sim/state';
import { Dir, px, type Direction } from '../../src/sim/kernel/fixed';
import { setComp, spawn } from '../../src/sim/kernel/entities';
import { validateCommand } from '../../src/sim/kernel/commands';
import { stepWorld } from '../../src/sim/step';
import { contextTarget } from '../../src/sim/systems/interact';
import { TILE_FX, type CollisionGrid } from '../../src/sim/systems/collision';

/** A grid from rows of text: '#' is solid, '.' is open. Outside the rows is solid. */
function grid(rows: string[]): CollisionGrid {
  return {
    solidAt: (tx, ty) => (rows[ty]?.[tx] === '.' ? 0 : 1),
  };
}

const OPEN = grid(
  Array.from({ length: 40 }, () => `#${'.'.repeat(38)}#`).map((r, i) =>
    i === 0 || i === 39 ? '#'.repeat(40) : r,
  ),
);

function world(g: CollisionGrid, tx = 20, ty = 20): { s: SimState; id: number } {
  const s = createDemoState(1, 0);
  s.world = g;
  const f = feetAt(tx, ty);
  const id = createAvatar(s, f.x, f.y);
  return { s, id };
}

function press(s: SimState, id: number, dir: Direction | null, full = false, ticks = 1): void {
  stepWorld(s, id, {
    commands: [full ? { type: 'move', dir, full: true } : { type: 'move', dir }],
  });
  for (let i = 1; i < ticks; i++) stepWorld(s, id, { commands: [] });
}

const vel = (s: SimState, id: number) => s.entities.comps.vel[id] as { x: number; y: number };
const pos = (s: SimState, id: number) => s.entities.comps.pos[id] as { x: number; y: number };
const avatar = (s: SimState, id: number) =>
  s.entities.comps.avatar[id] as NonNullable<SimState['entities']['comps']['avatar'][number]>;

describe('movement ramps', () => {
  it('reaches top speed in exactly accelTicks ticks', () => {
    const { s, id } = world(OPEN);
    press(s, id, Dir.E, false, M.accelTicks - 1);
    expect(vel(s, id).x).toBeLessThan(M.walkSpeed);
    expect(vel(s, id).x).toBeGreaterThan(0);
    stepWorld(s, id, { commands: [] });
    expect(vel(s, id).x).toBe(M.walkSpeed);
  });

  it('stops in at most decelTicks ticks after release', () => {
    const { s, id } = world(OPEN);
    press(s, id, Dir.E, false, 10);
    press(s, id, null, false, M.decelTicks);
    expect(vel(s, id)).toEqual({ x: 0, y: 0 });
    const x = pos(s, id).x;
    stepWorld(s, id, { commands: [] });
    expect(pos(s, id).x).toBe(x);
  });

  it('diagonal travel is not faster than cardinal', () => {
    const a = world(OPEN);
    const b = world(OPEN);
    press(a.s, a.id, Dir.E, false, 30);
    press(b.s, b.id, Dir.SE, false, 30);
    const e0 = feetAt(20, 20);
    const east = pos(a.s, a.id).x - e0.x;
    const dx = pos(b.s, b.id).x - e0.x;
    const dy = pos(b.s, b.id).y - e0.y;
    expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(east * 1.002);
    expect(Math.hypot(dx, dy)).toBeGreaterThan(east * 0.98);
  });

  it('every one of the eight directions reaches the same speed within rounding', () => {
    for (const dir of [0, 1, 2, 3, 4, 5, 6, 7] as const) {
      const { s, id } = world(OPEN);
      press(s, id, dir, false, 10);
      const v = vel(s, id);
      expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(M.walkSpeed + 1);
      expect(Math.hypot(v.x, v.y)).toBeGreaterThan(M.walkSpeed - 2);
    }
  });
});

describe('collision', () => {
  const WALL = grid(
    Array.from({ length: 12 }, (_, y) => (y === 0 || y === 11 ? '#'.repeat(12) : `#.........#`)),
  );

  it('does not stick to a wall: a diagonal push slides along it', () => {
    const { s, id } = world(WALL, 5, 8);
    press(s, id, Dir.NE, false, 120);
    // Flush against the east wall (tile 10 starts at x = 160 px), and moved north along it.
    expect(pos(s, id).x + (px(M.bodyW) >> 1)).toBe(10 * TILE_FX);
    expect(pos(s, id).y - px(M.bodyH)).toBe(1 * TILE_FX);
    expect(vel(s, id).x).toBe(0);
  });

  it('keeps moving along a wall made of several tiles without snagging on seams', () => {
    const { s, id } = world(WALL, 9, 9);
    const ys: number[] = [];
    press(s, id, Dir.SE, false, 1);
    for (let i = 0; i < 20; i++) {
      stepWorld(s, id, { commands: [] });
      ys.push(pos(s, id).y);
    }
    for (let i = 1; i < ys.length; i++) {
      const prev = ys[i - 1] as number;
      const cur = ys[i] as number;
      if (cur === px(11 * 16)) break;
      expect(cur).toBeGreaterThan(prev);
    }
  });

  it('is blocked by solid bodies and passes through non-solid ones', () => {
    const { s, id } = world(OPEN);
    const f = feetAt(20, 20);
    const rock = spawn(s.entities);
    setComp(s.entities, rock, 'pos', { x: f.x + px(30), y: f.y });
    setComp(s.entities, rock, 'body', { w: px(12), h: px(8), solid: true });
    press(s, id, Dir.E, false, 40);
    // Avatar right edge (feet x + 5 px) stops at the rock's left edge (rock x - 6 px).
    expect(pos(s, id).x).toBe(f.x + px(30) - px(6) - px(5));

    const { s: s2, id: id2 } = world(OPEN);
    const ghost = spawn(s2.entities);
    setComp(s2.entities, ghost, 'pos', { x: f.x + px(30), y: f.y });
    setComp(s2.entities, ghost, 'body', { w: px(12), h: px(8), solid: false });
    press(s2, id2, Dir.E, false, 40);
    expect(pos(s2, id2).x).toBeGreaterThan(f.x + px(30));
  });

  it('can walk out of a body it starts inside', () => {
    const { s, id } = world(OPEN);
    const f = feetAt(20, 20);
    const rock = spawn(s.entities);
    setComp(s.entities, rock, 'pos', { x: f.x, y: f.y });
    setComp(s.entities, rock, 'body', { w: px(12), h: px(8), solid: true });
    press(s, id, Dir.E, false, 30);
    expect(pos(s, id).x).toBeGreaterThan(f.x + px(10));
  });
});

describe('sprint', () => {
  it('starts after the stick is held at full extent for sprintHoldTicks and drains stamina', () => {
    const { s, id } = world(OPEN);
    press(s, id, Dir.E, true, M.sprintHoldTicks - 1);
    expect(avatar(s, id).sprinting).toBe(false);
    stepWorld(s, id, { commands: [] });
    expect(avatar(s, id).sprinting).toBe(true);
    for (let i = 0; i < 5; i++) stepWorld(s, id, { commands: [] });
    expect(vel(s, id).x).toBe(Math.round((M.walkSpeed * M.sprintFactor256) / 256));
    const pools = s.entities.comps.pools[id];
    expect(pools?.sta).toBeLessThan(pools?.staMax ?? 0);
  });

  it('a partial stick never sprints, and letting go resets the hold', () => {
    const { s, id } = world(OPEN);
    press(s, id, Dir.E, false, 60);
    expect(avatar(s, id).sprinting).toBe(false);
    press(s, id, Dir.E, true, M.sprintHoldTicks - 2);
    press(s, id, Dir.E, false, 1);
    press(s, id, Dir.E, true, 3);
    expect(avatar(s, id).sprinting).toBe(false);
  });

  it('running dry ends sprint and it stays off until stamina recovers', () => {
    const { s, id } = world(OPEN, 3, 20);
    // Keep stamina from being the only limit: walls are far enough at 38 tiles for 5 s of sprint.
    press(s, id, Dir.E, true, M.sprintHoldTicks + COMBAT.pools.staMax / M.sprintDrain + 2);
    const a = avatar(s, id);
    expect(a.winded).toBe(true);
    expect(a.sprinting).toBe(false);
    press(s, id, Dir.E, true, 5);
    expect(a.sprinting).toBe(false);
    press(
      s,
      id,
      Dir.E,
      true,
      COMBAT.pools.staRegenDelay +
        Math.ceil(M.sprintResume / COMBAT.pools.staRegen) +
        M.sprintHoldTicks +
        2,
    );
    expect(a.winded).toBe(false);
  });
});

describe('facing', () => {
  it('follows cardinals, and a diagonal keeps a facing that is one of its axes', () => {
    const { s, id } = world(OPEN);
    press(s, id, Dir.N);
    expect(avatar(s, id).facing).toBe(Dir.N);
    press(s, id, Dir.NE);
    expect(avatar(s, id).facing).toBe(Dir.N);
    press(s, id, Dir.W);
    press(s, id, Dir.SE);
    expect(avatar(s, id).facing).toBe(Dir.E);
    press(s, id, null);
    expect(avatar(s, id).facing).toBe(Dir.E);
  });
});

describe('responsiveness and determinism', () => {
  it('moves on the same tick the command arrives (within 2 ticks)', () => {
    const { s, id } = world(OPEN);
    const x0 = pos(s, id).x;
    press(s, id, Dir.E);
    expect(pos(s, id).x).toBeGreaterThan(x0);
  });

  it('same seed and commands give the same state hash', () => {
    const run = (): string => {
      const { s, id } = world(OPEN);
      press(s, id, Dir.SE, true, 40);
      press(s, id, Dir.W, false, 20);
      return hashState(s);
    };
    expect(run()).toBe(run());
  });

  it('applyAvatarCommand ignores entities that are not avatars', () => {
    const { s } = world(OPEN);
    const other = spawn(s.entities);
    applyAvatarCommand(s, other, { type: 'move', dir: Dir.E });
    expect(s.entities.comps.avatar[other]).toBeNull();
  });
});

describe('commands', () => {
  it('validates the full flag', () => {
    expect(validateCommand({ type: 'move', dir: 2, full: true })).toEqual({
      ok: true,
      command: { type: 'move', dir: 2, full: true },
    });
    expect(validateCommand({ type: 'move', dir: 2, full: 'yes' }).ok).toBe(false);
    expect(validateCommand({ type: 'move', dir: null })).toEqual({
      ok: true,
      command: { type: 'move', dir: null },
    });
  });
});

describe('context target', () => {
  function withSign(
    dx: number,
    dy: number,
    facing: Direction,
  ): { s: SimState; id: number; sign: number } {
    const { s, id } = world(OPEN);
    press(s, id, facing);
    press(s, id, null, false, 5);
    const f = pos(s, id);
    const sign = spawn(s.entities);
    setComp(s.entities, sign, 'pos', { x: f.x + px(dx), y: f.y + px(dy) });
    setComp(s.entities, sign, 'interactable', { kind: 'sign' });
    return { s, id, sign };
  }

  it('finds something in front within reach', () => {
    const { s, id, sign } = withSign(12, 0, Dir.E);
    expect(contextTarget(s, id)).toBe(sign);
  });
  it('ignores something behind, out of reach, or off to the side', () => {
    expect(contextTarget(withSign(-12, 0, Dir.E).s, 0)).toBeNull();
    expect(contextTarget(withSign(40, 0, Dir.E).s, 0)).toBeNull();
    expect(contextTarget(withSign(10, 30, Dir.E).s, 0)).toBeNull();
  });
  it('picks the nearest, lowest id on a tie', () => {
    const { s, id, sign } = withSign(12, 0, Dir.E);
    const f = pos(s, id);
    const far = spawn(s.entities);
    setComp(s.entities, far, 'pos', { x: f.x + px(16), y: f.y });
    setComp(s.entities, far, 'interactable', { kind: 'sign' });
    expect(contextTarget(s, id)).toBe(sign);
  });
});
