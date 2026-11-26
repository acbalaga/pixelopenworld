import { PARTY } from '../content/balance/party';
import { MOVEMENT } from '../content/balance/movement';
import { ABSTRACT_TICKS, FIGHT_AREAS } from '../content/balance/travelers';
import { ATTACKS, WEAPONS } from '../content/combat/attacks';
import { CREATURES } from '../content/creatures';
import { DUNGEON_NAMES } from '../content/chat/names';
import { ITEMS } from '../content/items';
import { RECIPES } from '../content/items/recipes';
import { TRIALS } from '../content/skills';
import { DUNGEONS } from '../content/world/dungeons';
import { ACTIVITIES } from '../content/travelers/types';
import { findAvatar } from '../shared/summary';
import { applyFighterCommand, startComboStep } from './combat/commands';
import { getComp, query, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { px, SUBPX, type Direction } from './kernel/fixed';
import { int, next } from './kernel/rng';
import { rollDrops } from './items';
import type { SimState } from './state';
import { nudge } from './systems/movement';
import { hash01 } from './travelers/dice';
import { identitiesOf } from './travelers/generate';
import { SKILL_LIST } from './travelers/lists';
import { dayIndexOf, localMinute, MIN_PER_DAY } from './travelers/schedule';
import { remember, tierNow } from './travelers/social';
import type { TravelerIdentity } from './travelers/types';

/**
 * Parties (POW-M5-07, design/07 Parties, design/04 Companions in combat). Up to three Travelers run
 * content with the player. A party is session only: it lives on `state.party`, is never saved, and
 * a party in progress when the game closes is simply gone on the next load.
 *
 * - The party finder lists open groups from real Traveler state (`travelerListings`): an online
 *   Traveler who wants a group this hour and is not busy. The player can join one, or post a
 *   listing of their own, which suited Travelers answer over a few in-game minutes by who is
 *   online, their tier, regard and how long their session still runs.
 * - Members stay promoted entities and follow the player, through portals too. In a fight they
 *   take a role (Vanguard, Striker, Support), follow the player's target lock, and are as good as
 *   their build: reaction, dodging, standing spot and swing cadence all come from their rank.
 *   A member who falls is downed, not gone, and gets up when the fight is over.
 * - Loot: the player's drops are exactly the solo drops (the creature's own table, the loot
 *   stream). The Travelers' shares are rolled on the travelers stream into their stock, and the
 *   notable ones are rolled need or pass where everyone can see. Nothing of theirs reaches the
 *   player's state.
 * - Departure: a member whose session is ending says so ten in-game minutes ahead, and leaves at
 *   the end of the fight in progress. The crowd's logout waits on `partyHoldsOnline`, so a member
 *   never logs out without the notice first.
 */

export type Role = 'vanguard' | 'striker' | 'support';
export type ActivityKind = 'dungeon' | 'area' | 'trial';

/** Something a party can be for. */
export interface PartyActivity {
  id: string;
  kind: ActivityKind;
  /** Creature tier it is for, 1 to 8. */
  tier: number;
}

export interface Member {
  slot: number;
  role: Role;
  /** Tick they joined. */
  joined: number;
  /** In-game minute they gave notice, or -1. */
  warned: number;
  /** Tick they went down, or -1 while standing. */
  downed: number;
  /** The wind-up being read: the tick the foe's attack began, when the member notices it, and the plan. */
  seen: number;
  reactAt: number;
  plan: 'dodge' | 'stand' | 'none';
  /** Tick the next swing may start. */
  nextSwing: number;
  /** Support: tick of the next mend. */
  nextHeal: number;
  /** Away from keyboard until this tick ("brb"). */
  brbUntil: number;
  /** Damage dealt and taken, and hits taken, while in the party. For the scenario and the tests. */
  dealt: number;
  taken: number;
  hitsTaken: number;
}

export interface Listing {
  activity: string;
  /** In-game minute it was posted. */
  posted: number;
}

export interface Party {
  activity: string | null;
  members: Member[];
  /** The player's own listing on the board, or null. */
  listing: Listing | null;
  lastMinute: number;
  /** Fight state: on now, and the tick the last one was on. */
  fighting: boolean;
  lastFight: number;
}

/** A group on the board: a Traveler wanting a party, and anyone running with them. */
export interface TravelerListing {
  leader: number;
  activity: string;
  slots: number[];
}

// ---- Activities ----

const creatureTier = (id: string): number => CREATURES[id]?.tier ?? 1;

/** Everything a party can be for, in a stable order: dungeons, creature areas, Trials. */
export const PARTY_ACTIVITIES: readonly PartyActivity[] = (() => {
  const out: PartyActivity[] = [];
  for (const id of Object.keys(DUNGEON_NAMES))
    if (DUNGEONS[id]) out.push({ id, kind: 'dungeon', tier: PARTY.dungeonTier[id] ?? 1 });
  const seen = new Set<string>();
  for (const a of FIGHT_AREAS) {
    if (seen.has(a.creature) || !CREATURES[a.creature]) continue;
    seen.add(a.creature);
    out.push({ id: a.creature, kind: 'area', tier: creatureTier(a.creature) });
  }
  for (const t of Object.values(TRIALS)) {
    const o = t.objective as { kind: string; creature?: string };
    if (o.kind === 'defeat' && o.creature && CREATURES[o.creature])
      out.push({ id: t.id, kind: 'trial', tier: creatureTier(o.creature) });
  }
  return out;
})();
const ACTIVITY_BY_ID = new Map(PARTY_ACTIVITIES.map((a) => [a.id, a]));
export const activityOf = (id: string): PartyActivity | undefined => ACTIVITY_BY_ID.get(id);

// ---- Who and how good ----

const FAMILY_SKILL: Readonly<Record<string, string>> = {
  blades: 'skill.blades',
  polearms: 'skill.polearms',
  heavy: 'skill.heavy_arms',
  archery: 'skill.archery',
  unarmed: 'skill.unarmed',
};

const ARMS = [
  'skill.blades',
  'skill.heavy_arms',
  'skill.polearms',
  'skill.archery',
  'skill.unarmed',
  'skill.shieldcraft',
  'skill.evasion',
  'skill.ember',
  'skill.tide',
  'skill.gale',
  'skill.stone',
  'skill.mending',
  'skill.hexing',
].map((s) => SKILL_LIST.indexOf(s));

/** A Traveler's fighting rank: their best arms or magic skill, in points. */
export function rankOf(state: SimState, slot: number): number {
  let top = 0;
  for (const [s, p] of state.travelers[slot]!.build) if (ARMS.includes(s)) top = Math.max(top, p);
  return top;
}

/** A Traveler's tier, 1 to 8, from their best skill. */
export function tierOfSlot(state: SimState, slot: number): number {
  let top = 0;
  for (const [, p] of state.travelers[slot]!.build) top = Math.max(top, p);
  return 1 + Math.floor(top / 20);
}

/** The role a Traveler takes, from what they train: a shield or a maul leads, mending supports. */
export function roleOf(state: SimState, slot: number): Role {
  const t = identitiesOf(state.seed)[slot]!;
  const pts = (id: string): number =>
    state.travelers[slot]!.build.find(([s]) => s === SKILL_LIST.indexOf(id))?.[1] ?? -1;
  const has = (id: string): boolean => t.focus.includes(id) || pts(id) > 0;
  if (has('skill.mending') && pts('skill.mending') >= Math.max(0, pts('skill.blades')))
    return 'support';
  if (has('skill.shieldcraft') || has('skill.heavy_arms')) return 'vanguard';
  return 'striker';
}

const lerp = (k: { low: number; high: number }, rank: number): number => {
  const f = Math.min(1, Math.max(0, rank / PARTY.rankFull));
  return k.low + (k.high - k.low) * f;
};

/** What a member's rank makes of them in a fight. */
export function competence(rank: number): {
  reactionTicks: number;
  dodge: number;
  standIn: number;
  positionPx: number;
  swingGapTicks: number;
} {
  const C = PARTY.competence;
  return {
    reactionTicks: Math.round(lerp(C.reactionTicks, rank)),
    dodge: lerp(C.dodge, rank),
    standIn: lerp(C.standIn, rank),
    positionPx: lerp(C.positionPx, rank),
    swingGapTicks: Math.round(lerp(C.swingGapTicks, rank)),
  };
}

// ---- The party ----

export const partyOf = (state: SimState): Party | undefined => state.party;

function ensureParty(state: SimState): Party {
  return (state.party ??= {
    activity: null,
    members: [],
    listing: null,
    lastMinute: -1,
    fighting: false,
    lastFight: -1e9,
  });
}

export const memberOf = (state: SimState, slot: number): Member | undefined =>
  state.party?.members.find((m) => m.slot === slot);

/** True if this entity is a party member's. */
export function isPartyEnt(state: SimState, id: EntityId): boolean {
  const crowd = state.crowd;
  const p = state.party;
  if (!crowd || !p || p.members.length === 0) return false;
  const ent = crowd.ents.get(id);
  return !!ent && p.members.some((m) => m.slot === ent.slot);
}

const entOf = (state: SimState, slot: number): EntityId => state.crowd?.entOf[slot] ?? -1;

/** The local minute now, with its fraction, and the real day. */
function localNow(state: SimState): { day: number; m: number; whole: number } {
  const c = state.clock!;
  const whole = localMinute(c.nowMs, c.tzOffsetMin);
  const frac = (c.nowMs + c.tzOffsetMin * 60_000) / 60_000;
  const day = dayIndexOf(whole);
  return { day, m: frac - day * MIN_PER_DAY, whole };
}

/** Real minutes left in a Traveler's current session, or 0 if they are not in one. */
export function sessionLeft(state: SimState, slot: number): number {
  const crowd = state.crowd;
  if (!crowd || !state.clock) return 0;
  const { m } = localNow(state);
  for (const s of crowd.today[slot] ?? []) if (m >= s.start && m < s.end) return s.end - m;
  for (const s of crowd.yesterday[slot] ?? [])
    if (s.end > MIN_PER_DAY && m + MIN_PER_DAY >= s.start && m + MIN_PER_DAY < s.end)
      return s.end - (m + MIN_PER_DAY);
  return 0;
}

/** The notice a member gives, as real minutes: ten in-game minutes of world clock. */
export const WARN_REAL_MIN = (PARTY.departWarnMinutes * ABSTRACT_TICKS) / 30 / 60;

const lfgMinded = (t: TravelerIdentity): boolean =>
  t.archetype !== 'Casual' && t.archetype !== 'Socializer';

/** Free to group: online, not in a party, not busy, with time left in the session. */
function free(state: SimState, slot: number): boolean {
  const crowd = state.crowd!;
  if (crowd.online[slot] !== 1 || memberOf(state, slot)) return false;
  if (state.duel?.slot === slot) return false;
  const d = crowd.doing[slot];
  if (d && PARTY.busy.includes(d.kind)) return false;
  return sessionLeft(state, slot) >= PARTY.sessionLeftMin;
}

/** The activity a Traveler wants a group for this real hour, or null. Deterministic. */
export function lfgOf(state: SimState, slot: number): string | null {
  const crowd = state.crowd;
  if (!crowd || !state.clock || !free(state, slot)) return null;
  const t = identitiesOf(state.seed)[slot]!;
  if (!lfgMinded(t)) return null;
  const hour = Math.floor(localNow(state).whole / 60);
  if (hash01(state.seed, slot, 707, hour) >= PARTY.listingChance) return null;
  const tier = tierOfSlot(state, slot);
  const fit = PARTY_ACTIVITIES.filter((a) => a.tier <= tier + PARTY.tierSlack);
  if (fit.length === 0) return null;
  return fit[Math.floor(hash01(state.seed, slot, 708, hour) * fit.length)]!.id;
}

/** The open groups on the party finder, from real Traveler state, steadiest first. */
export function travelerListings(state: SimState): TravelerListing[] {
  const crowd = state.crowd;
  if (!crowd || !state.clock) return [];
  const ids = identitiesOf(state.seed);
  const out: TravelerListing[] = [];
  const taken = new Set<number>();
  for (const t of ids) {
    if (out.length >= PARTY.boardMax) break;
    if (taken.has(t.slot)) continue;
    const activity = lfgOf(state, t.slot);
    if (!activity) continue;
    // A friend or a guildmate who is online and free runs with them.
    const life = state.travelers[t.slot]!;
    const mate = ids.find(
      (o) =>
        o.slot !== t.slot &&
        !taken.has(o.slot) &&
        (t.ties.some((x) => x.slot === o.slot) ||
          (life.guild !== 0 && state.travelers[o.slot]!.guild === life.guild)) &&
        free(state, o.slot),
    );
    const slots =
      mate && hash01(state.seed, t.slot, 709, crowd.day) < 0.5 ? [t.slot, mate.slot] : [t.slot];
    for (const s of slots) taken.add(s);
    out.push({ leader: t.slot, activity, slots });
  }
  return out;
}

/** Adds a Traveler to the party. For the board, the listing answers, the dev tools and the tests. */
export function addMember(state: SimState, slot: number, activity: string | null): boolean {
  const p = ensureParty(state);
  const crowd = state.crowd;
  if (!crowd || p.members.length >= PARTY.max || memberOf(state, slot)) return false;
  if (crowd.online[slot] !== 1) return false;
  const life = state.travelers[slot]!;
  p.members.push({
    slot,
    role: roleOf(state, slot),
    joined: state.tick,
    warned: -1,
    downed: -1,
    seen: -1,
    reactAt: 0,
    plan: 'none',
    nextSwing: 0,
    nextHeal: state.tick + 60,
    brbUntil: 0,
    dealt: 0,
    taken: 0,
    hitsTaken: 0,
  });
  if (p.activity === null) p.activity = activity;
  crowd.doing[slot] = {
    kind: 'party',
    place: life.place,
    left: 1e9,
    eta: 0,
    from: life.place,
    total: 0,
    skill: -1,
    thing: activity ?? '',
  };
  life.activity = ACTIVITIES.indexOf('party');
  if (state.clock) {
    const { day, whole } = localNow(state);
    const act = activity ? PARTY_ACTIVITIES.findIndex((a) => a.id === activity) : 0;
    remember(life, 'partied', Math.max(0, act), day, whole);
  }
  emit(state.events, { type: 'partyJoined', slot, activity: activity ?? '' });
  return true;
}

/** Takes a member out: up on their feet, back to the crowd. */
function removeMember(state: SimState, slot: number, why: 'session' | 'player' | 'full'): void {
  const p = state.party;
  if (!p) return;
  const i = p.members.findIndex((m) => m.slot === slot);
  if (i < 0) return;
  p.members.splice(i, 1);
  const id = entOf(state, slot);
  const f = id >= 0 ? getComp(state.entities, id, 'fighter') : undefined;
  if (f && f.state === 'dead') standUp(state, id);
  const crowd = state.crowd;
  if (crowd && crowd.doing[slot]?.kind === 'party') crowd.doing[slot] = null;
  emit(state.events, { type: 'partyLeft', slot, why });
  if (p.members.length === 0) p.activity = p.listing ? p.listing.activity : null;
}

/** Joins a Traveler's group from the board. */
export function joinListing(state: SimState, leader: number): boolean {
  const l = travelerListings(state).find((x) => x.leader === leader);
  if (!l) return false;
  const room = PARTY.max - (state.party?.members.length ?? 0);
  if (room < l.slots.length) return false;
  for (const s of l.slots) addMember(state, s, l.activity);
  if (state.party) state.party.listing = null;
  return true;
}

/** Posts the player's own listing. */
export function postListing(state: SimState, activity: string): boolean {
  if (!activityOf(activity) || !state.crowd) return false;
  const p = ensureParty(state);
  if (p.members.length >= PARTY.max) return false;
  p.listing = { activity, posted: state.crowd.lastMinute };
  p.activity ??= activity;
  emit(state.events, { type: 'partyPosted', activity });
  return true;
}

/** The player leaves the party: everyone goes their own way. */
export function leaveParty(state: SimState): void {
  const p = state.party;
  if (!p) return;
  for (const m of [...p.members]) removeMember(state, m.slot, 'player');
  p.listing = null;
  p.activity = null;
}

/** A party command from the board or the party frames. */
export function partyCommand(
  state: SimState,
  c: { op: 'post' | 'join' | 'leave' | 'cancel'; activity?: string; slot?: number },
): void {
  if (!state.crowd || !state.clock) return;
  if (c.op === 'post' && c.activity) postListing(state, c.activity);
  else if (c.op === 'join' && c.slot !== undefined) joinListing(state, c.slot);
  else if (c.op === 'leave') leaveParty(state);
  else if (c.op === 'cancel' && state.party) state.party.listing = null;
}

// ---- Answers and departures, once per in-game minute ----

function answerListing(state: SimState, p: Party): void {
  const l = p.listing;
  if (!l) return;
  const minute = state.crowd!.lastMinute;
  if (minute - l.posted > PARTY.listingMinutes || p.members.length >= PARTY.max) {
    p.listing = null;
    if (p.members.length === 0) p.activity = null;
    return;
  }
  const act = activityOf(l.activity);
  if (!act) return;
  const { whole } = localNow(state);
  const roles = new Set(p.members.map((m) => m.role));
  const r = state.rng.travelers;
  for (const t of identitiesOf(state.seed)) {
    if (p.members.length >= PARTY.max) break;
    if (!free(state, t.slot)) continue;
    if (tierOfSlot(state, t.slot) + PARTY.tierSlack < act.tier) continue;
    const regard = tierNow(state.travelers[t.slot]!, whole);
    const want = roles.has(roleOf(state, t.slot)) ? 1 : 1.4;
    const odds = PARTY.answerChance * (PARTY.regardFactor[regard] ?? 1) * want;
    if (next(r) >= odds) continue;
    if (addMember(state, t.slot, l.activity)) {
      roles.add(roleOf(state, t.slot));
      emit(state.events, { type: 'partyAnswered', slot: t.slot, activity: l.activity });
    }
  }
  if (p.members.length >= PARTY.max) p.listing = null;
}

function warn(state: SimState, m: Member): void {
  m.warned = state.crowd!.lastMinute;
  emit(state.events, { type: 'partyWarned', slot: m.slot });
}

/**
 * Called by the crowd when a member's session has ended. A member who has not given notice gives
 * it now. One who has stays until the notice has run and the fight in progress is over, then leaves
 * the party, and the crowd logs them out. True while they stay.
 */
export function partyHoldsOnline(state: SimState, slot: number): boolean {
  const m = memberOf(state, slot);
  if (!m) return false;
  if (m.warned < 0) {
    warn(state, m);
    return true;
  }
  const since = state.crowd!.lastMinute - m.warned;
  if (since < PARTY.departWarnMinutes || state.party!.fighting) return true;
  removeMember(state, slot, 'session');
  return false;
}

function minuteStep(state: SimState, p: Party): void {
  answerListing(state, p);
  for (const m of [...p.members]) {
    if (m.warned < 0 && sessionLeft(state, m.slot) <= WARN_REAL_MIN) warn(state, m);
    else if (
      m.warned >= 0 &&
      state.crowd!.lastMinute - m.warned >= PARTY.departWarnMinutes &&
      !p.fighting
    ) {
      // The notice has run and nothing is being fought: they go.
      removeMember(state, m.slot, 'session');
      continue;
    }
    if (
      !p.fighting &&
      m.brbUntil < state.tick &&
      hash01(state.seed, m.slot, 711, state.crowd!.lastMinute) < PARTY.brbChance
    ) {
      m.brbUntil = state.tick + PARTY.brbTicks;
      emit(state.events, { type: 'partyBrb', slot: m.slot });
    }
  }
}

// ---- Fights, downs, loot ----

function partyIds(state: SimState): Set<EntityId> {
  const out = new Set<EntityId>();
  const me = findAvatar(state);
  if (me !== null) out.add(me);
  for (const m of state.party?.members ?? []) {
    const id = entOf(state, m.slot);
    if (id >= 0) out.add(id);
  }
  return out;
}

const hostile = (state: SimState, id: EntityId): boolean => {
  const f = state.entities.comps.fighter[id];
  return (
    !!f &&
    f.team === 1 &&
    f.state !== 'dead' &&
    !!state.entities.alive[id] &&
    !state.crowd?.ents.has(id)
  );
};

const posPx = (state: SimState, id: EntityId): { x: number; y: number } | null => {
  const p = state.entities.comps.pos[id];
  return p ? { x: p.x / SUBPX, y: p.y / SUBPX } : null;
};

/** Is a fight on: a creature after one of the party, or close to the player and roused. */
function fightOn(state: SimState): boolean {
  const ids = partyIds(state);
  const me = findAvatar(state);
  const mp = me === null ? null : posPx(state, me);
  for (const id of query(state.entities, 'ai', 'fighter', 'pos')) {
    if (!hostile(state, id)) continue;
    const ai = state.entities.comps.ai[id]!;
    if (ai.target !== null && ids.has(ai.target)) return true;
    const p = posPx(state, id)!;
    if (mp && ai.provoked && Math.hypot(p.x - mp.x, p.y - mp.y) <= PARTY.fightPx) return true;
  }
  return false;
}

function standUp(state: SimState, id: EntityId): void {
  const f = getComp(state.entities, id, 'fighter');
  const pools = getComp(state.entities, id, 'pools');
  if (!f || !pools) return;
  f.state = 'idle';
  f.t = 0;
  f.deadT = 0;
  f.atk = null;
  f.invuln = 0;
  pools.hp = Math.max(1, Math.round((pools.hpMax * PARTY.revivePct) / 100));
}

/** Does this member use the item: gear for their arms, or an input to a craft they train. */
function needs(state: SimState, slot: number, item: string): boolean {
  const t = identitiesOf(state.seed)[slot]!;
  const def = ITEMS[item];
  if (!def) return false;
  const eq = def.equip;
  if (eq?.weapon) {
    const skill = FAMILY_SKILL[WEAPONS[eq.weapon]?.family ?? ''];
    return skill !== undefined && t.focus.includes(skill);
  }
  if (eq) return roleOf(state, slot) === 'vanguard';
  return Object.values(RECIPES).some(
    (rc) => t.focus.includes(`skill.${rc.craft}`) && rc.ingredients.some((i) => i.item === item),
  );
}

/** The Travelers' shares of a creature the party brought down: rolled into their stock. */
function shareLoot(state: SimState, creature: EntityId, kind: string): void {
  const p = state.party!;
  const crowd = state.crowd!;
  const def = CREATURES[kind];
  const at = posPx(state, creature);
  if (!def || !at) return;
  const near = p.members.filter((m) => {
    const q = posPx(state, entOf(state, m.slot));
    return q && Math.hypot(q.x - at.x, q.y - at.y) <= PARTY.lootPx;
  });
  if (near.length === 0) return;
  const r = state.rng.travelers;
  for (const d of rollDrops(r, def.drops)) {
    if (d.item === 'item.coin') {
      const each = Math.floor(d.qty / near.length);
      for (const m of near) state.travelers[m.slot]!.coin += each;
      continue;
    }
    const chance = def.drops.find((x) => x.item === d.item)?.chance ?? 100;
    const rolls = near.map((m) => {
      const need = needs(state, m.slot, d.item);
      return { slot: m.slot, need, roll: need ? int(r, 1, PARTY.rollMax) : 0 };
    });
    let winner = -1;
    let best = 0;
    for (const x of rolls)
      if (x.need && x.roll > best) {
        best = x.roll;
        winner = x.slot;
      }
    // Nobody needs it: it goes to whoever was nearest, as a player would take it to sell.
    if (winner < 0) winner = near[0]!.slot;
    const stock = crowd.stock[winner]!;
    stock[d.item] = (stock[d.item] ?? 0) + d.qty;
    if (chance <= PARTY.rollShowPct)
      emit(state.events, {
        type: 'partyLootRoll',
        item: d.item,
        qty: d.qty,
        rolls,
        winner,
        rare: chance <= 5,
      });
  }
}

/**
 * Runs once a tick, after the crowd. Keeps the fight state, gets downed members up after a fight,
 * shares the Travelers' loot, counts what the members dealt and took, and once a minute answers the
 * player's listing and gives departure notice.
 */
export function partySystem(state: SimState): void {
  const p = state.party;
  const crowd = state.crowd;
  if (!p || !crowd || !state.clock) return;
  // Anyone gone offline without the crowd noticing, or whose entity is gone, is out.
  for (const m of [...p.members])
    if (crowd.online[m.slot] !== 1) removeMember(state, m.slot, 'session');
  if (crowd.lastMinute !== p.lastMinute) {
    p.lastMinute = crowd.lastMinute;
    minuteStep(state, p);
  }
  if (p.members.length === 0) return;
  const was = p.fighting;
  p.fighting = fightOn(state);
  if (p.fighting) p.lastFight = state.tick;
  const me = findAvatar(state);
  const byEnt = new Map<EntityId, Member>();
  for (const m of p.members) {
    const id = entOf(state, m.slot);
    if (id >= 0) byEnt.set(id, m);
  }
  let allDown = byEnt.size > 0;
  for (const [id, m] of byEnt) {
    const f = state.entities.comps.fighter[id];
    if (!f) continue;
    if (f.state === 'dead') {
      if (m.downed < 0) {
        m.downed = state.tick;
        emit(state.events, { type: 'partyDowned', slot: m.slot });
      }
    } else allDown = false;
  }
  for (const e of state.events.list) {
    if (e.type === 'damageDealt') {
      const src = byEnt.get(e.src);
      if (src) src.dealt += e.amount;
      const dst = byEnt.get(e.dst);
      if (dst && !byEnt.has(e.src) && e.src !== me) {
        dst.taken += e.amount;
        dst.hitsTaken++;
      }
    } else if (e.type === 'died' && e.team === 0 && e.id === me && allDown)
      emit(state.events, { type: 'partyWipe' });
    else if (e.type === 'killed') {
      const ids = partyIds(state);
      if (ids.has(e.src)) shareLoot(state, e.dst, e.kind);
    }
  }
  // After the fight, the downed get up.
  if (!p.fighting && state.tick - p.lastFight >= PARTY.reviveTicks) {
    for (const [id, m] of byEnt) {
      if (m.downed < 0) continue;
      standUp(state, id);
      m.downed = -1;
      emit(state.events, { type: 'partyRevived', slot: m.slot });
    }
  }
  if (was && !p.fighting) emit(state.events, { type: 'partyFightOver' });
}

// ---- Members in the world ----

const cardinal = (dx: number, dy: number, keep: 0 | 2 | 4 | 6): 0 | 2 | 4 | 6 =>
  dx === 0 && dy === 0 ? keep : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 6) : dy > 0 ? 4 : 0;

