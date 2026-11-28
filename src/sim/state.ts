import { createStore, destroy, spawn, setComp, type EntityStore } from './kernel/entities';
import { createEventQueue, type EventQueue } from './kernel/events';
import { createStreams, int, type RngStreams } from './kernel/rng';
import { px, type Direction, type Vec } from './kernel/fixed';
import type { CollisionGrid } from './systems/collision';
import type { EquipSlot, Quality } from '../content/items/types';
import type { RequestDef } from '../content/requests/types';
import { newLedger, type Ledger } from './ledger';
import type { Deltas } from './world/deltas';
import type { StreamState } from './world/stream';
import type { Fog } from './world/fog';
import { initialLives } from './travelers/generate';
import type { DuelState } from './duel';
import { newMailbox, normalMailbox, type Mailbox } from './mail';
import { newGuildState, type GuildState } from './guild';
import { newMarket, type MarketState } from './market';
import { newCalendar, type CalendarState, type WorldEventsState } from './worldEvents';
import { newFarm, normalFarm, type FarmState } from './farmState';
import { newFishing, normalFishing, type Fight, type FishingState } from './fishState';
import { livesFromText, livesToText } from './travelers/codec';
import type { TravelerLife } from './travelers/types';
import type { Crowd } from './travelers/crowd';
import type { ChatState } from './chat/engine';
import type { RankingsMemo } from './rankings/system';
import type { ClockInput } from './kernel/scheduler';

/** Collision body, centered on `pos` horizontally and standing on it vertically. Sub-pixel units. */
export interface Body {
  w: number;
  h: number;
  /** Blocks other bodies. Avatars and creatures check against solid bodies. */
  solid: boolean;
  /** Passes over or under tiles: flyers, and burrowers while they tunnel. */
  pass?: boolean;
}

/** State of the player-controlled avatar. */
export interface Avatar {
  /** Cardinal facing: N, E, S or W (0, 2, 4, 6). */
  facing: Direction;
  /** Direction the stick is held in, or null. */
  intent: Direction | null;
  /** Stick at full extent. */
  full: boolean;
  /** Consecutive ticks at full extent. */
  fullTicks: number;
  sprinting: boolean;
  /** Carried coin. Placeholder until the inventory (M1-05) owns coin. */
  coin: number;
  /** Where the avatar wakes after dying: the last Waystone touched. Feet position, sub-pixel units. */
  respawn: Vec;
  /** Ran dry: sprint is off until stamina recovers. */
  winded: boolean;
  /** The name the player chose at setup. Shown to other players, so it is validated (shared/handle). */
  handle: string;
  /**
   * The origin chosen at creation (M4-19). Flavor only: it narrowed where the avatar woke and set
   * its first line. Nothing else reads it, and the integrity checks do not trust it.
   */
  origin: string;
}

/** Health, Stamina and Focus. Health in points, Stamina and Focus in tenths. */
export interface Pools {
  hp: number;
  hpMax: number;
  sta: number;
  staMax: number;
  foc: number;
  focMax: number;
  /** Tick of the last damage dealt or taken. Health regenerates only after a quiet spell. */
  lastCombat: number;
  /** Tick of the last Stamina spend. */
  lastSpend: number;
}

export type FighterState = 'idle' | 'attack' | 'dodge' | 'hurt' | 'stagger' | 'dead';
export type Scheme = 'flow' | 'classic';

