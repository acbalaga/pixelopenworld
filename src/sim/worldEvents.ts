import { EVENT_KINDS, INVASION, RAID, SCHEDULES, type EventKind } from '../content/balance/events';
import { FIGHT_AREAS } from '../content/balance/travelers';
import { PLACE_SPOTS } from '../content/people/placeSpots';
import { findAvatar } from '../shared/summary';
import { spawnCreature } from './combat/enemy';
import { destroy, getComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { SUBPX } from './kernel/fixed';
import { earnCoin } from './ledger';
import { addRenown } from './renown';
import type { SimState } from './state';
import { hash01 } from './travelers/dice';
import { identitiesOf } from './travelers/generate';
import { PLACE_LIST } from './travelers/lists';
import { isOnlineAt, localMinute } from './travelers/schedule';
import { routeMinutes } from './travelers/crowd';

/**
 * World events and the calendar (POW-M5-11, design/07 World events). Events run on a schedule in
 * the player's local real time, from trusted time: a field raid four times a real day, an invasion
 * of Hearthford's outskirts every evening, a market day each Saturday, and the "maintenance"
 * mechanism with nothing scheduled yet. The last slot fired per kind is saved, so a slot never fires
 * twice, a reload does not refire it, and after a long offline gap the next slot fires at its time
 * (missed ones are not replayed).
 *
 * A field raid brings a scaled field boss to a Dawnmeadow creature area. Travelers form raid parties
 * of three to five from friend ties and guildmates (Iron Oath first), muster at Hearthford's north
 * gate and walk out together. The player can join: their share of the damage pays coin, ledger
 * `eventReward`, once per raid. An invasion sends waves of creatures at Hearthford's gates;
 * bringing them down raises Renown, up to a cap per invasion. Market day turns on the market's
 * busier day (M5-10).
 */

export interface CalendarState {
  /** The last slot fired, by kind. -1 for never. */
  last: Record<string, number>;
  /** The last raid slot the player was paid for. */
  paid: number;
}

export function newCalendar(): CalendarState {
  return { last: {}, paid: -1 };
}

/** An event running now. Session only: rebuilt from the calendar after a load. */
export interface ActiveEvent {
  kind: EventKind;
  slot: number;
  /** Local minutes it started and ends. */
  start: number;
  end: number;
  /** Raid: the creature area it is at, the boss once made, the player's damage, the parties. */
  site?: string;
  boss?: EntityId;
  bossHp?: number;
  dealt?: number;
  won?: boolean;
  parties?: number[][];
  walked?: boolean;
  /** Invasion: waves sent, kills by the player, Renown given. */
  waves?: number;
  kills?: number;
  renown?: number;
}

export interface WorldEventsState {
  active: ActiveEvent[];
  /** Slots announced, by `kind:slot`. */
  announced: Set<string>;
  minute: number;
}

const evOf = (state: SimState): WorldEventsState =>
  (state.worldEvents ??= { active: [], announced: new Set(), minute: -1 });

const jitterOf = (seed: number, kind: EventKind): number => {
  const s = SCHEDULES[kind];
  return s && s.jitter > 0
    ? Math.floor(hash01(seed, 0, 1100 + EVENT_KINDS.indexOf(kind), 0) * s.jitter)
    : 0;
};

/** The slot a local minute falls in, and that slot's start. Null for an unscheduled kind. */
export function slotAt(
  seed: number,
  kind: EventKind,
  minute: number,
): { slot: number; start: number; end: number } | null {
  const s = SCHEDULES[kind];
  if (!s) return null;
  const off = s.offset + jitterOf(seed, kind);
  const slot = Math.floor((minute - off) / s.period);
  const start = slot * s.period + off;
  return { slot, start, end: start + s.duration };
}

/** The next start of a kind at or after a minute, for the calendar. */
export function nextStart(seed: number, kind: EventKind, minute: number): number | null {
  const at = slotAt(seed, kind, minute);
  const s = SCHEDULES[kind];
  if (!at || !s) return null;
  return minute < at.end && minute >= at.start ? at.start : at.start + s.period;
}

/** The calendar: each scheduled kind, when it next starts, and whether it is on now. */
export function calendarOf(
  state: SimState,
): { kind: EventKind; start: number; inMin: number; on: boolean }[] {
  const c = state.clock;
  if (!c) return [];
  const m = localMinute(c.nowMs, c.tzOffsetMin);
  const out: { kind: EventKind; start: number; inMin: number; on: boolean }[] = [];
  for (const kind of EVENT_KINDS) {
    const start = nextStart(state.seed, kind, m);
    if (start === null) continue;
    const on = (state.worldEvents?.active ?? []).some((a) => a.kind === kind);
    out.push({ kind, start, inMin: Math.max(0, start - m), on });
  }
  return out.sort((a, b) => a.inMin - b.inMin);
}

/** True while an event of a kind is on. */
export const eventOn = (state: SimState, kind: EventKind): boolean =>
  (state.worldEvents?.active ?? []).some((a) => a.kind === kind);

/** The "maintenance" announcement (M10 schedules it). Says so in the System channel, and that is all. */
export function announceMaintenance(state: SimState, inMin: number): void {
  emit(state.events, { type: 'worldEventSoon', kind: 'maintenance', inMin });
}

// ---- Raids ----

const sitesWithSpots = FIGHT_AREAS.map((a) => a.place).filter(
  (p, i, all) => all.indexOf(p) === i && PLACE_SPOTS[p]?.rect,
);

function sitePx(site: string): { x: number; y: number } | null {
  const r = PLACE_SPOTS[site]?.rect;
  return r ? { x: (r.x + r.w / 2) * 16, y: (r.y + r.h / 2) * 16 + 8 } : null;
}

/**
 * Raid parties of 3 to 5 from friend ties and guildmates, Iron Oath first, among those online when
 * the raid starts. Only saved or seeded inputs go in (schedules, guilds, ties, the slot), so a reload
 * in the middle of a raid forms the same parties again (POW-M6-23). Who is busy is checked when
 * raiders are sent, not here.
 */
function formParties(state: SimState, slot: number, start: number): number[][] {
  const ids = identitiesOf(state.seed);
  const free = ids.filter((t) => isOnlineAt(state.seed, t, start)).map((t) => t.slot);
  const guildOf = (s: number): number => state.travelers[s]!.guild;
  free.sort(
    (a, b) =>
      Number(guildOf(b) === RAID.firstGuild) - Number(guildOf(a) === RAID.firstGuild) || a - b,
  );
  const taken = new Set<number>();
  const parties: number[][] = [];
  for (const lead of free) {
    if (parties.length >= RAID.parties) break;
    if (taken.has(lead)) continue;
    const [lo, hi] = RAID.partySize;
    const size = lo + Math.floor(hash01(state.seed, lead, 1200, slot) * (hi - lo + 1));
    const group = [lead];
    const t = ids[lead]!;
    for (const o of free) {
      if (group.length >= size) break;
      if (o === lead || taken.has(o)) continue;
      const tie = t.ties.some((x) => x.slot === o);
      const mate = guildOf(lead) !== 0 && guildOf(o) === guildOf(lead);
      if (tie || mate) group.push(o);
    }
    if (group.length < lo) continue;
    for (const s of group) taken.add(s);
    parties.push(group);
  }
  return parties;
}

/** Sends raiders to a place, all leaving now, so a party walks out together. */
function sendRaiders(
  state: SimState,
  ev: ActiveEvent,
  place: string,
  kind: 'social' | 'fight',
): void {
  const crowd = state.crowd;
  if (!crowd) return;
  const idx = PLACE_LIST.indexOf(place);
  if (idx < 0) return;
  for (const party of ev.parties ?? [])
    for (const s of party) {
      if (crowd.online[s] !== 1) continue;
      // Busy at their bench, in a party, or with the player: they stay where they are.
      const d = crowd.doing[s];
      if (d?.kind === 'craft' || d?.kind === 'party') continue;
      if (state.party?.members.some((m) => m.slot === s)) continue;
      const life = state.travelers[s]!;
      // Everyone leaves now, so a party is seen walking out together.
      const eta = routeMinutes(life.place, idx);
      crowd.doing[s] = {
        kind,
        place: idx,
        left: (ev.end - ev.start) * 30,
        eta,
        from: life.place,
        total: eta,
        skill: -1,
        thing: kind === 'fight' ? RAID.boss : '',
      };
    }
}

function nearPlayer(state: SimState, at: { x: number; y: number }, px: number): boolean {
  const me = findAvatar(state);
  const p = me === null ? undefined : state.entities.comps.pos[me];
  return !!p && Math.hypot(p.x / SUBPX - at.x, p.y / SUBPX - at.y) <= px;
}

function raidTick(state: SimState, ev: ActiveEvent, minute: number): void {
  const at = ev.site ? sitePx(ev.site) : null;
  if (!at) return;
  if (!ev.walked && minute >= ev.start + RAID.musterMin) {
    ev.walked = true;
    sendRaiders(state, ev, ev.site!, 'fight');
    emit(state.events, { type: 'raidSetOut', site: ev.site!, parties: ev.parties?.length ?? 0 });
  }
  // The boss is made real when the player comes near, once.
  if (ev.boss === undefined && !ev.won && nearPlayer(state, at, RAID.nearPx)) {
    const id = spawnCreature(state, RAID.boss, at.x, at.y);
    const pools = state.entities.comps.pools[id]!;
    pools.hpMax = Math.round(pools.hpMax * RAID.hpScale);
    pools.hp = pools.hpMax;
    const cb = state.entities.comps.combatant[id]!;
    cb.power = Math.round(cb.power * RAID.powerScale);
    cb.name = `${cb.name} (raid)`;
    const ai = state.entities.comps.ai[id]!;
    ai.noLoot = true;
    ai.ev = 'raid';
    ev.boss = id;
    ev.bossHp = pools.hpMax;
    emit(state.events, { type: 'raidBossUp', id, site: ev.site! });
  }
  if (ev.boss !== undefined && !ev.won) {
    const me = findAvatar(state);
    for (const e of state.events.list) {
      if (e.type === 'damageDealt' && e.dst === ev.boss && e.src === me)
        ev.dealt = (ev.dealt ?? 0) + e.amount;
      if (e.type === 'died' && e.id === ev.boss) ev.won = true;
    }
    if (ev.won) raidWon(state, ev);
  }
}

/** The raid boss is down: the player is paid by their share, once per raid. */
function raidWon(state: SimState, ev: ActiveEvent): void {
  const me = findAvatar(state);
  emit(state.events, { type: 'raidEnded', site: ev.site ?? '', won: true });
  if (me === null || state.calendar.paid >= ev.slot) return;
  const share = (ev.dealt ?? 0) / Math.max(1, ev.bossHp ?? 1);
  if (share * 100 < RAID.minPct) return;
  const [lo, hi] = RAID.coin;
  const coin = Math.round(lo + (hi - lo) * Math.min(1, share));
  state.calendar.paid = ev.slot;
  earnCoin(state, me, coin, 'eventReward');
  emit(state.events, { type: 'eventRewarded', kind: 'raid', coin });
}

// ---- Invasions ----

const HEARTHFORD_MID = { x: (164 + 28) * 16, y: (164 + 28) * 16 };
const GATES = [
  { x: (164 + 28) * 16, y: (164 - 4) * 16 },
  { x: (164 + 28) * 16, y: (164 + 60) * 16 },
  { x: (164 - 4) * 16, y: (164 + 28) * 16 },
  { x: (164 + 60) * 16, y: (164 + 28) * 16 },
];

function invasionTick(state: SimState, ev: ActiveEvent, minute: number): void {
  const due = Math.min(INVASION.waves, 1 + Math.floor((minute - ev.start) / INVASION.waveMin));
  if ((ev.waves ?? 0) < due && nearPlayer(state, HEARTHFORD_MID, INVASION.nearPx)) {
    ev.waves = (ev.waves ?? 0) + 1;
    GATES.forEach((g, gi) => {
      for (let k = 0; k < INVASION.perGate; k++) {
        const c =
          INVASION.creatures[
            Math.floor(
              hash01(state.seed, gi * 10 + k, 1300 + (ev.waves ?? 0), ev.slot) *
                INVASION.creatures.length,
            )
          ]!;
        const id = spawnCreature(state, c, g.x + (k - 0.5) * 20, g.y);
        const ai = state.entities.comps.ai[id]!;
        ai.ev = 'invasion';
        ai.provoked = true;
      }
    });
    emit(state.events, { type: 'invasionWave', wave: ev.waves });
  }
  const me = findAvatar(state);
  for (const e of state.events.list) {
    if (e.type !== 'killed' || e.src !== me) continue;
    if (getComp(state.entities, e.dst, 'ai')?.ev !== 'invasion') continue;
    ev.kills = (ev.kills ?? 0) + 1;
    const give = Math.min(INVASION.renownPerKill, INVASION.renownCap - (ev.renown ?? 0));
    if (give > 0 && me !== null) {
      ev.renown = (ev.renown ?? 0) + give;
      addRenown(state, me, 'dawnmeadow', give);
      emit(state.events, { type: 'invasionRenown', amount: give });
    }
  }
}

// ---- The scheduler ----

function fire(
  state: SimState,
  kind: EventKind,
  at: { slot: number; start: number; end: number },
): void {
  const w = evOf(state);
  state.calendar.last[kind] = at.slot;
  const led = state.ledger;
  const fired = (led.eventsFired ??= {});
  fired[kind] = (fired[kind] ?? 0) + 1;
  const ev: ActiveEvent = { kind, slot: at.slot, start: at.start, end: at.end };
  if (kind === 'raid') {
    ev.site =
      sitesWithSpots[Math.floor(hash01(state.seed, 0, 1400, at.slot) * sitesWithSpots.length)]!;
    ev.parties = formParties(state, at.slot, at.start);
    sendRaiders(state, ev, 'hearthford.gate_n', 'social');
  }
  w.active.push(ev);
  emit(state.events, { type: 'worldEventStarted', kind, slot: at.slot, site: ev.site ?? '' });
}

/** Resumes an event whose slot already fired but is still running (after a load): no refire. */
function resume(
  state: SimState,
  kind: EventKind,
  at: { slot: number; start: number; end: number },
): void {
  const w = evOf(state);
  if (w.active.some((a) => a.kind === kind && a.slot === at.slot)) return;
  const ev: ActiveEvent = { kind, slot: at.slot, start: at.start, end: at.end, walked: true };
  if (kind === 'raid') {
    ev.site =
      sitesWithSpots[Math.floor(hash01(state.seed, 0, 1400, at.slot) * sitesWithSpots.length)]!;
    // The same parties as before the load, back at the muster or out at the fight (POW-M6-23).
    ev.parties = formParties(state, at.slot, at.start);
    const minute = state.clock ? localMinute(state.clock.nowMs, state.clock.tzOffsetMin) : at.start;
    ev.walked = minute >= at.start + RAID.musterMin;
    if (ev.walked) sendRaiders(state, ev, ev.site, 'fight');
    else sendRaiders(state, ev, 'hearthford.gate_n', 'social');
  }
  w.active.push(ev);
}

function end(state: SimState, ev: ActiveEvent): void {
  const w = evOf(state);
  w.active.splice(w.active.indexOf(ev), 1);
  if (ev.kind === 'raid') {
    if (!ev.won) {
      // Not there to see it: the Travelers bring it down or not, by the roll.
      const won = ev.boss === undefined && hash01(state.seed, 0, 1500, ev.slot) < RAID.abstractWin;
      emit(state.events, { type: 'raidEnded', site: ev.site ?? '', won });
      // The boss goes back where it came from, unbeaten.
      if (ev.boss !== undefined && state.entities.alive[ev.boss]) {
        const ai = state.entities.comps.ai[ev.boss];
        if (ai?.ev === 'raid') destroy(state.entities, ev.boss);
      }
    }
    // The raiders go back to their own evening.
    const crowd = state.crowd;
    const gate = PLACE_LIST.indexOf('hearthford.gate_n');
    for (const p of ev.parties ?? [])
      for (const s of p) {
        const d = crowd?.doing[s];
        if (crowd && d && (d.thing === RAID.boss || d.place === gate)) crowd.doing[s] = null;
      }
  }
  emit(state.events, { type: 'worldEventEnded', kind: ev.kind, slot: ev.slot });
}

/**
 * The scheduler. Once a tick: fires a slot when its time comes (once), announces one shortly before,
 * keeps the running events going and ends them on time. Needs the clock (trusted time); without it
 * nothing happens.
 */
export function worldEventsSystem(state: SimState): void {
  const c = state.clock;
  if (!c) return;
  const w = evOf(state);
  const m = localMinute(c.nowMs, c.tzOffsetMin);
  if (m !== w.minute) {
    w.minute = m;
    for (const kind of EVENT_KINDS) {
      const s = SCHEDULES[kind];
      const at = slotAt(state.seed, kind, m);
      if (!s || !at) continue;
      const last = state.calendar.last[kind] ?? -1;
      if (m >= at.start && m < at.end) {
        if (at.slot > last) fire(state, kind, at);
        else if (at.slot === last) resume(state, kind, at);
      }
      // The next one, announced in the System channel shortly before.
      const next = at.start + s.period;
      const key = `${kind}:${at.slot + 1}`;
      if (next - m <= s.announce && next > m && !w.announced.has(key)) {
        w.announced.add(key);
        emit(state.events, { type: 'worldEventSoon', kind, inMin: next - m });
      }
    }
  }
  for (const ev of [...w.active]) {
    if (m >= ev.end) {
      end(state, ev);
      continue;
    }
    if (ev.kind === 'raid') raidTick(state, ev, m);
    else if (ev.kind === 'invasion') invasionTick(state, ev, m);
  }
  state.marketDay = eventOn(state, 'market');
}
