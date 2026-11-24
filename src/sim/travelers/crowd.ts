import {
  ABSTRACT_TICKS,
  ACTIVITY_MINUTES,
  ACTIVITY_WEIGHTS,
  FIGHT_AREAS,
  GATHER_PLACES,
  OUTCOME,
  PHASE_FACTORS,
  PROGRESS,
  SOCIAL_PLACES,
  STATION_PLACES,
  TRADE_PLACE,
  TRAVEL_DEFAULT_MINUTES,
  TRAVEL_MIN_MINUTES,
  TRAVEL_TILES_PER_MINUTE,
  TRAVELER_COUNT,
  WEATHER_FACTORS,
  type Choice,
} from '../../content/balance/travelers';
import { CREATURES } from '../../content/creatures';
import { ITEMS } from '../../content/items';
import { NODES, RECIPES } from '../../content/items/recipes';
import { PLACES } from '../../content/people/places';
import { ACTIVITIES } from '../../content/travelers/types';
import { chance, int, next, pick, weighted } from '../kernel/rng';
import { buyPrice, sellPrice } from '../economy';
import { emit } from '../kernel/events';
import type { ClockInput } from '../kernel/scheduler';
import type { SimState } from '../state';
import { dayPhase, weatherOn } from '../time';
import { identitiesOf } from './generate';
import { PLACE_LIST, placeIdx, skillIdx } from './lists';
import { catchUp, expectedPoints, playHoursOf, type AwayEvent } from './progress';
import { dayIndexOf, localMinute, MIN_PER_DAY, sessionsFor, type Session } from './schedule';
import type { TravelerIdentity, TravelerLife } from './types';

/**
 * The crowd while unseen (POW-M5-03, design/12 3.2 and 3.3). Real time reaches the sim as a
 * {@link ClockInput}. Each in-game minute, every Traveler whose session covers the local time is
 * online, and an online Traveler that is not promoted to an entity (M5-04) does one abstract
 * step: walk a route, or work, and bank the outcome. Nothing here reads a clock or `Math.random`.
 */

export type { ClockInput };

/** What an online, unpromoted Traveler is doing. Transient: derived again after a load. */
export interface Doing {
  kind: (typeof ACTIVITIES)[number];
  /** Place index the activity happens at. */
  place: number;
  /** Minutes of the activity left, and minutes of walking left before it starts. */
  left: number;
  eta: number;
  /** Skill index it trains, or -1. */
  skill: number;
  /** Node id, creature id or recipe id, or `buy:<item>:<qty>` or `sell` for trade. */
  thing: string;
}

export interface Crowd {
  seed: number;
  online: Uint8Array;
  promoted: Uint8Array;
  doing: (Doing | null)[];
  /** Goods each Traveler carries, by item id. Not saved: a load starts them light. */
  stock: Record<string, number>[];
  /** Sessions of the cached real day and the one before it, by slot. */
  day: number;
  today: Session[][];
  yesterday: Session[][];
  lastMinute: number;
  caughtUp: boolean;
  /** What the login catch-up found. */
  away: AwayEvent[];
}

export function newCrowd(seed: number): Crowd {
  return {
    seed,
    online: new Uint8Array(TRAVELER_COUNT),
    promoted: new Uint8Array(TRAVELER_COUNT),
    doing: Array.from({ length: TRAVELER_COUNT }, () => null),
    stock: Array.from({ length: TRAVELER_COUNT }, () => ({})),
    day: Number.NaN,
    today: [],
    yesterday: [],
    lastMinute: -1,
    caughtUp: false,
    away: [],
  };
}

const DAY_MS = 86_400_000;

/** Real days since the save began, from the clock. */
export const realDaysOf = (c: ClockInput): number => Math.max(0, (c.nowMs - c.epochMs) / DAY_MS);

/** The crowd, made on first use. */
export function crowdOf(state: SimState): Crowd {
  return (state.crowd ??= newCrowd(state.seed));
}

/** Number of Travelers online now. */
export function onlineCount(crowd: Crowd): number {
  let n = 0;
  for (let i = 0; i < crowd.online.length; i++) n += crowd.online[i] ?? 0;
  return n;
}

