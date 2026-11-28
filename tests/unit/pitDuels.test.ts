import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { honorFor, PIT_DUELS } from '../../src/content/balance/pit';
import { PIT } from '../../src/content/balance/travelers';
import { PLACE_SPOTS } from '../../src/content/people/placeSpots';
import { MEMORY_KINDS } from '../../src/content/travelers/types';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar } from '../../src/sim/avatar';
import { chatSystem, socialSystem } from '../../src/sim/chat/engine';
import { duelSystem, startDuel } from '../../src/sim/duel';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { newMailbox } from '../../src/sim/mail';
import {
  pitBoutSystem,
  pitWin,
  playerInPit,
  startBout,
  waitingAtPit,
} from '../../src/sim/pitBouts';
import { computeBoard } from '../../src/sim/rankings/boards';
import { factsOf } from '../../src/sim/rankings/system';
import {
  createDemoState,
  deserializeState,
  hashState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import { combatSystem } from '../../src/sim/systems/combat';
import { crowdOf, travelersSystem } from '../../src/sim/travelers/crowd';
import { PLACE_LIST } from '../../src/sim/travelers/lists';
import { addFlag } from '../../src/sim/travelers/pit';
import { findAvatar } from '../../src/shared/summary';
import { honestPlain, tamper } from '../support/saves';

/**
 * The Pit's duels (POW-M5-30): Traveler bouts by the 30% rule, never a down; the player's Pit duels
 * on the Duels board and in memory once; the Pit honor granted once; the save and its check.
 */
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;
const RING = PLACE_SPOTS[PIT.place]!.rect;
const PIT_IDX = PLACE_LIST.indexOf(PIT.place);

/** A world with the Pit open and the avatar standing in it. */
function world(seed: number): { s: SimState; me: number } {
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  s.weatherOverride = 'clear';
  const me = createAvatar(s, px((RING.x + 2) * 16 + 8), px((RING.y + RING.h - 1) * 16 + 14));
  addFlag(s, PIT.flags.open);
  s.worldTick = 9000;
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return { s, me };
}

function step(s: SimState, ticks: number, seen?: (e: SimEvent) => void): void {
  const base = s.clock!.nowMs;
  const start = s.tick;
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    s.worldTick++;
    s.clock = { ...s.clock!, nowMs: base + Math.floor(((s.tick - start) * 1000) / 30) };
    s.events.list.length = 0;
    travelersSystem(s);
    combatSystem(s);
    duelSystem(s);
    pitBoutSystem(s);
    chatSystem(s);
    socialSystem(s);
    if (seen) for (const e of s.events.list) seen(e);
  }
}

/** Sends `n` promoted Travelers to wait at the Pit as duelists. */
function toThePit(s: SimState, n: number): number[] {
  const crowd = crowdOf(s);
  const out: number[] = [];
  for (const ent of crowd.ents.values()) {
    if (out.length >= n) break;
    crowd.doing[ent.slot] = {
      kind: 'social',
      place: PIT_IDX,
      left: 1e6,
      eta: 0,
      from: PIT_IDX,
      total: 0,
      skill: -1,
      thing: '',
    };
    s.travelers[ent.slot]!.guild = PIT.guilds[0]!;
    out.push(ent.slot);
  }
  return out;
}

describe('bouts between Travelers', () => {
  it('end by the 30% rule and never with a down, over 200 bouts', () => {
    const { s } = world(5);
    step(s, 120);
    expect(playerInPit(s)).toBe(true);
    const slots = toThePit(s, 4);
    expect(slots.length).toBe(4);
    expect(waitingAtPit(s).length).toBeGreaterThanOrEqual(2);
    let done = 0;
    let downs = 0;
    let rule = 0;
    let rollKept = 0;
    let lines = 0;
    for (let k = 0; k < 200; k++) {
      const a = slots[k % 4]!;
      const b = slots[(k + 1 + (k >> 2)) % 4 === k % 4 ? (k + 2) % 4 : (k + 1 + (k >> 2)) % 4]!;
      startBout(s, a, b);
      const bout = s.pitBouts!.bout!;
      const hp0 = { ...bout.hp0 };
      const winner = bout.winner;
      const ea = crowdOf(s).entOf[a]!;
      const eb = crowdOf(s).entOf[b]!;
      let ended: Extract<SimEvent, { type: 'pitBoutEnded' }> | null = null;
      // What each side lost, from the bout's own blows (the end heals both in the same tick).
      let lostA = 0;
      let lostB = 0;
      for (let t = 0; t < PIT_DUELS.maxTicks + 200 && !ended; t++)
        step(s, 1, (e) => {
          if (e.type === 'pitBoutEnded') ended = e;
          if (e.type === 'died') downs++;
          if (e.type === 'travelerSpoke' && e.template.startsWith('pit.')) lines++;
          if (e.type === 'damageDealt' && e.tag === 'bout') {
            if (e.dst === ea) lostA += e.amount;
            if (e.dst === eb) lostB += e.amount;
          }
        });
      expect(ended).not.toBeNull();
      const e = ended as unknown as { winner: number; loser: number; called: boolean };
      done++;
      if (e.winner === winner) rollKept++;
      const lostLoser = e.loser === a ? lostA / hp0.a : lostB / hp0.b;
      const lostWinner = e.winner === a ? lostA / hp0.a : lostB / hp0.b;
      if (e.called) continue;
      if (lostLoser >= 0.3 && lostWinner < 0.3) rule++;
      expect(s.entities.comps.fighter[ea]!.state).not.toBe('dead');
      expect(s.entities.comps.fighter[eb]!.state).not.toBe('dead');
    }
    console.log(
      `200 Pit bouts: ${rule} ended by the 30% rule on the rolled loser, ${downs} downs, ${lines} lines from the ring.`,
    );
    expect(done).toBe(200);
    expect(rule).toBe(200);
    expect(rollKept).toBe(200);
    expect(downs).toBe(0);
    expect(lines).toBeGreaterThan(200);
  }, 240_000);
});