/** Combat state machine for anything that fights. Team 0 is the player's side. */
export interface Fighter {
  team: 0 | 1;
  state: FighterState;
  /** Ticks spent in the current state. */
  t: number;
  /** Attack in progress, with the ids it has already hit. */
  atk: string | null;
  hit: number[];
  /** Classic combo step (0 to 2) the next press starts, and a chain request made in the window. */
  combo: number;
  queued: boolean;
  /** Aim vector in px for the attack in progress. Never zero. */
  aim: Vec;
  /** Ticks both sides freeze after a hit lands. */
  hitstop: number;
  /** Ticks of invulnerability left. */
  invuln: number;
  /** Tick the current dodge began, for perfect dodge detection. */
  dodgeStart: number;
  /** Per-tick displacement for dodges and dashes, sub-pixel units. */
  dv: Vec;
  /** Ticks until the next Flow swing may start. */
  gap: number;
  /** Locked target. */
  lock: number | null;
  scheme: Scheme;
  /** Technique slot being aimed (held), or -1. */
  aiming: number;
  slots: (string | null)[];
  /** Cooldown ticks per slot. */
  cooldowns: number[];
  /** Technique whose attack is in progress, so its projectile launches. */
  casting: string | null;
  /** Ticks since death. */
  deadT: number;
  /** Guard raised. It blocks only while the fighter is otherwise idle. */
  guard: boolean;
  /** Ticks since the guard was raised, for the parry window. */
  guardT: number;
  /** Ticks since the fighter last moved. Archery charges on it. */
  still: number;
  /** Tick until which every technique slot and the basic attack are locked (a swap in combat). */
  lockUntil?: number;
}

/** What a fighter hits with and how hard it is to hurt. */
export interface Combatant {
  weapon: string;
  power: number;
  defense: number;
  /** Skill points 0 to 100 for the weapon's skill, kept in step by the skills system. */
  skillRank: number;
  /** Name for the lock frame. */
  name: string;
  /** What it is: a creature id, or `avatar`. Skill XP and first-time bonuses key on it. */
  kind: string;
  /** Creature tier 1 to 8, or 0 for the avatar. Sets how much XP fighting it is worth. */
  tier: number;
}

/** Some of one item in a bag slot. */
export interface ItemStack {
  item: string;
  qty: number;
  /** Absent means Common (0). */
  q?: Quality;
  /** Durability left. Gear and tools only. Absent for everything else. */
  dur?: number;
  /** Crafted by this avatar: shows the avatar's handle. */
  mark?: 1;
  /** At most the item's `affixSlots`. */
  affixes?: string[];
}

/** The storage chest's slots, held on the avatar (M3-05). */
export interface Storage {
  slots: (ItemStack | null)[];
}

/** The bag, what is worn, and the recipes the avatar knows. Coin is `avatar.coin`, not a slot. */
export interface Inventory {
  slots: (ItemStack | null)[];
  equipment: Record<EquipSlot, ItemStack | null>;
  recipes: string[];
  /** Hits landed, hits taken and gathers made since the last durability point was lost. */
  wear: { hits: number; taken: number; uses: number };
}

/** An item lying in the world. `age` counts ticks since it popped out. */
export interface Pickup {
  item: string;
  qty: number;
  age: number;
  /** Told the player the bag was full, so it says so once. */
  blocked: boolean;
  /** Quality, durability, mark and affixes of a dropped item, so they survive the drop. */
  stack?: ItemStack;
}

/** A gathering node. Ready when the tick reaches `readyAt`. */
export interface GatherNode {
  kind: string;
  readyAt: number;
}

/** A gather in progress: the node and ticks into the timing sweep. */
export interface Gather {
  node: number;
  t: number;
  /** Sweeps done so far on a node that takes several, and the sweet hits among them. */
  swing: number;
  hits: number;
  /** Bag slot of the tool in use, or -1 for none. */
  tool: number;
  /** Fishing: ticks until the bite. 0 for a sweep. */
  wait: number;
  /** Fishing: the fight, from the cast to the landing (M6-05). Absent for a sweep. */
  fish?: Fight;
}

/** A craft under way at a station: the recipe, the manual step so far, and what the inputs were worth. */
export interface CraftSession {
  station: string;
  recipe: string;
  /** Tick the craft began. */
  start: number;
  /** Tap ticks, as ticks since `start`. Only the sim records them. */
  taps: number[];
  /** Summed quality and count of the ingredient units that carry quality. */
  matSum: number;
  matN: number;
  source: 'manual' | 'routine';
  /** Trace: pointer samples as flat x, y pairs in the 1000 by 1000 space, one pair per tick. */
  samples?: number[];
  /** Hold: the tick (since `start`) the hold began and ended, or -1. */
  holdFrom?: number;
  holdTo?: number;
  /** Enchanting: the bag slot of the item being enchanted, or -1. */
  target?: number;
}

