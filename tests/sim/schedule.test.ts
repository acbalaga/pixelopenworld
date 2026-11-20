import { describe, expect, it } from 'vitest';
import { PEOPLE } from '../../src/content/people';
import { PLACES } from '../../src/content/people/places';
import { PEOPLE_BALANCE as PB } from '../../src/content/balance/people';
import { TIME } from '../../src/content/balance/time';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { query } from '../../src/sim/kernel/entities';
import { px } from '../../src/sim/kernel/fixed';
import { placeOf } from '../../src/sim/people';
import { createDemoState, type SimState } from '../../src/sim/state';
import { scheduleSystem, slotFor, visitorsOf } from '../../src/sim/systems/schedule';
import { spawnNpc } from '../../src/sim/systems/npcs';
import { dayPhase, currentWeather } from '../../src/sim/time';

const OPEN = { solidAt: (): number => 0 };
const phaseTick = (phase: string): number => {
  for (let t = 0; t < 48 * TIME.ticksPerMinute; t += TIME.ticksPerMinute)
    if (dayPhase(t) === phase) return t - (t % PB.checkTicks);
  throw new Error(phase);
};

function world(avatarAt: [number, number]): { s: SimState; me: number } {
  const s = createDemoState(5, 0);
  s.world = OPEN;
  s.region = 'dawnmeadow';
  s.weatherOverride = 'clear';
  const f = feetAt(avatarAt[0], avatarAt[1]);
  const me = createAvatar(s, f.x, f.y);
  return { s, me };
}
const tileOf = (s: SimState, id: number): [number, number] => {
  const p = s.entities.comps.pos[id]!;
  return [Math.floor(p.x / px(16)), Math.floor(p.y / px(16))];
};
const npcEntity = (s: SimState, npc: string): number =>
  query(s.entities, 'npc').find((e) => s.entities.comps.npc[e]?.id === npc)!;

describe('people keep their schedules (M4-12)', () => {
  it('give each visitor of a place a slot of their own', () => {
    for (const id of Object.keys(PLACES)) {
      const slots = PLACES[id]!.spot?.slots.length ?? 0;
      if (slots === 0) continue;
      const seen = new Set(visitorsOf(id).map((n) => slotFor(n, id)!.join(',')));
      expect(seen.size, id).toBe(visitorsOf(id).length);
    }
  });

  it('puts Old Fen at his well by day and his shelter by night', () => {
    expect(slotFor('npc.hermit', 'cairnmoor.well')).not.toBeNull();
    expect(slotFor('npc.hermit', 'cairnmoor.shelter')).not.toBeNull();
  });

  it('never move a person while they, or the place they are bound for, are on screen', () => {
    const smithy = PLACES['hearthford.smithy']!.spot!.slots[0]!;
    const inn = PLACES['hearthford.inn']!.spot!.slots[0]!;
    // The avatar stands by the smithy; the smith is at the smithy by day and goes to the inn at dusk.
    const { s } = world([smithy[0], smithy[1] + 2]);
    spawnNpc(s, 'npc.smith', smithy[0], smithy[1]);
    const e = npcEntity(s, 'npc.smith');
    s.worldTick = phaseTick('dusk');
    scheduleSystem(s);
    expect(tileOf(s, e)).toEqual([smithy[0], smithy[1]]);
    // A person bound for a spot the avatar can see does not jump into view either.
    const { s: s2 } = world([inn[0], inn[1]]);
    spawnNpc(s2, 'npc.smith', 300, 100);
    const e2 = npcEntity(s2, 'npc.smith');
    s2.worldTick = phaseTick('dusk');
    scheduleSystem(s2);
    expect(tileOf(s2, e2)).toEqual([300, 100]);
  });

  it('put each person at their scheduled place for every phase and weather, once unseen', () => {
    for (const person of Object.values(PEOPLE)) {
      for (const phase of ['dawn', 'day', 'dusk', 'night'] as const)
        for (const weather of ['clear', 'rain'] as const) {
          const { s } = world([2, 2]);
          spawnNpc(s, person.npc, 300, 300);
          s.weatherOverride = weather;
          s.worldTick = phaseTick(phase);
          scheduleSystem(s);
          const want = slotFor(person.npc, placeOf(person, phase, currentWeather(s)));
          const at = tileOf(s, npcEntity(s, person.npc));
          if (want) expect(at, `${person.npc} ${phase} ${weather}`).toEqual([want[0], want[1]]);
          else expect(at).toEqual([300, 300]);
        }
    }
  });

  it('does nothing outside the region', () => {
    const { s } = world([2, 2]);
    delete s.region;
    spawnNpc(s, 'npc.smith', 300, 300);
    s.worldTick = phaseTick('night');
    scheduleSystem(s);
    expect(tileOf(s, npcEntity(s, 'npc.smith'))).toEqual([300, 300]);
  });
});