function loadSessions(crowd: Crowd, ids: readonly TravelerIdentity[], day: number): void {
  if (crowd.day === day) return;
  crowd.today = ids.map((t) => sessionsFor(crowd.seed, t, day));
  crowd.yesterday = ids.map((t) => sessionsFor(crowd.seed, t, day - 1));
  crowd.day = day;
}

function inSession(crowd: Crowd, slot: number, minute: number): boolean {
  for (const s of crowd.today[slot] ?? []) if (minute >= s.start && minute < s.end) return true;
  for (const s of crowd.yesterday[slot] ?? [])
    if (s.end > MIN_PER_DAY && minute + MIN_PER_DAY >= s.start && minute + MIN_PER_DAY < s.end)
      return true;
  return false;
}

const actIdx = (k: Doing['kind']): number => ACTIVITIES.indexOf(k);

// ---- Routes ----

const centerOf = (place: number): { x: number; y: number } | null => {
  const def = PLACES[PLACE_LIST[place] ?? ''];
  const spot = def?.spot as { rect?: { x: number; y: number; w: number; h: number } } | undefined;
  const r = spot?.rect;
  return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
};

/** Minutes to walk between two places, from their spots, or a default when either has none. */
export function routeMinutes(from: number, to: number): number {
  if (from === to) return 0;
  const a = centerOf(from);
  const b = centerOf(to);
  if (!a || !b) return TRAVEL_DEFAULT_MINUTES;
  const tiles = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  return Math.max(TRAVEL_MIN_MINUTES, Math.ceil(tiles / TRAVEL_TILES_PER_MINUTE));
}

// ---- Choosing ----

const nodeIds = Object.keys(NODES);
const nodeSkill = (id: string): number => skillIdx(`skill.${NODES[id]!.tag}`);
const gatherSkills = new Set(nodeIds.map(nodeSkill).filter((i) => i >= 0));
const craftRecipes = Object.values(RECIPES).filter((r) => !r.enchant && r.result !== '');
const ARMS = new Set(
  ['blades', 'heavy_arms', 'polearms', 'archery', 'unarmed', 'shieldcraft', 'evasion'].map((s) =>
    skillIdx(`skill.${s}`),
  ),
);

function weightsNow(state: SimState, t: TravelerIdentity): [Choice, number][] {
  const base = ACTIVITY_WEIGHTS[t.archetype];
  const phase = PHASE_FACTORS[dayPhase(state.worldTick)] ?? {};
  const weather = WEATHER_FACTORS[weatherOn(state, state.worldTick)] ?? {};
  return (Object.keys(base) as Choice[]).map((c) => [
    c,
    base[c] * (phase[c] ?? 1) * (weather[c] ?? 1),
  ]);
}

function tierOf(life: TravelerLife): number {
  let top = 0;
  for (const [, p] of life.build) top = Math.max(top, p);
  return 1 + Math.floor(top / 20);
}

/** Item ids a node of each skill yields, so a Traveler that is short of one can go and get it. */
const nodesYielding = (item: string): string[] =>
  nodeIds.filter((id) => NODES[id]!.yields.some((y) => y.item === item));

function pickMinutes(state: SimState, c: Choice): number {
  const [lo, hi] = ACTIVITY_MINUTES[c];
  return int(state.rng.travelers, lo, hi);
}

const gatherDoing = (state: SimState, node: string, minutes: number): Doing => {
  const skill = nodeSkill(node);
  const place = placeIdx(GATHER_PLACES[`skill.${NODES[node]!.tag}`] ?? 'millbrook.fields');
  return { kind: 'gather', place, left: minutes, eta: 0, skill, thing: node };
};

