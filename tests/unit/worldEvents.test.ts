import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INVASION, RAID, SCHEDULES } from '../../src/content/balance/events';
import { PLACE_SPOTS } from '../../src/content/people/placeSpots';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar } from '../../src/sim/avatar';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { renownIn } from '../../src/sim/renown';
import {
  createDemoState,
  deserializeState,
  hashState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import { crowdOf, travelersSystem } from '../../src/sim/travelers/crowd';
import { PLACE_LIST } from '../../src/sim/travelers/lists';
import { localMinute } from '../../src/sim/travelers/schedule';
import { newCalendar, slotAt, worldEventsSystem, calendarOf } from '../../src/sim/worldEvents';
import { findAvatar } from '../../src/shared/summary';
import { honestPlain, plainFor, tamper } from '../support/saves';

/**
 * World events and the calendar (POW-M5-11): slots fire at their trusted times and once, after a
 * long offline gap too; raids with Traveler parties and pay; invasions and their Renown bound.
 */
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const DAY = 86_400_000;
const T0 = (MON + 1) * DAY;
const HF = { x: (164 + 28) * 16, y: (164 + 28) * 16 };

function world(seed: number, at = HF, nowMs = T0): SimState {
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  s.weatherOverride = 'clear';
  createAvatar(s, px(at.x), px(at.y));
  s.clock = { nowMs, epochMs: nowMs - 5 * DAY, tzOffsetMin: 0 };
  return s;
}

/** Moves the clock and runs the scheduler (and optionally the crowd) each step. */
function advance(
  s: SimState,
  minutes: number,
  stepMin = 1,
  seen?: (e: SimEvent) => void,
  crowd = false,
): void {
  for (let i = 0; i < minutes; i += stepMin) {
    s.clock = { ...s.clock!, nowMs: s.clock!.nowMs + stepMin * 60_000 };
    s.tick += 60;
    s.worldTick += 60;
    s.events.list.length = 0;
    if (crowd) travelersSystem(s);
    worldEventsSystem(s);
    if (seen) for (const e of s.events.list) seen(e);
  }
}

const minuteOf = (s: SimState): number => localMinute(s.clock!.nowMs, s.clock!.tzOffsetMin);

describe('the scheduler', () => {
  it('fires each slot at its time and once: four raids, one invasion a real day', () => {
    const s = world(3, { x: 0, y: 0 });
    const fired: { kind: string; slot: number; at: number }[] = [];
    advance(s, 1440, 1, (e) => {
      if (e.type === 'worldEventStarted')
        fired.push({ kind: e.kind, slot: e.slot, at: minuteOf(s) });
    });
    const raids = fired.filter((f) => f.kind === 'raid');
    const invasions = fired.filter((f) => f.kind === 'invasion');
    expect(raids.length).toBe(1440 / SCHEDULES.raid!.period);
    expect(invasions.length).toBe(1);
    expect(new Set(fired.map((f) => `${f.kind}:${f.slot}`)).size).toBe(fired.length);
    for (const f of fired) {
      const at = slotAt(s.seed, f.kind as 'raid', f.at)!;
      expect(at.slot).toBe(f.slot);
      expect(f.at).toBe(at.start);
    }
  });

  it('after a 3-day offline gap, the next slot fires at its time, missed ones are not replayed, and a reload does not refire', () => {
    const s = world(5, { x: 0, y: 0 });
    advance(s, 60);
    const lastRaid = s.calendar.last.raid ?? -1;
    // Three days away, then back a minute before a raid slot.
    const away = minuteOf(s) + 3 * 1440;
    const next = slotAt(s.seed, 'raid', away)!;
    const target = next.start + SCHEDULES.raid!.period - 1;
    s.clock = { ...s.clock!, nowMs: s.clock!.nowMs + (target - minuteOf(s)) * 60_000 };
    const fired: number[] = [];
    advance(
      s,
      5,
      1,
      (e) => e.type === 'worldEventStarted' && e.kind === 'raid' && fired.push(e.slot),
    );
    expect(fired).toEqual([next.slot + 1]);
    expect(next.slot + 1).toBeGreaterThan(lastRaid + 1);
    // A reload in the middle of it: the slot is saved as fired, so it is resumed, not refired.
    const back = deserializeState(serializeState(s));
    back.clock = s.clock;
    advance(back, 5, 1, (e) => e.type === 'worldEventStarted' && fired.push(e.slot));
    expect(fired).toEqual([next.slot + 1]);
    expect(back.worldEvents!.active.some((a) => a.kind === 'raid')).toBe(true);
  });

  it('announces each event in the System channel before it starts, and the calendar counts down', () => {
    const s = world(7, { x: 0, y: 0 });
    const soon: { kind: string; inMin: number }[] = [];
    advance(
      s,
      1440,
      1,
      (e) => e.type === 'worldEventSoon' && soon.push({ kind: e.kind, inMin: e.inMin }),
    );
    expect(soon.filter((x) => x.kind === 'raid').length).toBe(4);
    for (const x of soon)
      expect(x.inMin).toBeLessThanOrEqual(SCHEDULES[x.kind as 'raid']!.announce);
    const cal = calendarOf(s);
    expect(cal.map((c) => c.kind).sort()).toEqual(['invasion', 'market', 'raid']);
    for (const c of cal) expect(c.inMin).toBeGreaterThanOrEqual(0);
  });

  it('market day turns on the market only while it runs', () => {
    const s = world(9, { x: 0, y: 0 });
    let on = 0;
    advance(s, 7 * 1440, 10, () => undefined);
    // Walk a week minute by minute is long; sample every ten minutes and count the hours it was on.
    const s2 = world(9, { x: 0, y: 0 });
    for (let i = 0; i < 7 * 144; i++) {
      advance(s2, 10, 10);
      if (s2.marketDay) on++;
    }
    expect(on * 10).toBeGreaterThanOrEqual(SCHEDULES.market!.duration - 10);
    expect(on * 10).toBeLessThanOrEqual(SCHEDULES.market!.duration + 10);
    void s;
  });
});

describe('a field raid', () => {
  function raidNow(seed: number, at?: { x: number; y: number }): SimState {
    const s = world(seed, at ?? { x: 0, y: 0 }, T0 + 20 * 3_600_000);
    advance(s, 30, 1, undefined, true);
    const now = minuteOf(s);
    const sl = slotAt(s.seed, 'raid', now)!;
    const target = sl.start + SCHEDULES.raid!.period;
    s.clock = { ...s.clock!, nowMs: s.clock!.nowMs + (target - now - 1) * 60_000 };
    advance(s, 2, 1, undefined, true);
    return s;
  }

  it('forms parties of 3 to 5 from ties and guildmates, Iron Oath first, who muster and then walk out together', () => {
    const s = raidNow(11);
    const ev = s.worldEvents!.active.find((a) => a.kind === 'raid')!;
    expect(ev).toBeDefined();
    expect(ev.parties!.length).toBeGreaterThan(0);
    for (const p of ev.parties!) {
      expect(p.length).toBeGreaterThanOrEqual(RAID.partySize[0]);
      expect(p.length).toBeLessThanOrEqual(RAID.partySize[1]);
    }
    const crowd = crowdOf(s);
    const gate = PLACE_LIST.indexOf('hearthford.gate_n');
    const raiders = ev.parties!.flat();
    // Everyone mustering is at the gate, apart from anyone offline or busy (crafting, in a party),
    // who stays named in their party but does not walk out (POW-M6-23).
    const busy = (r: number): boolean =>
      crowd.online[r] !== 1 || crowd.doing[r]?.kind === 'craft' || crowd.doing[r]?.kind === 'party';
    const off = raiders.filter((r) => crowd.doing[r]?.place !== gate && !busy(r));
    expect(off).toEqual([]);
    expect(raiders.filter((r) => !busy(r)).length).toBeGreaterThan(0);
    if (s.travelers.some((l, i) => l.guild === RAID.firstGuild && crowd.online[i] === 1))
      expect(s.travelers[ev.parties![0]![0]!]!.guild).toBe(RAID.firstGuild);
    advance(s, RAID.musterMin + 1, 1, undefined, true);
    const site = PLACE_LIST.indexOf(ev.site!);
    expect(raiders.filter((r) => !busy(r)).every((r) => crowd.doing[r]?.place === site)).toBe(true);
  });

  it('has the same parties after a reload mid-raid, at the muster and out at the fight', () => {
    for (const [seed, after] of [
      [11, 1],
      [17, RAID.musterMin + 2],
    ] as const) {
      const s = raidNow(seed);
      advance(s, after, 1, undefined, true);
      const before = s.worldEvents!.active.find((a) => a.kind === 'raid')!;
      expect(before.parties!.length, `seed ${seed}`).toBeGreaterThan(0);
      const back = deserializeState(serializeState(s));
      back.clock = s.clock!;
      back.worldEvents = undefined;
      // Both run one more minute: the saved game reloaded, and the one that kept going.
      advance(back, 1, 1, undefined, true);
      advance(s, 1, 1, undefined, true);
      const again = back.worldEvents!.active.find((a) => a.kind === 'raid')!;
      expect(again.parties, `seed ${seed} after ${after} min`).toEqual(before.parties);
      expect(Boolean(again.walked), `seed ${seed}`).toBe(Boolean(before.walked));
      // They are where the raid has them: still at the gate, or gone to the fight.
      const crowd = crowdOf(back);
      const want = PLACE_LIST.indexOf(again.walked ? again.site! : 'hearthford.gate_n');
      const sent = again.parties!.flat().filter((r) => crowd.doing[r]?.place === want);
      expect(sent.length, `seed ${seed} raiders placed`).toBeGreaterThan(0);
    }
  });

  it('pays the player by their share once, within the bound, and not again after a reload', () => {
    const probe = raidNow(13);
    const site = probe.worldEvents!.active.find((a) => a.kind === 'raid')!.site!;
    const r = PLACE_SPOTS[site]!.rect;
    const s = raidNow(13, { x: (r.x + r.w / 2) * 16, y: (r.y + r.h / 2) * 16 + 40 });
    const ev = s.worldEvents!.active.find((a) => a.kind === 'raid')!;
    expect(ev.boss).toBeDefined();
    const me = findAvatar(s)!;
    const boss = ev.boss!;
    const hp = s.entities.comps.pools[boss]!.hpMax;
    expect(hp).toBe(Math.round(945 * RAID.hpScale));
    const paid: number[] = [];
    // The player deals a third of the boss's Health, and it falls.
    s.clock = { ...s.clock!, nowMs: s.clock!.nowMs + 1000 };
    s.events.list.length = 0;
    s.events.list.push(
      {
        type: 'damageDealt',
        src: me,
        dst: boss,
        amount: Math.round(hp / 3),
        crit: false,
        bonus: false,
        heavy: false,
        tag: 'blades',
      },
      { type: 'died', id: boss, team: 1 },
    );
    worldEventsSystem(s);
    for (const e of s.events.list) if (e.type === 'eventRewarded') paid.push(e.coin);
    expect(paid.length).toBe(1);
    expect(paid[0]).toBeGreaterThanOrEqual(RAID.coin[0]);
    expect(paid[0]).toBeLessThanOrEqual(RAID.coin[1]);
    expect(s.ledger.coinEarned.eventReward).toBe(paid[0]);
    expect(validateSave(plainFor(s)).reasons.map((x) => x.code)).not.toContain('EVENT_IMPLAUSIBLE');
    const back = deserializeState(serializeState(s));
    back.clock = s.clock;
    back.worldEvents = undefined;
    advance(back, 2, 1, (e) => e.type === 'eventRewarded' && paid.push(e.coin));
    const again = back.worldEvents!.active.find((a) => a.kind === 'raid');
    if (again?.boss !== undefined) {
      back.events.list.length = 0;
      back.events.list.push(
        {
          type: 'damageDealt',
          src: findAvatar(back)!,
          dst: again.boss,
          amount: hp,
          crit: false,
          bonus: false,
          heavy: false,
          tag: 'blades',
        },
        { type: 'died', id: again.boss, team: 1 },
      );
      worldEventsSystem(back);
      for (const e of back.events.list) if (e.type === 'eventRewarded') paid.push(e.coin);
    }
    expect(paid.length).toBe(1);
  });

  it('raid pay past what the raids fired allow is flagged', () => {
    const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
    const rich = tamper(honestPlain(), (st, who) => {
      st.entities.comps.avatar[who]!.coin += 5000;
      st.ledger.coinEarned.eventReward = 5000;
      st.ledger.eventsFired = { raid: 2 };
    });
    expect(codes(rich)).toContain('EVENT_IMPLAUSIBLE');
  });
});

describe('an invasion', () => {
  it('sends waves at the gates, and Renown from defending stays within its bound', () => {
    const s = world(17, HF, T0 + 17 * 3_600_000);
    advance(s, 60);
    const at = slotAt(s.seed, 'invasion', minuteOf(s))!;
    const target = at.start + SCHEDULES.invasion!.period;
    s.clock = { ...s.clock!, nowMs: s.clock!.nowMs + (target - minuteOf(s)) * 60_000 };
    const waves: number[] = [];
    advance(s, 1, 1, (e) => e.type === 'invasionWave' && waves.push(e.wave));
    expect(waves).toEqual([1]);
    const me = findAvatar(s)!;
    const invaders = [...s.entities.comps.ai.keys()].filter(
      (id) => s.entities.comps.ai[id]?.ev === 'invasion',
    );
    expect(invaders.length).toBe(4 * INVASION.perGate);
    const r0 = renownIn(s, me, 'dawnmeadow');
    // The player brings down far more than the cap counts.
    for (let k = 0; k < 40; k++) {
      s.events.list.length = 0;
      s.events.list.push({
        type: 'killed',
        src: me,
        dst: invaders[k % invaders.length]!,
        kind: 'creature.mossling',
        tag: 'blades',
      });
      worldEventsSystem(s);
    }
    const gained = renownIn(s, me, 'dawnmeadow') - r0;
    expect(gained).toBe(INVASION.renownCap);
    advance(
      s,
      INVASION.waveMin * INVASION.waves,
      1,
      (e) => e.type === 'invasionWave' && waves.push(e.wave),
    );
    expect(waves).toEqual([1, 2, 3]);
  });
});

describe('the save', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-34.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };
  const decode = (): Promise<SavePlain> =>
    new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));

  it('schema 34 to 35 gives an old save an empty calendar and nothing else changes', async () => {
    expect(f.plain.schema).toBe(34);
    expect(JSON.parse(f.plain.sim)).not.toHaveProperty('calendar');
    const at35 = migrate(await decode(), MIGRATIONS, 35);
    expect(at35.schema).toBe(35);
    const s = deserializeState(at35.sim);
    expect(s.calendar).toEqual(newCalendar());
    delete (s as { calendar?: unknown }).calendar;
    delete (s as { farm?: unknown }).farm;
    delete (s as { fishing?: unknown }).fishing;
    expect(hashState(s)).toBe(f.expectedHash);
  });

  it('reaches the current schema and passes every integrity layer', async () => {
    const now = migrate(await decode());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });
});
