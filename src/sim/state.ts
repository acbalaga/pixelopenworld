import { createStore, spawn, setComp, type EntityStore } from './kernel/entities';
import { createEventQueue, type EventQueue } from './kernel/events';
import { createStreams, int, type RngStreams } from './kernel/rng';
import { px, type Direction, type Vec } from './kernel/fixed';
import type { CollisionGrid } from './systems/collision';
import type { EquipSlot } from '../content/items/types';
import { newLedger, type Ledger } from './ledger';

/** Collision body, centered on `pos` horizontally and standing on it vertically. Sub-pixel units. */
export interface Body {
  w: number;
  h: number;
  /** Blocks other bodies. Avatars and creatures check against solid bodies. */
  solid: boolean;
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
}

/** The bag, what is worn, and the recipes the avatar knows. Coin is `avatar.coin`, not a slot. */
export interface Inventory {
  slots: (ItemStack | null)[];
  equipment: Record<EquipSlot, string | null>;
  recipes: string[];
}

/** An item lying in the world. `age` counts ticks since it popped out. */
export interface Pickup {
  item: string;
  qty: number;
  age: number;
  /** Told the player the bag was full, so it says so once. */
  blocked: boolean;
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
}

/** The Fed buff from a meal. Bonuses to the pool maxima until `until`. One at a time. */
export interface Fed {
  item: string;
  until: number;
  hpMax: number;
  staMax: number;
  focMax: number;
}

/** Skill points and Trial progress for the avatar. Every key is a skill id from content. */
export interface Skills {
  /** Points 0 to 100. A skill with no entry has 0. */
  points: Record<string, number>;
  /** XP toward the next point. Held in the bank while the next point waits on a Trial. */
  xp: Record<string, number>;
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
}

/** Coin left behind by a death. */
export interface Echo {
  coin: number;
}

export type AiState = 'idle' | 'wander' | 'notice' | 'approach' | 'leash' | 'flee';

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
}

/** Keeps `cap` of a creature alive near its position. */
export interface Spawner {
  kind: string;
  /** Ticks since a member was last missing. */
  timer: number;
  members: number[];
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
}

/** What the avatar has done with people: flags set by dialogue, and requests taken. */
export interface Journal {
  flags: string[];
  /** Hints that have been shown and are done (acted on, or expired). Never shown again. */
  hints: string[];
  /** The hint on screen now, with where and when it appeared, or null. */
  hint: { id: string; at: number; x: number; y: number } | null;
  requests: Record<string, { state: 'active' | 'ready' | 'done'; progress: number }>;
}

/** A person standing in the world. Text and looks come from `content/dialogue`. */
export interface Npc {
  id: string;
  /** Coin the person holds for trading. Shopkeepers only. */
  purse: number;
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
  pickup: Pickup;
  node: GatherNode;
  gather: Gather;
  fed: Fed;
  fixture: Fixture;
  journal: Journal;
  npc: Npc;
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
  /** Transient. Excluded from serialization and hashing. */
  events: EventQueue;
  /** Transient. The tile collision source for the current area. Null in demos with no map. */
  world: CollisionGrid | null;
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
  'pickup',
  'node',
  'gather',
  'fed',
  'fixture',
  'journal',
  'npc',
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

function persistent(state: SimState): Omit<SimState, 'events' | 'world' | 'worldTick'> {
  return {
    seed: state.seed,
    tick: state.tick,
    rng: state.rng,
    entities: state.entities,
    ledger: state.ledger,
  };
}

/** Canonical string form of the saved state. Key order is sorted, so it is stable. */
export function serializeState(state: SimState): string {
  return canonical(persistent(state));
}

/** Rebuilds a state from {@link serializeState} output. Round trip is exact. */
export function deserializeState(text: string, world: CollisionGrid | null = null): SimState {
  const raw = JSON.parse(text) as Omit<SimState, 'events' | 'world' | 'ledger' | 'worldTick'> & {
    ledger?: Ledger;
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