/**
 * One active status on a unit (M3-09). `until` is a sim tick. `src` is the entity that caused it,
 * or -1 for none (a meal, a bed, the world). `item` is the meal behind a `fed` status, whose
 * pool bonuses come from the food's data.
 */
export interface StatusEntry {
  id: string;
  until: number;
  src: number;
  item?: string;
  /** Hidden: creatures that would have noticed the unit and did not, so each counts once (`sneak`). */
  ids?: number[];
}

/**
 * What one loadout wields and slots (M3-13). `main` and `off` are bag slot indexes where the item
 * for that hand was when the loadout was left, checked on swap. `slots` are the four technique slots.
 */
export interface Loadout {
  main: number | null;
  off: number | null;
  slots: (string | null)[];
}

/** Two loadouts and which one is in use. The fighter's own slots are the active set's. */
export interface Loadouts {
  active: 0 | 1;
  sets: [Loadout, Loadout];
}

/** A song or other channel in progress: the slot, the technique and the tick it finishes. */
export interface Channel {
  slot: number;
  technique: string;
  until: number;
}

/**
 * What the avatar has done (M3-08): deed counts, sets of names for `distinct` deeds, when a
 * `countSinceReset` deed was last zeroed (a world tick), the fight in progress, and the creatures
 * close enough now to count as met.
 */
export interface Deeds {
  counts: Record<string, number>;
  distinct: Record<string, string[]>;
  resetAt: Record<string, number>;
  /** The fight on: whether it has begun, kills made, and whether the avatar was hurt. */
  fight: { live: boolean; kills: number; hurt: boolean };
  near: number[];
}

/** The Paths the avatar has earned, the (at most three) it wears, and the one whose title shows. */
export interface Paths {
  earned: string[];
  worn: string[];
  shown: string | null;
}

/** A lingering cloud (steam): hurts and hides what stands in it until `until`. */
export interface Cloud {
  kind: string;
  until: number;
  /** Radius in px. */
  radius: number;
  src: number;
}

/** Skill points and Trial progress for the avatar. Every key is a skill id from content. */
export interface Skills {
  /** Points 0 to 100. A skill with no entry has 0. */
  points: Record<string, number>;
  /** XP toward the next point. Held in the bank while the next point waits on a Trial. */
  xp: Record<string, number>;
  /**
   * Skills that have awakened (M4-15): the first XP, a manual read or a person's lesson. A dormant
   * skill shows nowhere. A skill with points or banked XP counts as awake whatever this says.
   */
  awake: string[];
  /** Insight counts toward a technique, by technique id (M4-15). Only techniques with that source. */
  insight: Record<string, number>;
  /** Trial flags passed, as `skill@threshold`. */
  passed: string[];
  /** Trial ids an NPC has given and that are not passed yet. */
  offered: string[];
  /** First-time bonuses already paid, as `skill:event:subject`. */
  seen: string[];
  /** Sprint distance: last feet position and sub-pixel distance not yet paid. */
  stride: { x: number; y: number; acc: number };
  /** Ticks of night spent outdoors that have not yet been paid as an in-game hour (Survival). */
  nightAcc: number;
  /**
   * Camping (Survival, POW-M4-23C). `at` is the camp being stood at (its tile as `x,y`) or null,
   * `acc` the ticks stood there that have not made a full minute, `used` the minutes each camp
   * has paid on its in-game day, and `sleepHour` the in-game hour of the last sleep that paid.
   */
  camp: {
    at: string | null;
    acc: number;
    used: Record<string, { day: number; min: number }>;
    sleepHour: number;
  };
  /** Trial progress by Trial id: for offered, unpassed Trials only. `n` counts, `t0` is a start tick or fight number, `bad` lists creatures hit the wrong way. */
  trial: Record<string, TrialProgress>;
  /** The current fight: its number and the tick of its latest combat (see `sim/fight.ts`). */
  fight: { id: number; last: number };
}

