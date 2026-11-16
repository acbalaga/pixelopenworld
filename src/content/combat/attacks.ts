/** Attack and technique data. Hitboxes are shapes in the attacker's aim frame, active on listed ticks. */

/** A hit region. Measured from the attacker's feet, along the aim vector. All px. */
export type HitShape =
  /** Wedge: reach in px and a half angle given as cos * 256 (128 is 60 degrees). */
  | { kind: 'arc'; reach: number; cos256: number }
  /** Corridor: how far ahead it reaches and how wide it is each side of the aim line. */
  | { kind: 'line'; reach: number; halfWidth: number };

export type Family = 'blades' | 'polearms' | 'creature';

/** One attack. `windup` is the telegraph: the hit shape is dangerous only during `active`. */
export interface AttackDef {
  id: string;
  family: Family;
  windup: number;
  active: number;
  recover: number;
  /** Damage multiplier, percent of weapon power. */
  mult: number;
  /** Stagger bar points added on hit. */
  stagger: number;
  /** Knockback distance, px. */
  knock: number;
  shape: HitShape;
  /** Pierces: the hit shape can reach more than one target. Otherwise the first in line only. */
  pierce?: boolean;
  /** Dash during windup and active, px along aim. For lunges. */
  dash?: number;
  /** Cost, in tenths, and the pool it draws from. Basic attacks cost nothing. */
  cost?: { pool: 'sta' | 'foc'; amount: number };
  /** Heavy hits add to hit pause. */
  heavy?: boolean;
}

export const ATTACKS: Readonly<Record<string, AttackDef>> = {
  'attack.sword_slash': {
    id: 'attack.sword_slash',
    family: 'blades',
    windup: 4,
    active: 2,
    recover: 4,
    mult: 100,
    stagger: 8,
    knock: 6,
    shape: { kind: 'arc', reach: 24, cos256: 100 },
  },
  'attack.sword_combo_1': {
    id: 'attack.sword_combo_1',
    family: 'blades',
    windup: 3,
    active: 2,
    recover: 5,
    mult: 100,
    stagger: 8,
    knock: 5,
    shape: { kind: 'arc', reach: 24, cos256: 100 },
  },
  'attack.sword_combo_2': {
    id: 'attack.sword_combo_2',
    family: 'blades',
    windup: 3,
    active: 2,
    recover: 5,
    mult: 100,
    stagger: 8,
    knock: 5,
    shape: { kind: 'arc', reach: 24, cos256: 100 },
  },
  'attack.sword_combo_3': {
    id: 'attack.sword_combo_3',
    family: 'blades',
    windup: 4,
    active: 3,
    recover: 7,
    mult: 160,
    stagger: 16,
    knock: 12,
    shape: { kind: 'arc', reach: 26, cos256: 90 },
    heavy: true,
  },
  'attack.spear_thrust': {
    id: 'attack.spear_thrust',
    family: 'polearms',
    windup: 6,
    active: 2,
    recover: 6,
    mult: 100,
    stagger: 6,
    knock: 10,
    shape: { kind: 'line', reach: 40, halfWidth: 7 },
    pierce: true,
  },
  'attack.spear_combo_1': {
    id: 'attack.spear_combo_1',
    family: 'polearms',
    windup: 5,
    active: 2,
    recover: 6,
    mult: 90,
    stagger: 6,
    knock: 8,
    shape: { kind: 'line', reach: 40, halfWidth: 7 },
    pierce: true,
  },
  'attack.spear_combo_2': {
    id: 'attack.spear_combo_2',
    family: 'polearms',
    windup: 5,
    active: 2,
    recover: 6,
    mult: 90,
    stagger: 6,
    knock: 8,
    shape: { kind: 'line', reach: 40, halfWidth: 7 },
    pierce: true,
  },
  'attack.spear_combo_3': {
    id: 'attack.spear_combo_3',
    family: 'polearms',
    windup: 7,
    active: 3,
    recover: 8,
    mult: 150,
    stagger: 10,
    knock: 16,
    shape: { kind: 'line', reach: 44, halfWidth: 8 },
    pierce: true,
    heavy: true,
  },
  /** Blades technique: a fast dash that cuts through whoever it reaches. */
  'technique.blades_lunge': {
    id: 'technique.blades_lunge',
    family: 'blades',
    windup: 3,
    active: 4,
    recover: 6,
    mult: 170,
    stagger: 14,
    knock: 8,
    shape: { kind: 'line', reach: 22, halfWidth: 9 },
    dash: 40,
    cost: { pool: 'sta', amount: 250 },
    heavy: true,
  },
  /** Ember technique: casting only. The bolt itself is a projectile. */
  'technique.ember_bolt': {
    id: 'technique.ember_bolt',
    family: 'blades',
    windup: 6,
    active: 1,
    recover: 6,
    mult: 130,
    stagger: 6,
    knock: 6,
    shape: { kind: 'line', reach: 0, halfWidth: 0 },
    cost: { pool: 'foc', amount: 300 },
  },
  /** A common creature's swipe. Telegraph of 12 ticks is 400 ms, above the 350 ms tier 1 minimum. */
  'attack.creature_swipe': {
    id: 'attack.creature_swipe',
    family: 'creature',
    windup: 12,
    active: 2,
    recover: 10,
    mult: 100,
    stagger: 0,
    knock: 8,
    shape: { kind: 'arc', reach: 20, cos256: 100 },
  },
};

/** What a weapon family does. */
export interface WeaponDef {
  id: string;
  family: Family;
  /** Base damage before multipliers. */
  power: number;
  /** The swing Flow repeats automatically. */
  auto: string;
  /** The Classic combo, in order. */
  combo: readonly [string, string, string];
  /** Ticks near the end of recovery during which the next combo press chains. */
  chainWindow: number;
  /** Reach used to decide whether Flow has a target. */
  reach: number;
}

export const WEAPONS: Readonly<Record<string, WeaponDef>> = {
  sword: {
    id: 'sword',
    family: 'blades',
    power: 10,
    auto: 'attack.sword_slash',
    combo: ['attack.sword_combo_1', 'attack.sword_combo_2', 'attack.sword_combo_3'],
    chainWindow: 4,
    reach: 24,
  },
  spear: {
    id: 'spear',
    family: 'polearms',
    power: 11,
    auto: 'attack.spear_thrust',
    combo: ['attack.spear_combo_1', 'attack.spear_combo_2', 'attack.spear_combo_3'],
    chainWindow: 4,
    reach: 40,
  },
  /** What a common creature fights with. */
  claws: {
    id: 'claws',
    family: 'creature',
    power: 8,
    auto: 'attack.creature_swipe',
    combo: ['attack.creature_swipe', 'attack.creature_swipe', 'attack.creature_swipe'],
    chainWindow: 0,
    reach: 20,
  },
};

/** A technique: an attack that is used from a slot, with a cooldown. */
export interface TechniqueDef {
  id: string;
  attack: string;
  /** Hold to aim, release to fire. */
  aimed: boolean;
  cooldown: number;
  /** Projectile launched when the cast completes its windup, if any. */
  projectile?: { speed: number; ttl: number; element: string };
}

export const TECHNIQUES: Readonly<Record<string, TechniqueDef>> = {
  'technique.blades_lunge': {
    id: 'technique.blades_lunge',
    attack: 'technique.blades_lunge',
    aimed: false,
    cooldown: 45,
  },
  'technique.ember_bolt': {
    id: 'technique.ember_bolt',
    attack: 'technique.ember_bolt',
    aimed: true,
    cooldown: 60,
    projectile: { speed: 5, ttl: 40, element: 'ember' },
  },
};