/** The target a member fights: the player's lock, or what is after the party. */
function targetFor(state: SimState, me: EntityId, ids: Set<EntityId>): EntityId | null {
  const lock = state.entities.comps.fighter[me]?.lock ?? null;
  if (lock !== null && hostile(state, lock)) return lock;
  const mp = posPx(state, me);
  if (!mp) return null;
  let best: EntityId | null = null;
  let bestD = PARTY.fightPx * 1.5;
  for (const id of query(state.entities, 'ai', 'fighter', 'pos')) {
    if (!hostile(state, id)) continue;
    const ai = state.entities.comps.ai[id]!;
    const q = posPx(state, id)!;
    const d = Math.hypot(q.x - mp.x, q.y - mp.y);
    const after = ai.target !== null && ids.has(ai.target);
    if ((after || (ai.provoked && d <= PARTY.fightPx)) && d < bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

function stepToward(
  state: SimState,
  id: EntityId,
  ent: { face: 0 | 2 | 4 | 6; mode: string },
  gx: number,
  gy: number,
  run: boolean,
): boolean {
  const q = posPx(state, id)!;
  const dx = gx - q.x;
  const dy = gy - q.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= 2) return true;
  const speed = run
    ? Math.round((MOVEMENT.walkSpeed * MOVEMENT.sprintFactor256) / 256)
    : MOVEMENT.walkSpeed;
  const step = Math.min(speed, dist * SUBPX);
  nudge(state, id, Math.round((dx / dist) * step), Math.round((dy / dist) * step));
  ent.face = cardinal(dx, dy, ent.face);
  ent.mode = 'walk';
  return false;
}

/** A member's standing spot: by role around the player or the target, and off by their skill. */
function spotFor(
  state: SimState,
  m: Member,
  me: { x: number; y: number },
  face: Direction,
  target: { x: number; y: number } | null,
  reach: number,
): { x: number; y: number } {
  const rank = rankOf(state, m.slot);
  const err = competence(rank).positionPx;
  const n = state.tick >> 6;
  const ex = (hash01(state.seed, m.slot, 721, n) * 2 - 1) * err;
  const ey = (hash01(state.seed, m.slot, 722, n) * 2 - 1) * err;
  if (!target) {
    // Behind the player, by where they face.
    const o = PARTY.formation[m.role];
    const back =
      face === 0
        ? { x: 0, y: 1 }
        : face === 4
          ? { x: 0, y: -1 }
          : face === 2
            ? { x: -1, y: 0 }
            : { x: 1, y: 0 };
    const side = { x: -back.y, y: back.x };
    const along = Math.abs(o.y) + PARTY.followPx * 0.5;
    return {
      x: me.x + back.x * along + side.x * o.x + ex * 0.3,
      y: me.y + back.y * along + side.y * o.x + ey * 0.3,
    };
  }
  const vx = me.x - target.x;
  const vy = me.y - target.y;
  const l = Math.hypot(vx, vy) || 1;
  const ux = vx / l;
  const uy = vy / l;
  if (m.role === 'support')
    return {
      x: me.x + ux * PARTY.support.standOffPx + ex,
      y: me.y + uy * PARTY.support.standOffPx + ey,
    };
  if (m.role === 'vanguard')
    return { x: target.x + ux * (reach - 2) + ex, y: target.y + uy * (reach - 2) + ey };
  const sgn = m.slot % 2 === 0 ? 1 : -1;
  return {
    x: target.x - uy * sgn * (reach - 2) + ux * PARTY.flankPx * 0.3 + ex,
    y: target.y + ux * sgn * (reach - 2) + uy * PARTY.flankPx * 0.3 + ey,
  };
}

/** A foe's swing: the tick it began, and whether its shape can reach a point now. */
function threat(
  state: SimState,
  foe: EntityId,
  at: { x: number; y: number },
): { start: number; left: number } | null {
  const f = state.entities.comps.fighter[foe];
  if (!f || f.state !== 'attack' || !f.atk) return null;
  const def = ATTACKS[f.atk];
  if (!def || f.t >= def.windup) return null;
  const fp = posPx(state, foe)!;
  const shape = def.shape as { reach?: number; radius?: number };
  const reach = (shape.reach ?? shape.radius ?? 24) + 14;
  if (Math.hypot(fp.x - at.x, fp.y - at.y) > reach) return null;
  return { start: state.tick - f.t, left: def.windup - f.t };
}

/**
 * One tick of a member's entity. Called by the entity layer for party members instead of their
 * usual behavior. Returns true when it handled the entity.
 */
export function partyEntTick(
  state: SimState,
  id: EntityId,
  ent: { slot: number; face: 0 | 2 | 4 | 6; mode: string; emote: unknown; still: number },
): boolean {
  const m = memberOf(state, ent.slot);
  if (!m) return false;
  const me = findAvatar(state);
  const f = state.entities.comps.fighter[id];
  const mp = me === null ? null : posPx(state, me);
  const here = posPx(state, id);
  if (!f || !mp || !here || me === null) return true;
  ent.emote = null;
  if (f.state === 'dead') {
    ent.mode = 'idle';
    // Left behind while down (the player went through a portal or fell): up and with them.
    if (!state.party!.fighting && Math.hypot(here.x - mp.x, here.y - mp.y) > PARTY.catchUpPx) {
      standUp(state, id);
      m.downed = -1;
      emit(state.events, { type: 'partyRevived', slot: m.slot });
    }
    return true;
  }
  if (Math.hypot(here.x - mp.x, here.y - mp.y) > PARTY.catchUpPx) {
    // Through a portal or a Waystone: they come along.
    const pos = state.entities.comps.pos[id]!;
    const a = state.entities.comps.avatar[me]!;
    const back = a.facing === 0 ? 1 : a.facing === 4 ? -1 : 0;
    pos.x = px(mp.x - (a.facing === 2 ? 12 : a.facing === 6 ? -12 : 0) + (m.slot % 3) * 6 - 6);
    pos.y = px(mp.y + back * 12);
    ent.mode = 'stand';
    return true;
  }
  if (f.state !== 'idle') {
    ent.mode = f.state === 'attack' ? 'fight' : 'idle';
    return true;
  }
  if (m.brbUntil > state.tick && !state.party!.fighting) {
    ent.mode = 'stand';
    ent.still++;
    return true;
  }
  const rank = rankOf(state, m.slot);
  const k = competence(rank);
  const ids = partyIds(state);
  const target = targetFor(state, me, ids);
  const tp = target === null ? null : posPx(state, target);
  const cb = state.entities.comps.combatant[id];
  const reach = (WEAPONS[cb?.weapon ?? '']?.reach ?? 20) - 4;
  // Read the wind-up of the foe nearest to us.
  if (target !== null) {
    const th = threat(state, target, here);
    if (th) {
      if (m.seen !== th.start) {
        m.seen = th.start;
        m.reactAt = th.start + k.reactionTicks;
        const roll = hash01(state.seed, m.slot, 731, th.start);
        m.plan =
          roll < k.standIn
            ? 'stand'
            : hash01(state.seed, m.slot, 732, th.start) < k.dodge
              ? 'dodge'
              : 'none';
      }
      if (m.plan === 'dodge' && state.tick >= m.reactAt) {
        m.plan = 'none';
        const dx = here.x - tp!.x;
        const dy = here.y - tp!.y;
        // Sideways to the line of the blow.
        const side = Math.abs(dx) > Math.abs(dy) ? (dy >= 0 ? 4 : 0) : dx >= 0 ? 2 : 6;
        applyFighterCommand(state, id, { type: 'dodge', dir: side as Direction });
        ent.mode = 'walk';
        return true;
      }
    }
  }
  // Support mends the most hurt.
  if (m.role === 'support' && state.tick >= m.nextHeal) {
    let worst: EntityId | null = null;
    let low: number = PARTY.support.belowPct;
    for (const a of ids) {
      const pl = state.entities.comps.pools[a];
      const fa = state.entities.comps.fighter[a];
      if (!pl || !fa || fa.state === 'dead') continue;
      const pct = (pl.hp * 100) / pl.hpMax;
      if (pct < low) {
        low = pct;
        worst = a;
      }
    }
    if (worst !== null) {
      const pl = state.entities.comps.pools[worst]!;
      const amount = Math.min(
        pl.hpMax - pl.hp,
        Math.max(1, Math.round((pl.hpMax * lerp(PARTY.support.healPct, rank)) / 100)),
      );
      pl.hp += amount;
      m.nextHeal = state.tick + Math.round(lerp(PARTY.support.healTicks, rank));
      emit(state.events, { type: 'healed', id: worst, src: id, amount, tag: 'party' });
    }
  }
  const a = state.entities.comps.avatar[me]!;
  const spot = spotFor(state, m, mp, a.facing, tp, reach);
  const far = Math.hypot(spot.x - here.x, spot.y - here.y);
  if (tp) {
    const d = Math.hypot(tp.x - here.x, tp.y - here.y);
    const inReach = d <= reach;
    if (inReach && m.role !== 'support' && state.tick >= m.nextSwing) {
      f.lock = target;
      f.aim = { x: tp.x - here.x || 0, y: tp.y - here.y || 1 };
      ent.face = cardinal(tp.x - here.x, tp.y - here.y, ent.face);
      startComboStep(state, id);
      const def = f.atk ? ATTACKS[f.atk] : undefined;
      m.nextSwing =
        state.tick + (def ? def.windup + def.active + def.recover : 20) + k.swingGapTicks;
      ent.mode = 'fight';
      ent.still = 0;
      return true;
    }
    if (far > 3) stepToward(state, id, ent, spot.x, spot.y, far > 48);
    else {
      ent.face = cardinal(tp.x - here.x, tp.y - here.y, ent.face);
      ent.mode = 'idle';
    }
    ent.still = 0;
    return true;
  }
  if (far > PARTY.followPx * 0.5) stepToward(state, id, ent, spot.x, spot.y, far > 64);
  else {
    ent.mode = 'stand';
    ent.still++;
  }
  return true;
}

/** Members' slots in order, for the HUD frames and the tests. */
export const memberSlots = (state: SimState): number[] =>
  state.party?.members.map((m) => m.slot) ?? [];

/** Health shares of members for the frames: 0 to 1, and downed. */
export function frameOf(
  state: SimState,
  slot: number,
): { hp: number; down: boolean; leaving: boolean } {
  const id = entOf(state, slot);
  const pl = id >= 0 ? state.entities.comps.pools[id] : undefined;
  const m = memberOf(state, slot);
  return {
    hp: pl ? pl.hp / pl.hpMax : 0,
    down: (m?.downed ?? -1) >= 0,
    leaving: (m?.warned ?? -1) >= 0,
  };
}
