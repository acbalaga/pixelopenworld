import { describe, expect, it } from 'vitest';
import { DUELS } from '../../src/content/balance/mail';
import { validateShippedChat } from '../../src/content/chat/validate';
import { FLAG, MEMORY_KINDS } from '../../src/content/travelers/types';
import { createAvatar } from '../../src/sim/avatar';
import { chatSystem, queueChatCommand, socialSystem } from '../../src/sim/chat/engine';
import { duelFloor, duelSystem } from '../../src/sim/duel';
import { getComp } from '../../src/sim/kernel/entities';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { computeBoard } from '../../src/sim/rankings/boards';
import { factsOf } from '../../src/sim/rankings/system';
import { findAvatar } from '../../src/shared/summary';
import { createDemoState, type SimState } from '../../src/sim/state';
import { crowdOf, travelersSystem } from '../../src/sim/travelers/crowd';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { remember, updateRival } from '../../src/sim/travelers/social';

/**
 * Duels, Rivals and the Duels board (POW-M5-12): challenge, accept by temper and regard, a
 * non-lethal fight to 30% lost, the result as memory and on the board, and a Rival at the dungeon.
 */
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;

function world(seed: number): SimState {
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  createAvatar(s, px(192 * 16 + 8), px(193 * 16 + 8));
  s.worldTick = 9000;
  s.weatherOverride = 'clear';
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

interface Spoke {
  slot: number;
  template: string;
  channel: string;
}

function step(
  s: SimState,
  ticks: number,
  inject?: () => SimEvent[],
): { spoke: Spoke[]; events: SimEvent[] } {
  const base = s.clock!.nowMs;
  const start = s.tick;
  const spoke: Spoke[] = [];
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    s.worldTick++;
    s.clock = { ...s.clock!, nowMs: base + Math.floor(((s.tick - start) * 1000) / 30) };
    s.events.list.length = 0;
    if (inject) s.events.list.push(...inject());
    travelersSystem(s);
    chatSystem(s);
    duelSystem(s);
    socialSystem(s);
    for (const e of s.events.list) {
      events.push(e);
      if (e.type === 'travelerSpoke')
        spoke.push({ slot: e.slot, template: e.template, channel: e.channel });
    }
  }
  return { spoke, events };
}

/** A promoted Traveler of a temper, near enough to challenge. */
function nearTraveler(s: SimState, temper: 'bold' | 'steady' | 'shy'): number {
  const crowd = crowdOf(s);
  const ids = identitiesOf(s.seed);
  const me = findAvatar(s)!;
  const mp = s.entities.comps.pos[me]!;
  for (const [id, ent] of crowd.ents) {
    const p = s.entities.comps.pos[id]!;
    const near = Math.hypot((p.x - mp.x) / 256, (p.y - mp.y) / 256) < DUELS.nearPx * 0.8;
    if (near && ids[ent.slot]!.temper === temper) return ent.slot;
  }
  return -1;
}