export interface TrialProgress {
  n: number;
  t0: number;
  bad?: number[];
  /** A `harvest` objective: the different crops harvested so far (M6-02). */
  crops?: string[];
}

export interface Stagger {
  cur: number;
  max: number;
  /** Tick of the last hit. */
  lastHit: number;
}

/** Pending knockback, spread over `ttl` ticks. Sub-pixel units per tick. */
export interface Knock {
  x: number;
  y: number;
  ttl: number;
}

/** A flying bolt. */
export interface Projectile {
  owner: number;
  team: 0 | 1;
  vx: number;
  vy: number;
  ttl: number;
  power: number;
  mult: number;
  stagger: number;
  knock: number;
  element: string;
  /** The hit applies the element's paired status (the technique's data says so). */
  applies?: boolean;
  /** Percent of the damage that heals the owner. */
  drain?: number;
}

/** Coin left behind by a death. */
export interface Echo {
  coin: number;
}

export type AiState =
  | 'idle'
  | 'wander'
  | 'notice'
  | 'approach'
  | 'leash'
  | 'flee'
  /** Territorial: a target is inside the territory and the warning is running. */
  | 'warn'
  /** Curious: following a target at its approach distance. */
  | 'follow'
  /** Skirmisher: backing off after a strike. */
  | 'retreat'
  /** Burrower: tunnelling toward its target, unhurtable. */
  | 'burrow'
  /** Burrower: risen from the ground, striking and open to hits. */
  | 'surface';

/** Creature brain. Attacking is the fighter's state machine; this decides when to start. */
export interface Ai {
  creature: string;
  state: AiState;
  /** Ticks in the current state. */
  t: number;
  /** Where it started. Leash and reset measure from here. Sub-pixel units. */
  home: Vec;
  target: number | null;
  /** Ticks before each attack (by index in the creature's list) may be used again. */
  cooldowns: number[];
  /** Phase reached: 0 at the start, up by one at each Health threshold. */
  phase: number;
  /** Wander heading, a direction 0 to 7, and the spawner that made it (or -1). */
  heading: number;
  spawner: number;
  /** Already ran away once at low Health. */
  fled: boolean;
  /**
   * Hit, or a packmate was hit, or cornered: acts as hostile until it resets at its leash. Absent
   * means false, so saves from before M4-16 load as they are.
   */
  provoked?: boolean;
  /** Skirmisher: it struck, and backs off once the strike is done. */
  skirm?: boolean;
  /**
   * Fed (M4-05): until this world tick it notices nothing and starts nothing. A hit ends it.
   * Absent means not calm, so saves from before load as they are.
   */
  calmUntil?: number;
  /**
   * A thief's take (m6): the stack it snatched and whose bag it came from. Absent means nothing
   * carried, so older saves load as they are. It comes back when the thief falls or the owner is
   * gone, so it is never lost.
   */
  loot?: { stack: ItemStack; owner: number; t: number };
  /**
   * Struck down by a Traveler (M5-04): it leaves no drops and counts no kill, so the crowd never
   * pays the player. Absent means false.
   */
  noLoot?: true;
  /** Brought by a world event (M5-11): a raid boss or an invader. */
  ev?: 'raid' | 'invasion';
}

/** Keeps `cap` of a creature alive near its position. */
export interface Spawner {
  kind: string;
  /** Ticks since a member was last missing. */
  timer: number;
  members: number[];
  /** Daily spawners (dungeons): the in-game day their last member fell. They fill again on a later day (M4-08). */
  clearedDay?: number;
}

/** Something the context button can use. `kind` names it in content. */
export interface Interactable {
  kind: string;
}

/**
 * A placed world fixture (door, plate, block, chest, portal...). Behavior comes from its kind in
 * `content/world/fixtures`. `open` is the one piece of state: opened, solved or taken.
 */
