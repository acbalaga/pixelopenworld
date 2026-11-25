import { describe, expect, it } from 'vitest';
import { STATUSES } from '../../src/content/combat/statuses';
import { WORLD_TUNABLES as W } from '../../src/content/balance/world';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { statusesOf } from '../../src/sim/mods';
import type { Command } from '../../src/sim/kernel/commands';

/** Rest points in the wild are used from the front, and a night there is a short Rested (POW-M5-25). */
function world(withCamp: boolean): { s: SimState; me: number; camp: number | null } {
  const s = createDemoState(1, 0);
  s.world = { solidAt: (): number => 0 };
  const f = feetAt(30, 30);
  const me = createAvatar(s, f.x, f.y);
  // The avatar starts facing south, so the point goes one tile south.
  const camp = withCamp ? spawnFixture(s, 'fixture.rest_point', 30, 31) : null;
  return { s, me, camp };
}

function step(s: SimState, me: number, ...commands: Command[]): SimEvent[] {
  stepWorld(s, me, { commands, worldTick: s.tick + 1 });
  return [...s.events.list];
}

describe('the rest point', () => {
  it('can be used from the front, and blocks nothing', () => {
    const { s, me, camp } = world(true);
    expect(s.entities.comps.interactable[camp!]).toBeDefined();
    expect(s.entities.comps.body[camp!] ?? null).toBeNull();
    const ev = step(s, me, { type: 'interact' });
    expect(ev.some((e) => e.type === 'campOpened' && e.id === camp)).toBe(true);
  });

  it('gives a half-length Rested for a night, and says it slept', () => {
    const { s, me, camp } = world(true);
    const ev = step(s, me, { type: 'sleep' });
    expect(ev.some((e) => e.type === 'slept' && e.id === camp)).toBe(true);
    const rested = statusesOf(s, me).find((x) => x.id === 'rested');
    expect(rested).toBeDefined();
    const left = rested!.until - s.tick;
    expect(left).toBeLessThanOrEqual(Math.floor(STATUSES.rested.ticks * W.campRestedShare));
    expect(left).toBeGreaterThan(0);
  });

  it('is less than a bedroll, and nothing away from a rest point', () => {
    expect(W.campRestedShare).toBeGreaterThan(0);
    expect(W.campRestedShare).toBeLessThan(1);
    const { s, me } = world(false);
    step(s, me, { type: 'sleep' });
    expect(statusesOf(s, me).some((x) => x.id === 'rested')).toBe(false);
  });
});
