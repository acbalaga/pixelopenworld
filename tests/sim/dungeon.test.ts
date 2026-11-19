import { describe, expect, it } from 'vitest';
import { SPAWNERS } from '../../src/content/creatures';
import type { RoomDef } from '../../src/content/world/fixtures';
import { createAvatar } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { kill } from '../../src/sim/combat/fighter';
import { elementHitsWorld, elementsSystem } from '../../src/sim/elements';
import { getComp, query } from '../../src/sim/kernel/entities';
import { emit, type SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { addItem } from '../../src/sim/items';
import { createDemoState, type SimState } from '../../src/sim/state';
import { dungeonSystem, hitFixtures, litFor } from '../../src/sim/systems/dungeon';
import { fixturesSystem, interactFixture, spawnFixture } from '../../src/sim/systems/fixtures';
import { createSpawner, spawnerSystem } from '../../src/sim/systems/spawner';
import { dayIndex } from '../../src/sim/time';
import { skillsSystem } from '../../src/sim/systems/skills';

/** A state with an avatar standing at a tile's feet, facing `facing` (0 N, 2 E, 4 S, 6 W). */
function game(tx = 10, ty = 10, facing: 0 | 2 | 4 | 6 = 0): { s: SimState; me: number } {
  const s = createDemoState(11, 0);
  const me = createAvatar(s, px(tx * 16 + 8), px(ty * 16 + 16));
  const a = getComp(s.entities, me, 'avatar');
  if (a) a.facing = facing;
  return { s, me };
}

const fx = (s: SimState, id: number) => getComp(s.entities, id, 'fixture')!;
const body = (s: SimState, id: number) => getComp(s.entities, id, 'body');
const events = (s: SimState, type: SimEvent['type']): number =>
  s.events.list.filter((e) => e.type === type).length;
const stand = (s: SimState, id: number, tx: number, ty: number): void => {
  const p = getComp(s.entities, id, 'pos')!;
  p.x = px(tx * 16 + 8);
  p.y = px(ty * 16 + 16 - 8);
};

describe('switches', () => {
  it('toggles under the avatar, and opens a gate that names it', () => {
    const { s, me } = game(10, 11, 0);
    const sw = spawnFixture(s, 'fixture.switch', 10, 10);
    const gate = spawnFixture(s, 'fixture.gate_switch', 14, 10);
    fixturesSystem(s);
    expect(fx(s, gate).open).toBe(false);
    expect(body(s, gate)?.solid).toBe(true);
    interactFixture(s, me);
    expect(fx(s, sw).open).toBe(true);
    fixturesSystem(s);
    expect(fx(s, gate).open).toBe(true);
    expect(body(s, gate)?.solid).toBe(false);
    // A plain switch turns off again; the gate stays open, as every gate does.
    interactFixture(s, me);
    expect(fx(s, sw).open).toBe(false);
    fixturesSystem(s);
    expect(fx(s, gate).open).toBe(true);
  });

  it('a latching switch stays on', () => {
    const { s, me } = game(10, 11, 0);
    const sw = spawnFixture(s, 'fixture.switch_latch', 10, 10);
    interactFixture(s, me);
    interactFixture(s, me);
    expect(fx(s, sw).open).toBe(true);
  });
});

describe('plates', () => {
  it('the first cave plate takes a block only', () => {
    const { s, me } = game(10, 10, 0);
    const plate = spawnFixture(s, 'fixture.plate_puzzle', 10, 10);
    stand(s, me, 10, 10);
    fixturesSystem(s);
    expect(fx(s, plate).open).toBe(false);
    const block = spawnFixture(s, 'fixture.block_puzzle', 10, 10);
    getComp(s.entities, block, 'pos')!.y = px(10 * 16 + 16 - 7);
    fixturesSystem(s);
    expect(fx(s, plate).open).toBe(true);
    expect(events(s, 'blockSolved')).toBe(1);
  });

  it('a plate that holds the avatar, a creature, a block or a Stone wall', () => {
    for (const holder of ['avatar', 'creature', 'block', 'wall']) {
      const { s, me } = game(2, 2);
      const plate = spawnFixture(s, 'fixture.plate_any', 10, 10);
      fixturesSystem(s);
      expect(fx(s, plate).open, `${holder} before`).toBe(false);
      if (holder === 'avatar') stand(s, me, 10, 10);
      if (holder === 'creature') {
        const c = spawnCreature(s, 'creature.mossling', 10 * 16 + 8, 10 * 16 + 16 - 8);
        expect(c).toBeGreaterThan(me);
      }
      if (holder === 'block') {
        const b = spawnFixture(s, 'fixture.block_puzzle', 10, 10);
        getComp(s.entities, b, 'pos')!.y = px(10 * 16 + 16 - 7);
      }
      if (holder === 'wall') {
        const w = spawnFixture(s, 'fixture.earth_wall', 10, 10);
        getComp(s.entities, w, 'pos')!.y = px(10 * 16 + 16 - 7);
      }
      fixturesSystem(s);
      expect(fx(s, plate).open, holder).toBe(true);
    }
  });

  it('a step plate is not pressed by a block', () => {
    const { s } = game(2, 2);
    const plate = spawnFixture(s, 'fixture.plate_step', 10, 10);
    const b = spawnFixture(s, 'fixture.block_puzzle', 10, 10);
    getComp(s.entities, b, 'pos')!.y = px(10 * 16 + 16 - 7);
    fixturesSystem(s);
    expect(fx(s, plate).open).toBe(false);
  });
});

describe('timed gates', () => {
  it('open while held, stay open for the hold time, then shut', () => {
    const { s, me } = game(2, 2);
    const plate = spawnFixture(s, 'fixture.plate_step', 10, 10);
    const gate = spawnFixture(s, 'fixture.gate_timed', 14, 10);
    s.worldTick = 1000;
    stand(s, me, 10, 10);
    fixturesSystem(s);
    expect(fx(s, plate).open).toBe(true);
    expect(fx(s, gate).open).toBe(true);
    // Step off. The gate is still open while the time runs.
    stand(s, me, 2, 2);
    s.worldTick = 1100;
    fixturesSystem(s);
    elementsSystem(s);
    expect(fx(s, gate).open).toBe(true);
    s.worldTick = 1200;
    fixturesSystem(s);
    elementsSystem(s);
    expect(fx(s, gate).open).toBe(false);
    expect(body(s, gate)?.solid).toBe(true);
  });

  it('does not shut on someone standing in it', () => {
    const { s, me } = game(2, 2);
    const plate = spawnFixture(s, 'fixture.plate_step', 10, 10);
    const gate = spawnFixture(s, 'fixture.gate_timed', 14, 10);
    s.worldTick = 0;
    stand(s, me, 10, 10);
    fixturesSystem(s);
    stand(s, me, 14, 10);
    s.worldTick = 400;
    fixturesSystem(s);
    elementsSystem(s);
    expect(fx(s, plate).open).toBe(false);
    expect(fx(s, gate).open).toBe(true);
  });
});

describe('breakable walls', () => {
  it('each wall breaks to its own kind of hit only', () => {
    const { s } = game(2, 2);
    const heavy = spawnFixture(s, 'fixture.wall_heavy', 10, 10);
    const stone = spawnFixture(s, 'fixture.wall_stone', 12, 10);
    const ember = spawnFixture(s, 'fixture.wall_ember', 14, 10);
    const at = (tx: number): { x: number; y: number } => ({ x: tx * 16 + 8, y: 10 * 16 + 8 });
    expect(hitFixtures(s, 'stone', at(10))).toBe(0);
    expect(hitFixtures(s, 'ember', at(10))).toBe(0);
    expect(hitFixtures(s, 'heavy', at(10))).toBe(1);
    expect(fx(s, heavy).open).toBe(true);
    expect(body(s, heavy)?.solid).toBe(false);
    expect(fx(s, stone).open).toBe(false);
    expect(elementHitsWorld(s, 'stone', at(12))).toBeGreaterThan(0);
    expect(fx(s, stone).open).toBe(true);
    expect(fx(s, ember).open).toBe(false);
    elementHitsWorld(s, 'ember', at(14));
    expect(fx(s, ember).open).toBe(true);
    expect(events(s, 'wallBroken')).toBe(3);
  });

  it('a broken wall stays broken and a hit out of reach does nothing', () => {
    const { s } = game(2, 2);
    const w = spawnFixture(s, 'fixture.wall_heavy', 10, 10);
    expect(hitFixtures(s, 'heavy', { x: 400, y: 400 })).toBe(0);
    hitFixtures(s, 'heavy', { x: 10 * 16 + 8, y: 10 * 16 + 8 });
    expect(hitFixtures(s, 'heavy', { x: 10 * 16 + 8, y: 10 * 16 + 8 })).toBe(0);
    expect(fx(s, w).open).toBe(true);
  });
});

describe('light and dark', () => {
  const dark: RoomDef = { id: 'room.dark', x0: 0, y0: 0, x1: 30, y1: 30, dark: true };
  it('a dark room is lit by a lit torch or a lantern in the off hand, and is dark otherwise', () => {
    const { s, me } = game(5, 5);
    const torch = spawnFixture(s, 'fixture.torch', 20, 5);
    expect(litFor(s, me, [dark])).toBe(false);
    elementHitsWorld(s, 'ember', { x: 20 * 16 + 8, y: 5 * 16 + 8 });
    expect(fx(s, torch).open).toBe(true);
    expect(litFor(s, me, [dark])).toBe(true);
    fx(s, torch).open = false;
    expect(litFor(s, me, [dark])).toBe(false);
    const inv = getComp(s.entities, me, 'inventory')!;
    addItem(inv, 'item.lantern', 1);
    inv.equipment.off = { item: 'item.lantern', qty: 1 };
    expect(litFor(s, me, [dark])).toBe(true);
  });

  it('a room that is not dark is always lit', () => {
    const { s, me } = game(5, 5);
    expect(litFor(s, me, [{ ...dark, dark: undefined } as unknown as RoomDef])).toBe(true);
  });

  it('a torch placed burning is lit at the start', () => {
    const { s } = game(5, 5);
    // The generic torch starts dark. Only `litAtStart` kinds are placed burning.
    expect(fx(s, spawnFixture(s, 'fixture.torch', 3, 3)).open).toBe(false);
  });
});

describe('drops and shortcuts', () => {
  it('a drop costs a share of Health, never the last point, and lands at its arrival', () => {
    const { s, me } = game(10, 10);
    spawnFixture(s, 'fixture.drop_hole', 10, 10);
    spawnFixture(s, 'fixture.arrival_drop', 30, 30);
    stand(s, me, 10, 10);
    const pools = getComp(s.entities, me, 'pools')!;
    const before = pools.hp;
    fixturesSystem(s);
    expect(pools.hp).toBe(before - Math.ceil((pools.hpMax * 10) / 100));
    expect(getComp(s.entities, me, 'pos')!.x / 256).toBeGreaterThan(400);
    // At one point of Health the fall takes nothing.
    stand(s, me, 10, 10);
    pools.hp = 1;
    fixturesSystem(s);
    expect(pools.hp).toBe(1);
  });

  it('a shortcut door opens, for good, only from its open side', () => {
    // The door opens from the south: standing north of it does nothing.
    const north = game(10, 9, 4);
    const d1 = spawnFixture(north.s, 'fixture.door_shortcut', 10, 10);
    // Facing south from the north side: the avatar stands above the door.
    getComp(north.s.entities, north.me, 'pos')!.y = px(10 * 16 + 16 - 14);
    interactFixture(north.s, north.me);
    expect(fx(north.s, d1).open).toBe(false);
    expect(events(north.s, 'shortcutWrongSide')).toBe(1);

    const south = game(10, 11, 0);
    const d2 = spawnFixture(south.s, 'fixture.door_shortcut', 10, 10);
    interactFixture(south.s, south.me);
    expect(fx(south.s, d2).open).toBe(true);
    expect(body(south.s, d2)?.solid).toBe(false);
  });
});

describe('arenas', () => {
  function arena() {
    const { s, me } = game(2, 2);
    const trigger = spawnFixture(s, 'fixture.arena_trigger', 20, 20);
    const door = spawnFixture(s, 'fixture.arena_door', 22, 20);
    return { s, me, trigger, door };
  }
  const foes = (s: SimState, trigger: number): number[] => fx(s, trigger).arena!.foes;
  const downAll = (s: SimState, ids: number[]): void => ids.forEach((i) => kill(s, i));

  it('doors stand open until the avatar steps in, shut for the waves, and open when the last falls', () => {
    const { s, me, trigger, door } = arena();
    expect(fx(s, door).open).toBe(true);
    expect(body(s, door)?.solid).toBe(false);
    dungeonSystem(s);
    expect(fx(s, trigger).arena!.state).toBe('idle');
    stand(s, me, 20, 20);
    dungeonSystem(s);
    expect(fx(s, trigger).arena!.state).toBe('live');
    expect(foes(s, trigger)).toHaveLength(2);
    expect(fx(s, door).open).toBe(false);
    expect(body(s, door)?.solid).toBe(true);
    expect(events(s, 'arenaStarted')).toBe(1);
    // Wave one down: wave two comes.
    downAll(s, foes(s, trigger));
    dungeonSystem(s);
    expect(fx(s, trigger).arena!.wave).toBe(1);
    expect(foes(s, trigger)).toHaveLength(1);
    expect(fx(s, door).open).toBe(false);
    // The last down: cleared, doors open, stays cleared.
    downAll(s, foes(s, trigger));
    dungeonSystem(s);
    expect(fx(s, trigger).arena!.state).toBe('done');
    expect(fx(s, door).open).toBe(true);
    expect(body(s, door)?.solid).toBe(false);
    expect(events(s, 'arenaCleared')).toBe(1);
    dungeonSystem(s);
    expect(fx(s, trigger).arena!.state).toBe('done');
  });

  it('falling in the arena opens the doors and resets it', () => {
    const { s, me, trigger, door } = arena();
    stand(s, me, 20, 20);
    dungeonSystem(s);
    const wave = foes(s, trigger);
    emit(s.events, { type: 'died', id: me, team: 0 });
    dungeonSystem(s);
    expect(fx(s, trigger).arena!.state).toBe('idle');
    expect(fx(s, door).open).toBe(true);
    for (const f of wave) expect(s.entities.alive[f]).toBe(false);
  });
});

describe('daily spawners', () => {
  it('a cleared crew stays gone for the day and returns on the next', () => {
    (SPAWNERS as Record<string, unknown>)['spawner.test_daily'] = {
      kind: 'spawner.test_daily',
      creature: 'creature.mossling',
      cap: 1,
      respawn: 1,
      radius: 0,
      daily: true,
    };
    const { s } = game(2, 2);
    s.worldTick = 5;
    const sp = createSpawner(s, 'spawner.test_daily', 300, 300);
    spawnerSystem(s);
    spawnerSystem(s);
    const sc = getComp(s.entities, sp, 'spawner')!;
    expect(sc.members).toHaveLength(1);
    kill(s, sc.members[0] as number);
    spawnerSystem(s);
    spawnerSystem(s);
    expect(sc.members).toHaveLength(0);
    expect(sc.clearedDay).toBe(dayIndex(5));
    // The rest of the day: nothing.
    for (let i = 0; i < 20; i++) spawnerSystem(s);
    expect(sc.members).toHaveLength(0);
    // The next dawn: it fills again.
    let t = 5;
    while (dayIndex(t) === dayIndex(5)) t += 50;
    s.worldTick = t;
    spawnerSystem(s);
    spawnerSystem(s);
    expect(sc.members).toHaveLength(1);
    expect(sc.clearedDay).toBeUndefined();
    expect(query(s.entities, 'spawner')).toContain(sp);
  });
});

describe('delving XP', () => {
  it('pays once for the first entry of a room, a block solved and a dungeon cleared', () => {
    const { s, me } = game(2, 2);
    const xp = (): number => getComp(s.entities, me, 'skills')!.xp['skill.delving'] ?? 0;
    const pts = (): number => getComp(s.entities, me, 'skills')!.points['skill.delving'] ?? 0;
    const total = (): number => pts() * 1000 + xp();
    const before = total();
    emit(s.events, {
      type: 'delved',
      who: me,
      dungeon: 'dungeon.sample',
      room: 'dungeon.sample.b',
    });
    skillsSystem(s);
    const first = total();
    expect(first).toBeGreaterThan(before);
    // Entering the same room again pays nothing.
    emit(s.events, {
      type: 'delved',
      who: me,
      dungeon: 'dungeon.sample',
      room: 'dungeon.sample.b',
    });
    skillsSystem(s);
    expect(total()).toBe(first);
    // A different room, a block solved, a clear: each pays.
    emit(s.events, {
      type: 'delved',
      who: me,
      dungeon: 'dungeon.sample',
      room: 'dungeon.sample.c',
    });
    skillsSystem(s);
    const second = total();
    expect(second).toBeGreaterThan(first);
    emit(s.events, { type: 'dungeonCleared', who: me, dungeon: 'dungeon.sample' });
    skillsSystem(s);
    expect(total()).toBeGreaterThan(second);
  });
});
