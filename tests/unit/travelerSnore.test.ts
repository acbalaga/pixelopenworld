import { describe, expect, it } from 'vitest';
import { WAKE } from '../../src/content/chat/social';
import { validateShippedChat } from '../../src/content/chat/validate';
import { createAvatar } from '../../src/sim/avatar';
import { chatSystem, queueChatCommand, socialSystem } from '../../src/sim/chat/engine';
import { validateCommand } from '../../src/sim/kernel/commands';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { crowdOf, travelersSystem } from '../../src/sim/travelers/crowd';
import { isAsleep, profileOf, travelerViews } from '../../src/sim/travelers/entities';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { makeFriends } from '../../src/sim/travelers/social';
import { wakeFor } from '../../src/sim/chat/social';

/**
 * Snoring AFK (POW-M5-31): a promoted Traveler AFK for five in-game minutes shows a floating z, and a
 * poke wakes them with a grumpy line. A joke, not an interaction: no memory and no regard.
 */
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;

function world(seed: number): SimState {
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  createAvatar(s, px(192 * 16 + 8), px(193 * 16 + 8));
  s.worldTick = 54_500;
  s.weatherOverride = 'clear';
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

interface Spoke {
  slot: number;
  text: string;
  template: string;
}

function step(s: SimState, ticks: number, out: Spoke[] = [], each?: () => boolean): Spoke[] {
  const base = s.clock!.nowMs;
  const start = s.tick;
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    s.worldTick++;
    s.clock = { ...s.clock!, nowMs: base + Math.floor(((s.tick - start) * 1000) / 30) };
    s.events.list.length = 0;
    travelersSystem(s);
    chatSystem(s);
    socialSystem(s);
    for (const e of s.events.list)
      if (e.type === 'travelerSpoke')
        out.push({ slot: e.slot, text: e.text, template: e.template });
    if (each && i % 15 === 0 && each()) break;
  }
  return out;
}

/** Runs until a promoted Traveler is shown asleep, and returns their slot. */
function findSleeper(s: SimState): number {
  let found = -1;
  step(s, 40_000, [], () => {
    const v = travelerViews(s).find((x) => x.asleep);
    if (v) found = v.slot;
    return found >= 0;
  });
  return found;
}

describe('the floating z', () => {
  it('shows only on a promoted Traveler who is AFK, past five in-game minutes', () => {
    let asleep = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const s = world(seed);
      step(s, 600);
      step(s, 20_000, [], () => {
        const crowd = crowdOf(s);
        for (const v of travelerViews(s)) {
          if (v.asleep) {
            asleep++;
            expect(v.mode, `${v.handle} asleep`).toBe('afk');
            expect(crowd.doing[v.slot]?.kind).toBe('afk');
          }
          // Anyone in another activity, or AFK for less than the threshold, has no z.
          if (v.mode !== 'afk') expect(v.asleep).toBe(false);
        }
        return false;
      });
    }
    expect(asleep).toBeGreaterThan(0);
  }, 120_000);
});

describe('a poke', () => {
  it('wakes a sleeper with one grumpy line, the second poke does nothing, and regard and memory are unchanged', () => {
    let s = world(3);
    let slot = findSleeper(s);
    for (let seed = 4; slot < 0 && seed < 9; seed++) {
      s = world(seed);
      slot = findSleeper(s);
    }
    expect(slot, 'a Traveler fell asleep').toBeGreaterThanOrEqual(0);
    const life = s.travelers[slot]!;
    const before = { pts: life.regardPts, mem: life.memory.length, tier: life.regardTier };
    expect(profileOf(s, slot).asleep).toBe(true);
    queueChatCommand(s, { type: 'poke', slot });
    queueChatCommand(s, { type: 'poke', slot });
    const heard = step(s, 200);
    const wake = heard.filter((l) => l.template === 'wake.poke');
    expect(wake).toHaveLength(1);
    expect(wake[0]!.slot).toBe(slot);
    // Awake now: no z, still AFK, and a later poke gets no reaction.
    const ent = crowdOf(s).ents.get(crowdOf(s).entOf[slot]!)!;
    expect(isAsleep(ent)).toBe(false);
    expect(profileOf(s, slot).asleep).toBe(false);
    queueChatCommand(s, { type: 'poke', slot });
    expect(step(s, 200).filter((l) => l.template === 'wake.poke')).toHaveLength(0);
    expect(life.memory.length).toBe(before.mem);
    expect(life.regardPts).toBe(before.pts);
    expect(life.regardTier).toBe(before.tier);
  }, 120_000);

  it('does nothing to a Traveler who is awake', () => {
    const s = world(3);
    step(s, 3000);
    const awake = travelerViews(s).find((v) => !v.asleep);
    expect(awake).toBeDefined();
    queueChatCommand(s, { type: 'poke', slot: awake!.slot });
    expect(step(s, 200).filter((l) => l.template === 'wake.poke')).toHaveLength(0);
  }, 60_000);

  it('wakes a Friend more kindly: a Friend gets the friendly set and anyone else the grumpy one', () => {
    const friendly = new Set(WAKE.friendly.map((r) => r.text));
    const grumpy = new Set(WAKE.grumpy.map((r) => r.text));
    for (const t of identitiesOf(1)) {
      for (const d of [0, 0.4, 0.99]) {
        expect(friendly.has(wakeFor(true, t, () => d))).toBe(true);
        expect(grumpy.has(wakeFor(false, t, () => d))).toBe(true);
      }
    }
  });

  it('gives a Friend a reaction in the game too, and still records nothing', () => {
    let s = world(3);
    let slot = findSleeper(s);
    for (let seed = 4; slot < 0 && seed < 9; seed++) {
      s = world(seed);
      slot = findSleeper(s);
    }
    expect(slot).toBeGreaterThanOrEqual(0);
    const life = s.travelers[slot]!;
    makeFriends(life, Math.floor(s.clock!.nowMs / 60_000));
    const mem = life.memory.length;
    queueChatCommand(s, { type: 'poke', slot });
    expect(step(s, 200).filter((l) => l.template === 'wake.poke')).toHaveLength(1);
    expect(life.memory.length).toBe(mem);
  }, 120_000);

  it('is a valid command and a bad one is dropped', () => {
    expect(validateCommand({ type: 'poke', slot: 5 }).ok).toBe(true);
    expect(validateCommand({ type: 'poke', slot: -2 }).ok).toBe(false);
  });
});

describe('the wake lines', () => {
  it('are at least twelve and pass the validator', () => {
    expect(WAKE.grumpy.length + WAKE.friendly.length).toBeGreaterThanOrEqual(12);
    expect(validateShippedChat()).toEqual([]);
  });
});
