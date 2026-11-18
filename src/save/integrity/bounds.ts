/**
 * Every bound the validator uses, as a named constant with its derivation. Bounds come from
 * `content/` and `content/balance/` wherever they can, so a balance change moves the bound with
 * it and an honest player cannot be tripped by a retune. Where a number is a judgement call it
 * says so, and it is generous: a legitimate player must never reach one.
 */
import { SKILLS_BALANCE } from '../../content/balance/skills';
import { TIME } from '../../content/balance/time';
import { COMBAT } from '../../content/balance/combat';
import { ITEMS_BALANCE } from '../../content/balance/items';
import { MOVEMENT } from '../../content/balance/movement';
import { SHOP_BALANCE } from '../../content/balance/shop';
import { ATTACKS } from '../../content/combat/attacks';
import { CREATURES } from '../../content/creatures';
import { NODES, RECIPES } from '../../content/items/recipes';
import { ITEMS } from '../../content/items';
import { REQUESTS, SHOPS } from '../../content/dialogue';
import { FIXTURES } from '../../content/world/fixtures';
import { SKILLS } from '../../content/skills';
import type { XpSource } from '../../content/skills/types';

/** Sim ticks per second. */
export const TPS = 30;

/**
 * Slack, in seconds, between play time and the wall clock between first and latest save.
 * Judgement: a device clock corrected by up to ten minutes (network time, a manual fix) is not
 * tampering. Large jumps are the trusted-time layer's job (M2-04).
 */
export const PLAY_SLACK_SECONDS = 600;

/** The summary's tick and the recorded play seconds are written together; they may differ by this. */
export const TICK_SLACK_SECONDS = 10;

/** Hard caps. Judgement: far above anything the game can reach, below anything that breaks it. */
export const COIN_HARD_CAP = 1_000_000_000;
export const MAX_BAG_SLOTS = 60;
export const MAX_ENTITY_CAPACITY = 100_000;

/** The fastest player swing, in ticks: windup, active and recover of the quickest attack. */
export const SWING_TICKS_MIN = Math.min(
  ...Object.values(ATTACKS)
    .filter((a) => a.family !== 'creature')
    .map((a) => a.windup + a.active + a.recover),
);

/**
 * Most creatures one swing can hit. Judgement: the engagement cap is six, but wide arcs hit what
 * is in front of them, so three is generous for the shapes in the game.
 */
export const MAX_TARGETS_PER_SWING = 3;

/** Damage events per second: fastest swing rate times targets per swing. */
export const DAMAGE_EVENTS_PER_SECOND = (TPS / SWING_TICKS_MIN) * MAX_TARGETS_PER_SWING;

/** Dodges per second: one dodge takes `dodge.ticks`, and Stamina would run out first. */
export const DODGE_EVENTS_PER_SECOND = TPS / COMBAT.dodge.ticks;

/** The fastest creature attack cycle, in ticks. Blocks and parries are paid by creature attacks. */
export const CREATURE_SWING_TICKS_MIN = Math.min(
  ...Object.values(ATTACKS)
    .filter((a) => a.family === 'creature')
    .map((a) => a.windup + a.active + a.recover),
);

/** Blocked or parried hits per second: six attackers (the engagement cap, design/04) at the fastest creature cycle. */
export const BLOCK_EVENTS_PER_SECOND = (TPS / CREATURE_SWING_TICKS_MIN) * 6;

/**
 * The shortest time to work one node, in ticks. A sweep takes its `ticks` (the default or the
 * node's own), a tree takes `swings` of them, and a fishing spot waits at least `fishWaitMin`
 * for a bite. Read from content, so a new node or a retune moves the bound with it.
 */
export const GATHER_CYCLE_TICKS_MIN = Math.min(
  ...Object.values(NODES).map((n) =>
    n.fishing
      ? ITEMS_BALANCE.gather.fishWaitMin
      : (n.sweep?.ticks ?? ITEMS_BALANCE.gather.sweepTicks) *
        (n.sweep?.swings ?? ITEMS_BALANCE.gather.swings),
  ),
);

/** Gathers per second: one node takes at least `GATHER_CYCLE_TICKS_MIN`. */
export const GATHER_EVENTS_PER_SECOND = TPS / GATHER_CYCLE_TICKS_MIN;

/** The most items one gather can pay: the largest base plus every sweep sweet. */
export const GATHER_YIELD_MAX = Math.max(
  ...Object.values(NODES).map(
    (n) =>
      (n.sweep?.baseMax ?? ITEMS_BALANCE.gather.baseMax) +
      (n.sweep?.swings ?? ITEMS_BALANCE.gather.swings) *
        (n.sweep?.sweetBonus ?? ITEMS_BALANCE.gather.sweetBonus),
  ),
);

/** Items from `gather` per second at the fastest rate and the largest yield (rule GATHER_RATE). */
export const GATHER_ITEMS_PER_SECOND = GATHER_EVENTS_PER_SECOND * GATHER_YIELD_MAX;

/** Cooks per second. Judgement: cooking has no timer in the sim, so two a second is far past a hand. */
export const COOK_EVENTS_PER_SECOND = 2;

/** Sprint pays once per `sprintPx` run, at sprint speed (walk speed times the sprint factor). */
export const SPRINT_EVENTS_PER_SECOND =
  (((MOVEMENT.walkSpeed * MOVEMENT.sprintFactor256) / 256 / 256) * TPS) / SKILLS_BALANCE.sprintPx;

