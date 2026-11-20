import { describe, expect, it } from 'vitest';
import { TIDE } from '../../src/content/balance/dungeons';
import { TIME } from '../../src/content/balance/time';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { getComp } from '../../src/sim/kernel/entities';
import { createDemoState, type SimState } from '../../src/sim/state';
import { dungeonSystem } from '../../src/sim/systems/dungeon';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { tideLow } from '../../src/sim/time';

const OPEN = { solidAt: (): number => 0 };
function world(): { s: SimState; me: number } {
  const s = createDemoState(3, 0);
  s.world = OPEN;
  const f = feetAt(10, 10);
  return { s, me: createAvatar(s, f.x, f.y) };
}

describe('the tide (M4-11)', () => {
  it('is low for lowMinutes of every periodMinutes, twice in a day', () => {
    let lows = 0;
    let prev = tideLow(0);
    for (let m = 0; m < 48; m++) {
      const low = tideLow(m * TIME.ticksPerMinute);
      if (low && !prev) lows++;
      prev = low;
    }
    expect(lows + (tideLow(0) ? 1 : 0)).toBeGreaterThanOrEqual(1);
    expect(TIDE.lowMinutes).toBeLessThan(TIDE.periodMinutes);
    let n = 0;
    for (let m = 0; m < 48; m++) if (tideLow(m * TIME.ticksPerMinute)) n++;
    expect(n).toBe(2 * TIDE.lowMinutes);
  });

  it('opens a tide gate at low tide and shuts it at high tide', () => {
    const { s } = world();
    const g = spawnFixture(s, 'fixture.m4_tide_gate', 12, 10);
    for (let t = 0; t < 48 * TIME.ticksPerMinute; t += TIME.ticksPerMinute) {
      s.worldTick = t;
      dungeonSystem(s);
      const open = getComp(s.entities, g, 'fixture')!.open;
      expect(open, `minute ${t / TIME.ticksPerMinute}`).toBe(tideLow(t));
      expect(getComp(s.entities, g, 'body')!.solid).toBe(!open);
    }
  });
});

describe('heat vents (M4-11)', () => {
  it('burst once a cycle and hurt only an avatar within reach', () => {
    const { s, me } = world();
    const pools = getComp(s.entities, me, 'pools')!;
    spawnFixture(s, 'fixture.m8_vent', 10, 10);
    const full = pools.hp;
    let hit = 0;
    let last = full;
    for (let t = 0; t < 300; t++) {
      s.tick = t;
      dungeonSystem(s);
      if (pools.hp < last) hit++;
      last = pools.hp;
    }
    expect(hit).toBe(2);
    // Out of reach, nothing.
    const { s: s2, me: me2 } = world();
    spawnFixture(s2, 'fixture.m8_vent', 40, 40);
    const p2 = getComp(s2.entities, me2, 'pools')!;
    for (let t = 0; t < 300; t++) {
      s2.tick = t;
      dungeonSystem(s2);
    }
    expect(p2.hp).toBe(p2.hpMax);
  });
});