export interface Fixture {
  kind: string;
  open: boolean;
  /** Where it started, sub-pixel units. A block returns here when its room resets. */
  home: Vec;
  /** Element fixtures: the world tick when a burnt or raised piece returns to how it was. */
  until?: number;
  /** A hidden niche that has been revealed. */
  revealed?: boolean;
  /** A fixture made by a technique: it is removed when `until` passes (Earth Wall). */
  temp?: true;
  /** Arena trigger: idle, live (waves running) or done. `foes` are the creatures of the wave in play (M4-08). */
  arena?: { state: 'idle' | 'live' | 'done'; wave: number; foes: number[] };
}

/**
 * A boss encounter in progress (M4-08). The data is in `content/creatures/bosses`: this is only
 * where the fight stands.
 */
export interface Boss {
  /** Boss id in content. */
  id: string;
  /** Index of the phase in play. */
  phase: number;
  /** Position in the phase's attack pattern, and ticks to wait before the next step. */
  step: number;
  wait: number;
  /** The tick the phase began, so hazards cycle from it. */
  phaseTick: number;
  /** The avatar was already hurt by this activation of a hazard. */
  hazardHit: boolean;
  /** Events seen so far (fixture kinds that switched on), which release gates and start phases. */
  events: string[];
  /** Objective steps done. */
  done: string[];
  /** How the encounter ended, once it has. */
  resolved?: 'fight' | 'objective';
}

/** What the avatar has done with people: flags set by dialogue, and requests taken. */
export interface Journal {
  flags: string[];
  /** How each technique was learned, for those that came from a manual (M4-15). By technique id. */
  learnedVia: Record<string, 'insight' | 'manual' | 'taught'>;
  /** Hints that have been shown and are done (acted on, or expired). Never shown again. */
  hints: string[];
  /** The hint on screen now, with where and when it appeared, or null. */
  hint: { id: string; at: number; x: number; y: number } | null;
  requests: Record<string, RequestRecord>;
  /** Renown by region id (M3-11). Raised by requests, Trials and trade. */
  renown: Record<string, number>;
  /** Coin of sales by region, so every `renownTradeCoin` of it gives 1 Renown. */
  tradeCoin: Record<string, number>;
  /** The request shown on the HUD, or null for the first one under way. */
  pinned: string | null;
  /** Progress in Singulars (M4-20), by id. A Singular the avatar has not touched has no entry. */
  singulars: Record<string, SingularProgress>;
  /** What the avatar has learned of each kind of creature (M4-05), by creature id. */
  bestiary: Record<string, BestiaryEntry>;
}

/**
 * One Bestiary entry. Kills are not stored here: the ledger counts them. An entry shows once the
 * avatar has killed or befriended the kind, and says only the temperaments it has seen the kind act on.
 */
export interface BestiaryEntry {
  /** Temperaments the kind has acted on in front of the avatar, in the order seen. */
  temperaments: string[];
  /** The kind has been fed, soothed or otherwise made a friend of. */
  befriended?: boolean;
}

/**
 * Where the avatar stands in a Singular. `step` is -1 until the trigger fires, then the index of
 * the step in hand, and `steps.length` once done. `counters` holds what the step in hand has
 * counted (and, for the trigger, what it counted before it fired).
 */
export interface SingularProgress {
  step: number;
  counters: Record<string, string[]>;
  startedDay: number;
  done: boolean;
  doneDay?: number;
}

/** One request the avatar has taken (M3-11). */
export interface RequestRecord {
  state: 'active' | 'ready' | 'done';
  /** The solution that finished it. Null until it is ready. */
  solution: string | null;
  /** For each solution: the steps done, and the progress of the step in hand. */
  prog: Record<string, { step: number; p: TrialProgress }>;
  /** Count so far in the leading solution, for the log and the HUD. */
  progress: number;
  /** A standing request carries its own definition, since it is made at the board. */
  gen?: RequestDef;
  /** The in-game day it was finished, for a repeat's cooldown. */
  doneDay?: number;
}