/** Picks the next thing for an online Traveler. Pure in the state and the travelers stream. */
export function chooseNext(state: SimState, crowd: Crowd, t: TravelerIdentity): Doing {
  const r = state.rng.travelers;
  const life = state.travelers[t.slot]!;
  const tier = tierOf(life);
  let choice = weighted(r, weightsNow(state, t));
  const stock = crowd.stock[t.slot]!;
  const here = life.place;

  if (choice === 'craft') {
    const craftable = craftRecipes.filter(
      (rc) =>
        rc.tier <= tier &&
        t.focus.some((f) => f === `skill.${rc.craft}`) &&
        STATION_PLACES[rc.station],
    );
    if (craftable.length === 0) choice = 'gather';
    else {
      const rc = pick(r, craftable);
      const missing = rc.ingredients.find((i) => (stock[i.item] ?? 0) < i.qty);
      if (!missing) {
        return {
          kind: 'craft',
          place: placeIdx(STATION_PLACES[rc.station]!),
          left: pickMinutes(state, 'craft'),
          eta: 0,
          skill: skillIdx(`skill.${rc.craft}`),
          thing: rc.id,
        };
      }
      // Short of something: buy it, or go and gather it, before crafting.
      const need = missing.qty - (stock[missing.item] ?? 0);
      const sources = nodesYielding(missing.item);
      const cost = buyPrice(missing.item) * need;
      const canBuy = life.coin >= cost && ITEMS[missing.item] !== undefined;
      if (sources.length > 0 && (!canBuy || !chance(r, OUTCOME.buyInstead)))
        return gatherDoing(state, pick(r, sources), pickMinutes(state, 'gather'));
      if (canBuy)
        return {
          kind: 'trade',
          place: placeIdx(TRADE_PLACE),
          left: pickMinutes(state, 'trade'),
          eta: 0,
          skill: -1,
          thing: `buy:${missing.item}:${need}`,
        };
      choice = 'social';
    }
  }
  if (choice === 'gather') {
    const mine = t.focus.map((f) => skillIdx(f)).filter((i) => gatherSkills.has(i));
    const skill = mine.length > 0 ? pick(r, mine) : pick(r, [...gatherSkills]);
    const nodes = nodeIds.filter((id) => nodeSkill(id) === skill && NODES[id]!.tier <= tier);
    if (nodes.length > 0) return gatherDoing(state, pick(r, nodes), pickMinutes(state, 'gather'));
    choice = 'social';
  }
  if (choice === 'fight') {
    const area = pick(r, FIGHT_AREAS);
    const arms = t.focus.map((f) => skillIdx(f)).filter((i) => ARMS.has(i));
    return {
      kind: 'fight',
      place: placeIdx(area.place),
      left: pickMinutes(state, 'fight'),
      eta: 0,
      skill: arms.length > 0 ? pick(r, arms) : -1,
      thing: area.creature,
    };
  }
  if (choice === 'trade') {
    const has = Object.keys(stock).some((i) => (stock[i] ?? 0) > 0 && sellPrice(i) > 0);
    if (has)
      return {
        kind: 'trade',
        place: placeIdx(TRADE_PLACE),
        left: pickMinutes(state, 'trade'),
        eta: 0,
        skill: -1,
        thing: 'sell',
      };
    choice = 'social';
  }
  if (choice === 'afk')
    return {
      kind: 'afk',
      place: here,
      left: pickMinutes(state, 'afk'),
      eta: 0,
      skill: -1,
      thing: '',
    };
  const spot = weighted(r, SOCIAL_PLACES);
  return {
    kind: 'social',
    place: placeIdx(spot),
    left: pickMinutes(state, 'social'),
    eta: 0,
    skill: -1,
    thing: '',
  };
}

// ---- Outcomes ----

function nudge(
  state: SimState,
  crowd: Crowd,
  clock: ClockInput,
  t: TravelerIdentity,
  skill: number,
): void {
  if (skill < 0) return;
  const k = t.focus.findIndex((f) => skillIdx(f) === skill);
  if (k < 0) return;
  const life = state.travelers[t.slot]!;
  const entry = life.build.find(([s]) => s === skill);
  const have = entry ? entry[1] : 0;
  const want = expectedPoints(t, k, playHoursOf(state.tick), realDaysOf(clock));
  if (have >= want || !chance(state.rng.travelers, PROGRESS.nudgePerMinute)) return;
  if (entry) entry[1] = have + 1;
  else {
    life.build.push([skill, 1]);
    life.build.sort((a, b) => a[0] - b[0]);
  }
  if ((have + 1) % PROGRESS.pointsPerRank === 0)
    emit(state.events, {
      type: 'travelerRankUp',
      slot: t.slot,
      skill: t.focus[k]!,
      points: have + 1,
    });
}

