import { describe, expect, it } from 'vitest';
import { WAYSTONES } from '../../src/content/world/waystones';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { validateCommand } from '../../src/sim/kernel/commands';
import { Dir } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { attunedIn, travelBlock, travelTo } from '../../src/sim/systems/waystones';
import { stepWorld } from '../../src/sim/step';
import { newStream } from '../../src/sim/world/stream';
import { createChunk } from '../../src/sim/world/chunk';
import { TileWorld } from '../../src/sim/world/world';

const stone = (id: string): { x: number; y: number } =>
  WAYSTONES['dawnmeadow']!.find((w) => w.id === id)!;

function game(): { s: SimState; me: number } {
  const s = createDemoState(3, 0);
  s.region = 'dawnmeadow';
  s.tick = 10_000;
  s.world = { solidAt: () => 0 };
  for (const w of WAYSTONES['dawnmeadow']!) spawnFixture(s, 'fixture.waystone', w.x, w.y);
  const h = stone('hearthford');
  const f = feetAt(h.x, h.y + 1);
  const me = createAvatar(s, f.x, f.y);
  s.entities.comps.avatar[me]!.facing = Dir.N;
  return { s, me };
}
const run = (s: SimState, me: number, ...commands: unknown[]): void => {
  stepWorld(s, me, { commands } as never);
};
const touch = (s: SimState, me: number, id: string): void => {
  const w = stone(id);
  const f = feetAt(w.x, w.y + 1);
  s.entities.comps.pos[me] = f;
  s.entities.comps.avatar[me]!.facing = Dir.N;
  run(s, me, { type: 'interact' });
};
const types = (s: SimState): string[] => s.events.list.map((e) => e.type);

describe('attuning', () => {
  it('the first touch binds the respawn point, away from the wake point, and attunes the stone', () => {
    const { s, me } = game();
    const a = s.entities.comps.avatar[me]!;
    a.respawn = feetAt(10, 10);
    const before = { ...a.respawn };
    run(s, me, { type: 'interact' });
    expect(types(s)).toContain('waystoneAttuned');
    expect(a.respawn).not.toEqual(before);
    const h = stone('hearthford');
    expect(a.respawn.x).toBe(feetAt(h.x, h.y).x);
    expect(attunedIn(s, 'dawnmeadow')).toEqual(['hearthford']);
  });

  it('a second touch heals and re-binds but does not attune twice', () => {
    const { s, me } = game();
    run(s, me, { type: 'interact' });
    s.events.list.length = 0;
    s.entities.comps.pools[me]!.hp = 1;
    // Interact needs the avatar idle and a moment after the first use.
    for (let i = 0; i < 30; i++) run(s, me);
    s.events.list.length = 0;
    run(s, me, { type: 'interact' });
    expect(types(s)).not.toContain('waystoneAttuned');
    expect(attunedIn(s, 'dawnmeadow')).toEqual(['hearthford']);
  });

  it('touching each stone attunes it, once', () => {
    const { s, me } = game();
    for (const w of WAYSTONES['dawnmeadow']!) touch(s, me, w.id);
    expect(attunedIn(s, 'dawnmeadow').sort()).toEqual(
      WAYSTONES['dawnmeadow']!.map((w) => w.id).sort(),
    );
  });
});

describe('travel', () => {
  it('goes between attuned stones, free, and lands south of the stone', () => {
    const { s, me } = game();
    touch(s, me, 'hearthford');
    touch(s, me, 'millbrook');
    touch(s, me, 'hearthford');
    s.events.list.length = 0;
    const coin = s.entities.comps.avatar[me]!.coin;
    run(s, me, { type: 'travel', stone: 'millbrook' });
    const ev = s.events.list.find((e) => e.type === 'traveled');
    expect(ev).toMatchObject({
      who: me,
      region: 'dawnmeadow',
      from: 'hearthford',
      to: 'millbrook',
    });
    const m = stone('millbrook');
    const p = s.entities.comps.pos[me]!;
    expect(Math.floor(p.x / 256 / 16)).toBe(m.x);
    expect(Math.floor(p.y / 256 / 16)).toBe(m.y + 1);
    expect(s.entities.comps.avatar[me]!.coin).toBe(coin);
  });

  it('cannot travel to an unattuned stone', () => {
    const { s, me } = game();
    touch(s, me, 'hearthford');
    touch(s, me, 'reedmouth');
    const at = { ...s.entities.comps.pos[me]! };
    expect(travelBlock(s, me, 'millbrook')).toBe('unattuned');
    s.events.list.length = 0;
    run(s, me, { type: 'travel', stone: 'millbrook' });
    expect(types(s)).not.toContain('traveled');
    expect(s.entities.comps.pos[me]).toEqual(at);
    expect(travelTo(s, me, 'nowhere')).toBe(false);
  });

  it('is refused in combat and for a while after, and when already there', () => {
    const { s, me } = game();
    touch(s, me, 'hearthford');
    touch(s, me, 'millbrook');
    expect(travelBlock(s, me, 'millbrook')).toBe('here');
    s.entities.comps.pools[me]!.lastCombat = s.tick;
    expect(travelBlock(s, me, 'hearthford')).toBe('combat');
    s.entities.comps.pools[me]!.lastCombat = -100000;
    s.entities.comps.fighter[me]!.state = 'attack';
    expect(travelBlock(s, me, 'hearthford')).toBe('combat');
  });

  it("waits for the stone's chunk to be in when the world streams", () => {
    const { s, me } = game();
    touch(s, me, 'hearthford');
    touch(s, me, 'millbrook');
    s.entities.comps.pos[me] = feetAt(stone('hearthford').x, stone('hearthford').y + 1);
    const grid = new TileWorld();
    s.stream = newStream(grid, false);
    expect(travelBlock(s, me, 'millbrook')).toBe('loading');
    const m = stone('millbrook');
    grid.set(createChunk(Math.floor(m.x / 32), Math.floor(m.y / 32)));
    expect(travelBlock(s, me, 'millbrook')).toBeNull();
  });

  it('validates the command', () => {
    expect(validateCommand({ type: 'travel', stone: 'millbrook' }).ok).toBe(true);
    for (const bad of ['', 'Mill', '../x', 5, null])
      expect(validateCommand({ type: 'travel', stone: bad }).ok).toBe(false);
  });
});