/** A request board (M3-11): what is posted on it now, and the day it was posted. */
export interface Board {
  id: string;
  day: number;
  posted: RequestDef[];
}

/** A person standing in the world. Text and looks come from `content/dialogue`. */
export interface Npc {
  id: string;
  /** Coin the person holds for trading. Shopkeepers only. */
  purse: number;
  /** Shelf count by item. Refilled to the shop's maxima at each dawn. Shopkeepers only. */
  stock: Record<string, number>;
  /** The in-game day of the last restock, from the world clock. */
  day: number;
  /** Items this shopkeeper will not haggle on again until the next dawn (a lost haggle). */
  locked: string[];
  /** The last stacks sold here and what was paid per item, newest last. Cleared at dawn. */
  buyback: { stack: ItemStack; price: number }[];
}

/**
 * A haggle in progress (M3-10) with a shopkeeper: one item, in one direction. `open` is the
 * opening price, `cur` the price standing now, `round` the exchanges used.
 */
export interface Haggle {
  shop: string;
  item: string;
  dir: 'buy' | 'sell';
  /** Bag slot of the item being sold. -1 when buying. */
  slot: number;
  open: number;
  cur: number;
  round: number;
  rounds: number;
}

/** Components. `pos` is the feet position of a body, in sub-pixel units. */
export interface Components {
  pos: Vec;
  vel: Vec;
  body: Body;
  avatar: Avatar;
  interactable: Interactable;
  pools: Pools;
  fighter: Fighter;
  combatant: Combatant;
  stagger: Stagger;
  knock: Knock;
  projectile: Projectile;
  echo: Echo;
  ai: Ai;
  spawner: Spawner;
  skills: Skills;
  inventory: Inventory;
  storage: Storage;
  pickup: Pickup;
  node: GatherNode;
  gather: Gather;
  craft: CraftSession;
  haggle: Haggle;
  loadouts: Loadouts;
  deeds: Deeds;
  paths: Paths;
  channel: Channel;
  statuses: StatusEntry[];
  cloud: Cloud;
  fixture: Fixture;
  boss: Boss;
  journal: Journal;
  npc: Npc;
  board: Board;
}

/** A note the player left on the map (M4-06). `x` and `y` are world tiles. */
export interface MapNote {
  id: number;
  x: number;
  y: number;
  text: string;
}

/**
 * What the player knows of the map (M4-06): fog by region, notes, and the rumors heard. A rumor
 * is an id into `content/world/rumors`; where its mark is drawn comes from the Cartography rank.
 */
export interface MapState {
  /** Fog by region id. A region the avatar never entered has none. */
  fog: Record<string, Fog>;
  notes: MapNote[];
  /** The id the next note takes. Never reused, so a delete cannot make two commands collide. */
  nextNote: number;
  /** Rumor ids, in the order they were heard. */
  rumors: string[];
  /** Waystones attuned, as `region:id` keys (M4-07), in the order they were touched. */
  waystones: string[];
}

/** A map the player has not explored. */
export function newMapState(): MapState {
  return { fog: {}, notes: [], nextNote: 1, rumors: [], waystones: [] };
}