function addStock(stock: Record<string, number>, item: string, qty: number): void {
  stock[item] = Math.min(OUTCOME.stockCap, (stock[item] ?? 0) + qty);
}

function weightedYield(state: SimState, node: string): string {
  return weighted(
    state.rng.travelers,
    NODES[node]!.yields.map((y) => [y.item, y.weight] as const),
  );
}

function work(
  state: SimState,
  crowd: Crowd,
  clock: ClockInput,
  t: TravelerIdentity,
  d: Doing,
): void {
  const life = state.travelers[t.slot]!;
  const stock = crowd.stock[t.slot]!;
  const r = state.rng.travelers;
  const phase = d.left;
  switch (d.kind) {
    case 'gather': {
      if (phase % OUTCOME.gatherEvery !== 0) break;
      addStock(stock, weightedYield(state, d.thing), int(r, 1, OUTCOME.gatherQty));
      nudge(state, crowd, clock, t, d.skill);
      break;
    }
    case 'fight': {
      if (phase % OUTCOME.fightEvery !== 0) break;
      const c = CREATURES[d.thing];
      if (!c) break;
      life.coin = Math.min(
        PROGRESS.coinCap,
        life.coin + int(r, OUTCOME.coinPerKill[0], OUTCOME.coinPerKill[1]) * c.tier,
      );
      for (const dr of c.drops) {
        if (next(r) * 100 >= dr.chance) continue;
        const qty = int(r, dr.min, dr.max);
        if (dr.item === 'item.coin') {
          life.coin = Math.min(PROGRESS.coinCap, life.coin + qty);
          continue;
        }
        addStock(stock, dr.item, qty);
        if (dr.chance <= OUTCOME.notableDropPct)
          emit(state.events, {
            type: 'travelerLooted',
            slot: t.slot,
            item: dr.item,
            qty,
            creature: d.thing,
            chance: dr.chance,
          });
      }
      nudge(state, crowd, clock, t, d.skill);
      if (chance(r, OUTCOME.deathChance * c.tier)) {
        life.coin -= Math.floor((life.coin * OUTCOME.deathCoinPct) / 100);
        emit(state.events, {
          type: 'travelerDied',
          slot: t.slot,
          creature: d.thing,
          place: life.place,
        });
        // Back to the Waystone in the square, and a new choice.
        life.place = placeIdx('hearthford.square');
        crowd.doing[t.slot] = null;
      }
      break;
    }
    case 'craft': {
      if (phase % OUTCOME.craftEvery !== 0) break;
      const rc = RECIPES[d.thing];
      if (!rc) break;
      if (rc.ingredients.some((i) => (stock[i.item] ?? 0) < i.qty)) {
        d.left = 0;
        break;
      }
      for (const i of rc.ingredients) stock[i.item] = (stock[i.item] ?? 0) - i.qty;
      addStock(stock, rc.result, rc.qty);
      emit(state.events, {
        type: 'travelerCrafted',
        slot: t.slot,
        item: rc.result,
        qty: rc.qty,
        recipe: rc.id,
      });
      nudge(state, crowd, clock, t, d.skill);
      break;
    }
    case 'trade': {
      if (phase !== Math.max(1, d.left)) break;
      trade(state, crowd, t, d);
      break;
    }
    default:
      break;
  }
}