/** Creatures killed per second. Judgement: design/04 puts a common kill at 4 to 8 s; this allows area kills. */
export const KILLS_PER_SECOND_MAX = 2;

/** One-off allowance for counts and lumps that do not scale with time. */
/** Hard cap on storage chest slots, as for the bag. */
export const MAX_STORAGE_SLOTS = ITEMS_BALANCE.storage.slots;

export const COUNT_SLACK = 20;
export const XP_SLACK = 300;

/** Hours of night per second: one in-game hour is `hourTicks` of sim time. */
export const NIGHT_HOURS_PER_SECOND = TPS / TIME.hourTicks;

/**
 * The fastest each XP event can fire, per second. Events whose system does not exist yet
 * (heal, statusApplied, repair, haggle, sale, perform, sneak) get a judgement of
 * two a second until their ticket measures it. Each such ticket replaces its entry.
 */
const RATES: Record<XpSource['on'], number> = {
  damage: DAMAGE_EVENTS_PER_SECOND,
  dodge: DODGE_EVENTS_PER_SECOND,
  gather: GATHER_EVENTS_PER_SECOND,
  craft: COOK_EVENTS_PER_SECOND,
  sprint: SPRINT_EVENTS_PER_SECOND,
  outdoorsNight: NIGHT_HOURS_PER_SECOND,
  /** Eating takes a command each, so the cooking bound is far past a hand. */
  eatRaw: COOK_EVENTS_PER_SECOND,
  /** A tablet pays only the first-time lump, which is counted below. */
  tabletRead: 0,
  block: BLOCK_EVENTS_PER_SECOND,
  parry: BLOCK_EVENTS_PER_SECOND,
  heal: 2,
  statusApplied: 2,
  repair: 2,
  haggle: 2,
  sale: 2,
  perform: 2,
  sneak: 2,
};

const rateOf = (on: XpSource['on']): number => RATES[on];

/** Most XP one event of a source can pay: base, scaled up to the challenge ceiling. */
const perEvent = (s: XpSource): number =>
  s.scaled === false ? s.base : Math.floor((s.base * SKILLS_BALANCE.challenge.ceilPct) / 100);

/** Things a first-time lump can key on: creatures, items, recipes and fixture kinds. */
const FIRST_TIME_SUBJECTS =
  Object.keys(CREATURES).length +
  Object.keys(ITEMS).length +
  Object.keys(RECIPES).length +
  Object.keys(FIXTURES).length;

/**
 * The most XP a skill can have earned in `seconds` of play: every source firing at its fastest
 * rate for the whole time at the top challenge pay, plus every first-time lump, plus slack.
 */
export function xpCeiling(skill: string, seconds: number): number {
  const def = SKILLS[skill];
  if (!def) return 0;
  let total = XP_SLACK;
  for (const s of def.sources) {
    total += perEvent(s) * rateOf(s.on) * seconds;
    total += (s.firstTime ?? 0) * FIRST_TIME_SUBJECTS;
  }
  return Math.ceil(total);
}

/** The most coin one kill of a creature can drop: the top of every coin entry in its table. */
export function maxCoinPerKill(creature: string): number {
  return (CREATURES[creature]?.drops ?? [])
    .filter((d) => d.item === 'item.coin')
    .reduce((n, d) => n + d.max, 0);
}

/** The most of an item one kill of a creature can drop. */
export function maxItemPerKill(creature: string, item: string): number {
  return (CREATURES[creature]?.drops ?? [])
    .filter((d) => d.item === item)
    .reduce((n, d) => n + d.max, 0);
}

/** Coin in every chest in the game, each opened once. */
export const CHEST_COIN_TOTAL = Object.values(FIXTURES).reduce(
  (n, f) => n + (f.loot?.coin ?? 0),
  0,
);

/** Coin paid by every request, each once. */
export const REQUEST_COIN_TOTAL = Object.values(REQUESTS).reduce((n, r) => n + r.reward.coin, 0);

/**
 * The most coin shops can pay out in `seconds`: what they start with, what they earn back on
 * their regen timer, and what the player has paid them (their purse refills from purchases).
 */
export function saleCeiling(seconds: number, spentOnPurchases: number): number {
  const shops = Object.values(SHOPS);
  const start = shops.reduce((n, s) => n + s.purse.start, 0);
  const regens = Math.floor(seconds / (SHOP_BALANCE.purseRegenEvery / TPS)) + 1;
  // The Fair Dealer Path (M3-08) doubles the top up. That ticket changes the factor here.
  return start + regens * SHOP_BALANCE.purseRegen * shops.length + spentOnPurchases;
}

/**
 * The most coin the avatar can have earned from anything in `seconds`, with `kills` made: loot
 * per kill, every chest, every request, and shop sales. Used for the `seed` source of a save
 * migrated from before the ledger, which has no history to break down.
 */
export function coinCeiling(seconds: number, kills: number, spentOnPurchases: number): number {
  const perKill = Math.max(0, ...Object.keys(CREATURES).map(maxCoinPerKill));
  return (
    Math.max(kills, KILLS_PER_SECOND_MAX * seconds + COUNT_SLACK) * perKill +
    CHEST_COIN_TOTAL +
    REQUEST_COIN_TOTAL +
    saleCeiling(seconds, spentOnPurchases)
  );
}