/** Everything that is saved. Plain, serializable data. */
export interface SimState {
  /** Master seed the sim started from. */
  seed: number;
  tick: number;
  /** Transient. The world clock's tick from trusted time, set each step. Not saved. */
  worldTick: number;
  rng: RngStreams;
  entities: EntityStore<Components>;
  /** Lifetime totals for the integrity check (tech/02). Saved. */
  ledger: Ledger;
  /** What the player changed in each chunk, by chunk key (M4-03). Saved. */
  deltas: Deltas;
  /** Fog, notes and rumors (M4-06). Saved. */
  map: MapState;
  /** The 240 Travelers' lives (M5-02). Saved as a compact binary section. Identity is derived from `seed`. */
  travelers: TravelerLife[];
  /** Letters, the duel record and dungeon entries (M5-12). Saved. */
  mail: Mailbox;
  /** The player's guild, the stashes and this week's goals (M5-08). Saved. */
  guild: GuildState;
  /** The market's prices, history and the player's listings (M5-10). Saved. */
  market: MarketState;
  /** The last world event fired per kind, and the last raid paid (M5-11). Saved. */
  calendar: CalendarState;
  /** The reeve's field, the seeds the player knows, the water in the can (M6-02). Saved. */
  farm: FarmState;
  /** What the player has landed, and whether Old Gnarl is caught (M6-05). */
  fishing: FishingState;
  /** Transient. World events running now (M5-11): rebuilt from the calendar after a load. */
  worldEvents?: WorldEventsState | undefined;
  /** Transient. A market day is on (M5-11 sets it): more demand and more Traveler stock. */
  marketDay?: boolean;
  /** Transient. What the player bought from Traveler listings this session (M5-10). */
  marketTaken?: Map<string, number>;
  /** The party, if any (M5-07). Session only: never saved, so a party in progress at close is gone. */
  party?: import('./party').Party | undefined;
  /** Bouts at the Pit (M5-30). Session only: never saved. */
  pitBouts?: import('./pitBouts').PitState | undefined;
  /** The duel in progress, if any (M5-12). Session only: never saved. */
  duel?: DuelState | undefined;
  /** Transient. Excluded from serialization and hashing. */
  events: EventQueue;
  /** Transient. The tile collision source for the current area. Null in demos with no map. */
  world: CollisionGrid | null;
  /** Transient. The region being played, for its weather table. Absent means the slice. */
  region?: string;
  /** Transient. Dev only: forces the weather, for screenshots and tests. */
  weatherOverride?: import('../content/balance/time').Weather;
  /** Transient. Real time from the platform (M5-03). Absent in tests and demos: the crowd then sleeps. */
  clock?: ClockInput;
  /** Transient. Who is online and what they are doing (M5-03). Made on first use. */
  crowd?: Crowd;
  /** Transient. Chat budget, repeat window and queued lines (M5-05). Made on first use. */
  chat?: ChatState;
  /** Transient. Where the player last stood on each board (M5-09), so a pass is announced once. */
  rankings?: RankingsMemo;
  /** Transient. Chunk streaming state, or absent when the whole map is resident (tests). */
  stream?: StreamState | null;
}

/** Every component name, in a fixed order. */
export const COMPONENT_KEYS: readonly (keyof Components)[] = [
  'pos',
  'vel',
  'body',
  'avatar',
  'interactable',
  'pools',
  'fighter',
  'combatant',
  'stagger',
  'knock',
  'projectile',
  'echo',
  'ai',
  'spawner',
  'skills',
  'inventory',
  'storage',
  'pickup',
  'node',
  'gather',
  'craft',
  'haggle',
  'loadouts',
  'deeds',
  'paths',
  'channel',
  'statuses',
  'cloud',
  'fixture',
  'boss',
  'journal',
  'npc',
  'board',
];

/** Demo box size in sub-pixel units. */
export const DEMO_BOX: Vec = { x: px(1024), y: px(1024) };

/** Creates a demo state with `entityCount` entities drifting in the box. */
export function createDemoState(seed: number, entityCount: number): SimState {
  const state: SimState = {
    seed: seed >>> 0,
    tick: 0,
    worldTick: 0,
    rng: createStreams(seed),
    entities: createStore<Components>(COMPONENT_KEYS),
    ledger: newLedger(),
    deltas: {},
    map: newMapState(),
    travelers: initialLives(seed),
    mail: newMailbox(),
    guild: newGuildState(),
    market: newMarket(),
    calendar: newCalendar(),
    farm: newFarm(),
    fishing: newFishing(),
    events: createEventQueue(),
    world: null,
  };
  for (let i = 0; i < entityCount; i++) {
    const id = spawn(state.entities);
    setComp(state.entities, id, 'pos', {
      x: int(state.rng.world, 0, DEMO_BOX.x),
      y: int(state.rng.world, 0, DEMO_BOX.y),
    });
    setComp(state.entities, id, 'vel', {
      x: int(state.rng.world, -128, 128),
      y: int(state.rng.world, -128, 128),
    });
  }
  return state;
}

