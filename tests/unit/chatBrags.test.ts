import { describe, expect, it } from 'vitest';
import { CHAT } from '../../src/content/balance/chat';
import { TEMPLATES } from '../../src/content/chat/templates';
import { createAvatar } from '../../src/sim/avatar';
import { chatSystem } from '../../src/sim/chat/engine';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { travelersSystem } from '../../src/sim/travelers/crowd';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { hold, stagedSeeds, type Cast } from '../support/stage';

/**
 * Brags only on rare drops (POW-M6-23). A Traveler's drop at or under `CHAT.bragDropPct` can be
 * bragged about. A commoner one ("Got Rough Hide") never is, though it can still be offered for sale.
 * Staged: forty Travelers online, each looting in turn, so the test does not wait on who logs in.
 */
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const byId = new Map(TEMPLATES.map((t) => [t.id, t]));

type Spoke = Extract<SimEvent, { type: 'travelerSpoke' }>;

function world(seed: number): SimState {
  const T0 = (MON + 2) * 86_400_000 + 20 * 3_600_000;
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  createAvatar(s, px(3000), px(3000), 'Fred');
  s.weatherOverride = 'clear';
  s.clock = { nowMs: T0, epochMs: T0 - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

/** Runs minute by minute with the cast held; each minute one of them loots at `chance`. */
function lootLines(seed: number, chance: number, minutes: number): Spoke[] {
  const s = world(seed);
  const cast: Cast = {
    slots: identitiesOf(seed)
      .map((t) => t.slot)
      .filter((slot) => slot >= 24)
      .slice(0, 40),
  };
  const base = s.clock!.nowMs;
  const out: Spoke[] = [];
  for (let m = 0; m < minutes; m++) {
    s.tick += 60;
    s.worldTick += 60;
    s.clock = { ...s.clock!, nowMs: base + m * 60_000 };
    s.events.list.length = 0;
    hold(s, cast);
    travelersSystem(s);
    // The crowd loots on its own too: only lines from this event, by its source id, count.
    const mine = `ev:${s.tick}:${s.events.list.length}`;
    if (m >= 5)
      s.events.list.push({
        type: 'travelerLooted',
        slot: cast.slots[m % cast.slots.length]!,
        item: 'item.hide_rough',
        qty: 1,
        creature: 'creature.bramble_boar',
        chance,
      });
    chatSystem(s);
    for (const e of s.events.list)
      if (
        e.type === 'travelerSpoke' &&
        e.source === mine &&
        byId.get(e.template)?.trigger === 'travelerLooted'
      )
        out.push(e);
  }
  return out;
}

const isBrag = (l: Spoke): boolean => byId.get(l.template)?.category === 'brag';

describe('brags on drops', () => {
  it('never brag about a drop above the threshold, though it can be offered for sale', () => {
    expect(CHAT.bragDropPct).toBe(30);
    for (const seed of stagedSeeds()) {
      const lines = lootLines(seed, CHAT.bragDropPct + 15, 240);
      expect(
        lines.filter(isBrag).map((l) => l.template),
        `seed ${seed}`,
      ).toEqual([]);
      expect(lines.length, `seed ${seed}: loot is still talked about`).toBeGreaterThan(0);
    }
  });

  it('can brag about a rare drop, at or under the threshold', () => {
    for (const seed of stagedSeeds()) {
      expect(lootLines(seed, 10, 240).filter(isBrag).length, `seed ${seed}`).toBeGreaterThan(0);
      expect(
        lootLines(seed, CHAT.bragDropPct, 240).filter(isBrag).length,
        `seed ${seed} at the threshold`,
      ).toBeGreaterThan(0);
    }
  });
});