describe('a duel', () => {
  it('is challenged, accepted by a bold Traveler, fought to 30% lost, and ends on the board and in memory', () => {
    let s = world(3);
    step(s, 2400);
    let slot = nearTraveler(s, 'bold');
    for (let seed = 4; slot < 0 && seed < 12; seed++) {
      s = world(seed);
      step(s, 2400);
      slot = nearTraveler(s, 'bold');
    }
    expect(slot, 'a bold Traveler is near').toBeGreaterThanOrEqual(0);
    const crowd = crowdOf(s);
    const ent = crowd.entOf[slot]!;
    const me = findAvatar(s)!;
    // Challenge. A bold Traveler takes it at any regard, and the count begins.
    queueChatCommand(s, { type: 'duel', slot });
    const first = step(s, 5);
    expect(first.events.some((e) => e.type === 'duelStarted' && e.slot === slot)).toBe(true);
    expect(s.duel?.slot).toBe(slot);
    // The fight begins after the count: the Traveler is on the other team and cannot fall.
    step(s, 70);
    expect(getComp(s.entities, ent, 'fighter')!.team).toBe(1);
    expect(duelFloor(s, ent)).toBe(1);
    expect(duelFloor(s, me)).toBe(1);
    const her = getComp(s.entities, ent, 'pools')!;
    const hp0 = s.duel!.hp0.them;
    // The player lands enough to take a third of their health: they lose, nobody falls.
    her.hp = Math.floor(hp0 * 0.65);
    const end = step(s, 3);
    const done = end.events.find((e) => e.type === 'duelEnded');
    expect(done).toMatchObject({ type: 'duelEnded', slot, result: 'player' });
    expect(s.duel).toBeUndefined();
    expect(getComp(s.entities, ent, 'fighter')!.team).toBe(0);
    expect(her.hp).toBeGreaterThanOrEqual(hp0);
    expect(duelFloor(s, ent)).toBe(0);
    // The result: the record, the memory (once), and the Duels board.
    expect(s.mail.duels).toEqual({ wins: 1, losses: 0, pit: 0, honor: 0 });
    const memories = s.travelers[slot]!.memory.filter((m) => MEMORY_KINDS[m.kind] === 'duelWon');
    expect(memories).toHaveLength(1);
    const board = computeBoard('duels', s.seed, s.travelers, factsOf(s, me));
    expect(board.playerRank).not.toBeNull();
    expect(board.playerValue).toBe(1);
    // A sporting line follows from them.
    expect(
      end.spoke
        .concat(step(s, 120).spoke)
        .some((l) => l.slot === slot && l.template.startsWith('duel.')),
    ).toBe(true);
  }, 120_000);

  it('is refused by a shy Traveler who does not know the player, and nothing starts', () => {
    let s = world(3);
    step(s, 2400);
    let slot = nearTraveler(s, 'shy');
    for (let seed = 4; slot < 0 && seed < 14; seed++) {
      s = world(seed);
      step(s, 2400);
      slot = nearTraveler(s, 'shy');
    }
    expect(slot, 'a shy Traveler is near').toBeGreaterThanOrEqual(0);
    queueChatCommand(s, { type: 'duel', slot });
    const r = step(s, 200);
    expect(s.duel).toBeUndefined();
    expect(r.spoke.some((l) => l.slot === slot && l.template === 'duel.refuse')).toBe(true);
  }, 120_000);

  it('ends in a draw if the Traveler is not there any more, and heals nobody into a record', () => {
    let s = world(3);
    step(s, 2400);
    let slot = nearTraveler(s, 'bold');
    for (let seed = 4; slot < 0 && seed < 12; seed++) {
      s = world(seed);
      step(s, 2400);
      slot = nearTraveler(s, 'bold');
    }
    queueChatCommand(s, { type: 'duel', slot });
    step(s, 20);
    expect(s.duel).toBeDefined();
    s.entities.alive[crowdOf(s).entOf[slot]!] = false;
    const r = step(s, 5);
    expect(r.events.find((e) => e.type === 'duelEnded')).toMatchObject({ result: 'draw' });
    expect(s.mail.duels).toEqual({ wins: 0, losses: 0, pit: 0, honor: 0 });
  }, 120_000);
});

describe('Rivals', () => {
  it('a Traveler becomes one by repeated close competition, and a single duel does not', () => {
    const s = world(3);
    const life = s.travelers[10]!;
    remember(life, 'duelWon', 0, 100, 1_000_000);
    expect(updateRival(life)).toBe(false);
    remember(life, 'duelLost', 0, 101, 1_000_000);
    expect(updateRival(life)).toBe(false);
    remember(life, 'passedOnBoard', 1, 102, 1_000_000);
    expect(updateRival(life)).toBe(true);
    expect(life.flags & FLAG.rival).toBeTruthy();
    // It never comes off, and it does not stop friendship.
    expect(updateRival(life)).toBe(false);
  });

  it('one turns up at the dungeon the player goes to most, within 5 visits', () => {
    const s = world(3);
    step(s, 2400);
    const crowd = crowdOf(s);
    const me = findAvatar(s)!;
    // A Rival who is online.
    const slot = [...crowd.ents.values()][0]!.slot;
    s.travelers[slot]!.flags |= FLAG.rival;
    let shown = -1;
    for (let visit = 1; visit <= 5 && shown < 0; visit++) {
      // Each visit is a few real minutes after the last.
      const r = step(s, 30 * 120, () => []);
      void r;
      const got = step(s, 3, () => [
        { type: 'delved', who: me, dungeon: 'dungeon.rootway', room: 'r1' },
      ]);
      if (got.events.some((e) => e.type === 'rivalAppeared' && e.slot === slot)) shown = visit;
    }
    expect(shown, 'a Rival appeared').toBeGreaterThan(0);
    expect(shown).toBeLessThanOrEqual(5);
  }, 120_000);
});

describe('what Travelers say about duels', () => {
  it('passes the validator: sporting, no dashes, only {player} and {dungeon}', () => {
    expect(validateShippedChat()).toEqual([]);
  });
});