describe('the player in the Pit', () => {
  it('a duel in the Pit records one result on the Duels board and one memory entry', () => {
    const { s, me } = world(7);
    step(s, 120);
    const [slot] = toThePit(s, 1);
    step(s, 60);
    expect(startDuel(s, slot!)).toBe(true);
    expect(s.duel?.pit).toBe(true);
    step(s, 70);
    const her = s.entities.comps.pools[crowdOf(s).entOf[slot!]!]!;
    her.hp = Math.floor(s.duel!.hp0.them * 0.65);
    step(s, 90);
    expect(s.duel).toBeUndefined();
    expect(s.mail.duels).toEqual({ wins: 1, losses: 0, pit: 1, honor: 0 });
    const memories = s.travelers[slot!]!.memory.filter((m) => MEMORY_KINDS[m.kind] === 'duelWon');
    expect(memories).toHaveLength(1);
    const board = computeBoard('duels', s.seed, s.travelers, factsOf(s, me));
    expect(board.playerValue).toBe(1);
  }, 60_000);

  it('the 5th and 20th Pit wins grant the honor once, and a reload or an older save does not again', () => {
    const { s } = world(9);
    const granted: number[] = [];
    const win = (st: SimState): void => {
      st.events.list.length = 0;
      st.mail.duels.wins++;
      pitWin(st);
      for (const e of st.events.list) if (e.type === 'pitHonor') granted.push(e.tier);
    };
    for (let i = 0; i < 4; i++) win(s);
    const older = serializeState(s);
    win(s);
    expect(granted).toEqual([1]);
    expect(s.mail.duels.honor).toBe(1);
    // A reload keeps it, and the next win grants nothing.
    const back = deserializeState(serializeState(s));
    win(back);
    expect(granted).toEqual([1]);
    expect(back.mail.duels.honor).toBe(1);
    // An older save has no honor, and is consistent with its count.
    const imp = deserializeState(older);
    expect(imp.mail.duels).toMatchObject({ pit: 4, honor: 0 });
    for (let i = 6; i <= 20; i++) win(back);
    expect(granted).toEqual([1, 2]);
    win(back);
    expect(granted).toEqual([1, 2]);
    expect(honorFor(back.mail.duels.pit)).toBe(2);
  });
});

describe('the save', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-32.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };
  const decode = (): Promise<SavePlain> =>
    new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));

  it('schema 32 to 33 gives the duel record no Pit wins and nothing else changes', async () => {
    expect(f.plain.schema).toBe(32);
    const raw = JSON.parse(f.plain.sim) as { mail: { duels: Record<string, unknown> } };
    expect(raw.mail.duels).not.toHaveProperty('pit');
    const at33 = migrate(await decode(), MIGRATIONS, 33);
    expect(at33.schema).toBe(33);
    const s = deserializeState(at33.sim);
    expect(s.mail.duels).toEqual(newMailbox().duels);
    const back = deserializeState(at33.sim);
    delete (back.mail.duels as { pit?: number }).pit;
    delete (back.mail.duels as { honor?: number }).honor;
    delete (back as { market?: unknown }).market;
    delete (back as { calendar?: unknown }).calendar;
    delete (back as { farm?: unknown }).farm;
    delete (back as { fishing?: unknown }).fishing;
    expect(hashState(back)).toBe(f.expectedHash);
  });

  it('reaches the current schema and passes every integrity layer', async () => {
    const now = migrate(await decode());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });

  it('a Pit win count edited up, or an honor out of step with it, is caught', () => {
    const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
    expect(codes(honestPlain())).not.toContain('PIT_HONOR');
    const more = tamper(honestPlain(), (st) => {
      st.mail.duels.pit = 7;
    });
    expect(codes(more)).toContain('PIT_HONOR');
    const honored = tamper(honestPlain(), (st) => {
      st.mail.duels.wins = 3;
      st.mail.duels.pit = 3;
      st.mail.duels.honor = 2;
    });
    expect(codes(honored)).toContain('PIT_HONOR');
    void findAvatar;
  });
});