/** Stable JSON text: object keys sorted, undefined properties dropped. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(',')}}`;
}

/**
 * The entity store as it is saved. Promoted Travelers (M5-04) are rebuilt from their lives, so
 * they never go into a save: a copy without them is written when any exist.
 */
function entitiesForSave(state: SimState): EntityStore<Components> {
  const kinds = state.entities.comps.interactable;
  let any = false;
  for (let i = 0; i < kinds.length && !any; i++)
    any = !!state.entities.alive[i] && (kinds[i]?.kind.startsWith('traveler:') ?? false);
  if (!any) return state.entities;
  const copy = structuredClone(state.entities);
  for (let i = 0; i < kinds.length; i++)
    if (copy.alive[i] && copy.comps.interactable[i]?.kind.startsWith('traveler:')) destroy(copy, i);
  return copy;
}

function persistent(state: SimState): Omit<
  SimState,
  'events' | 'world' | 'worldTick' | 'stream' | 'travelers'
> & {
  travelers: string | undefined;
} {
  return {
    seed: state.seed,
    tick: state.tick,
    rng: state.rng,
    entities: entitiesForSave(state),
    ledger: state.ledger,
    deltas: state.deltas,
    map: state.map,
    // Absent only in tests that take the field off to compare a hash with an older fixture's.
    travelers: state.travelers ? livesToText(state.travelers) : undefined,
    mail: state.mail,
    guild: state.guild,
    market: state.market,
    calendar: state.calendar,
    farm: state.farm,
    fishing: state.fishing,
  };
}

/** Canonical string form of the saved state. Key order is sorted, so it is stable. */
export function serializeState(state: SimState): string {
  return canonical(persistent(state));
}

/** Rebuilds a state from {@link serializeState} output. Round trip is exact. */
export function deserializeState(text: string, world: CollisionGrid | null = null): SimState {
  const raw = JSON.parse(text) as Omit<
    SimState,
    'events' | 'world' | 'ledger' | 'worldTick' | 'deltas' | 'map' | 'stream' | 'travelers'
  > & {
    ledger?: Ledger;
    deltas?: Deltas;
    map?: MapState;
    travelers?: string;
    mail?: Mailbox;
    guild?: GuildState;
    market?: MarketState;
    calendar?: CalendarState;
    farm?: FarmState;
    fishing?: FishingState;
  };
  if (
    typeof raw?.tick !== 'number' ||
    typeof raw.seed !== 'number' ||
    !raw.rng ||
    !raw.entities?.comps
  ) {
    throw new Error('malformed sim state');
  }
  // A state written before the ledger existed has none. The save migration seeds the real one.
  return {
    ...raw,
    worldTick: raw.tick,
    ledger: raw.ledger ?? newLedger(),
    deltas: raw.deltas ?? {},
    map: raw.map ?? newMapState(),
    // A state from before Travelers has none: they start as a fresh generation from the seed.
    travelers: raw.travelers === undefined ? initialLives(raw.seed) : livesFromText(raw.travelers),
    // A state from before the mailbox has an empty one.
    mail: normalMailbox(raw.mail),
    // A state from before guilds has none: no guild, no stash.
    guild: raw.guild ?? newGuildState(),
    // A state from before the market has none: it opens at the target prices on the first hour.
    market: raw.market ?? newMarket(),
    // A state from before world events has fired none: the next slot fires at its time.
    calendar: raw.calendar ?? newCalendar(),
    // A state from before farming has an unleased, untilled field and a full can.
    farm: normalFarm(raw.farm),
    // A state from before the minigame has landed nothing and met no legend.
    fishing: normalFishing(raw.fishing),
    events: createEventQueue(),
    world,
  };
}

/** Stable 53-bit hash of the saved state, as 14 hex chars. For tests and save checks. */
export function hashState(state: SimState): string {
  const s = serializeState(state);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