/** Sells goods to the shop price model (never the player's economy), or buys an ingredient. */
function trade(state: SimState, crowd: Crowd, t: TravelerIdentity, d: Doing): void {
  const life = state.travelers[t.slot]!;
  const stock = crowd.stock[t.slot]!;
  if (d.thing.startsWith('buy:')) {
    const [, item, qty] = d.thing.split(':') as [string, string, string];
    const n = Number(qty);
    const cost = buyPrice(item) * n;
    if (life.coin >= cost) {
      life.coin -= cost;
      addStock(stock, item, n);
    }
    d.thing = 'done';
    return;
  }
  if (d.thing !== 'sell') return;
  for (const item of Object.keys(stock).sort()) {
    const have = stock[item] ?? 0;
    const price = sellPrice(item);
    if (have <= 0 || price <= 0) continue;
    // A Traveler keeps what its own crafts need and sells the rest.
    const keep = craftRecipes.some(
      (rc) => rc.ingredients.some((i) => i.item === item) && t.focus.includes(`skill.${rc.craft}`),
    )
      ? 4
      : 0;
    const sold = have - keep;
    if (sold <= 0) continue;
    stock[item] = keep;
    const gain = Math.floor((price * sold * OUTCOME.sellPct) / 100);
    life.coin = Math.min(PROGRESS.coinCap, life.coin + gain);
    emit(state.events, { type: 'travelerSold', slot: t.slot, item, qty: sold, price });
  }
  d.thing = 'done';
}

// ---- The tick ----

function login(state: SimState, crowd: Crowd, t: TravelerIdentity): void {
  crowd.online[t.slot] = 1;
  crowd.doing[t.slot] = null;
  emit(state.events, {
    type: 'travelerLoggedIn',
    slot: t.slot,
    place: state.travelers[t.slot]!.place,
  });
}

function logout(state: SimState, crowd: Crowd, t: TravelerIdentity): void {
  crowd.online[t.slot] = 0;
  crowd.doing[t.slot] = null;
  const life = state.travelers[t.slot]!;
  life.activity = actIdx('afk');
  emit(state.events, { type: 'travelerLoggedOut', slot: t.slot, place: life.place });
}

/** One abstract step for an online, unpromoted Traveler. */
function stepTraveler(state: SimState, crowd: Crowd, clock: ClockInput, t: TravelerIdentity): void {
  const life = state.travelers[t.slot]!;
  let d = crowd.doing[t.slot] ?? null;
  if (!d || (d.eta === 0 && d.left <= 0)) {
    d = chooseNext(state, crowd, t);
    d.eta = routeMinutes(life.place, d.place);
    crowd.doing[t.slot] = d;
    life.activity = actIdx(d.eta > 0 ? 'travel' : d.kind);
    life.subject = d.skill < 0 ? 0 : d.skill;
  }
  if (d.eta > 0) {
    d.eta--;
    if (d.eta === 0) {
      life.place = d.place;
      life.activity = actIdx(d.kind);
      emit(state.events, { type: 'travelerArrived', slot: t.slot, place: d.place });
    }
    return;
  }
  life.place = d.place;
  work(state, crowd, clock, t, d);
  d.left--;
}

/** Brings every life to its expected value on the first tick with a clock (the login pass). */
function loginCatchUp(state: SimState, crowd: Crowd, clock: ClockInput): void {
  crowd.away = catchUp(state.seed, state.travelers, playHoursOf(state.tick), realDaysOf(clock));
  crowd.caughtUp = true;
  emit(state.events, { type: 'travelersAway', away: crowd.away });
}

/**
 * The crowd system. Does nothing until the platform gives the sim a clock, so demos and tests
 * that pass none are untouched. Runs the abstract tick once per in-game minute.
 */
export function travelersSystem(state: SimState): void {
  const clock = state.clock;
  if (!clock) return;
  const crowd = crowdOf(state);
  if (!crowd.caughtUp) loginCatchUp(state, crowd, clock);
  const minute = Math.floor(state.worldTick / ABSTRACT_TICKS);
  if (minute === crowd.lastMinute) return;
  crowd.lastMinute = minute;
  const ids = identitiesOf(crowd.seed);
  const local = localMinute(clock.nowMs, clock.tzOffsetMin);
  const day = dayIndexOf(local);
  loadSessions(crowd, ids, day);
  const m = local - day * MIN_PER_DAY;
  for (const t of ids) {
    const on = inSession(crowd, t.slot, m);
    const was = crowd.online[t.slot] === 1;
    if (on && !was) login(state, crowd, t);
    else if (!on && was) logout(state, crowd, t);
    if (on && !crowd.promoted[t.slot]) stepTraveler(state, crowd, clock, t);
  }
}
