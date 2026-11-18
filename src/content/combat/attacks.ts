/** Attack and technique data. Hitboxes are shapes in the attacker's aim frame, active on listed ticks. */

/** A hit region. Measured from the attacker's feet, along the aim vector. All px. */
export type HitShape =
  /** Wedge: reach in px and a half angle given as cos * 256 (128 is 60 degrees). */
  | { kind: 'arc'; reach: number; cos256: number }
  /** Corridor: how far ahead it reaches and how wide it is each side of the aim line. */
  | { kind: 'line'; reach: number; halfWidth: number }
  /** Everything within `radius` of the attacker. Used for slams, with a ground marker. */
  | { kind: 'circle'; radius: number };

export type Family = 'blades' | 'heavy' | 'polearms' | 'archery' | 'unarmed' | 'creature';

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
  /** Dash during the active frames, px along aim. For lunges and charges. */
  dash?: number;
  /** A melee attack that carries an element (ember, tide, gale, stone, mending, hexing). */
  element?: string;
  /** A hit applies its element's paired status (`ELEMENT_STATUS`). Set per technique by data. */
  applies?: boolean;
  /** Launches a projectile when the active frames begin (spells, spat seeds). */
  projectile?: { speed: number; ttl: number; element: string };
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
    mult: 150,
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
    mult: 135,
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
    mult: 135,
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
    mult: 225,
    stagger: 10,
    knock: 16,
    shape: { kind: 'line', reach: 44, halfWidth: 8 },
    pierce: true,
    heavy: true,
  },
  /** Heavy Arms: slow and wide. The arc reaches well past the sides, the stagger is large. */
  'attack.maul_swing': {
    id: 'attack.maul_swing',
    family: 'heavy',
    windup: 10,
    active: 3,
    recover: 9,
    mult: 170,
    stagger: 14,
    knock: 10,
    shape: { kind: 'arc', reach: 26, cos256: 40 },
    heavy: true,
  },
  'attack.maul_combo_1': {
    id: 'attack.maul_combo_1',
    family: 'heavy',
    windup: 8,
    active: 3,
    recover: 9,
    mult: 160,
    stagger: 14,
    knock: 8,
    shape: { kind: 'arc', reach: 26, cos256: 40 },
    heavy: true,
  },
  'attack.maul_combo_2': {
    id: 'attack.maul_combo_2',
    family: 'heavy',
    windup: 8,
    active: 3,
    recover: 9,
    mult: 160,
    stagger: 14,
    knock: 8,
    shape: { kind: 'arc', reach: 26, cos256: 40 },
    heavy: true,
  },
  'attack.maul_combo_3': {
    id: 'attack.maul_combo_3',
    family: 'heavy',
    windup: 11,
    active: 3,
    recover: 12,
    mult: 260,
    stagger: 26,
    knock: 16,
    shape: { kind: 'arc', reach: 28, cos256: 20 },
    heavy: true,
  },
  /** Archery: the arrow is a projectile. Its damage follows how long the archer stood still. */
  'attack.bow_shot': {
    id: 'attack.bow_shot',
    family: 'archery',
    windup: 8,
    active: 1,
    recover: 8,
    mult: 140,
    stagger: 4,
    knock: 4,
    shape: { kind: 'line', reach: 0, halfWidth: 0 },
    projectile: { speed: 5, ttl: 36, element: 'archery' },
  },
  'attack.bow_combo_1': {
    id: 'attack.bow_combo_1',
    family: 'archery',
    windup: 7,
    active: 1,
    recover: 8,
    mult: 140,
    stagger: 4,
    knock: 4,
    shape: { kind: 'line', reach: 0, halfWidth: 0 },
    projectile: { speed: 5, ttl: 36, element: 'archery' },
  },
  'attack.bow_combo_2': {
    id: 'attack.bow_combo_2',
    family: 'archery',
    windup: 7,
    active: 1,
    recover: 8,
    mult: 140,
    stagger: 4,
    knock: 4,
    shape: { kind: 'line', reach: 0, halfWidth: 0 },
    projectile: { speed: 5, ttl: 36, element: 'archery' },
  },
  'attack.bow_combo_3': {
    id: 'attack.bow_combo_3',
    family: 'archery',
    windup: 9,
    active: 1,
    recover: 11,
    mult: 196,
    stagger: 8,
    knock: 8,
    shape: { kind: 'line', reach: 0, halfWidth: 0 },
    projectile: { speed: 6, ttl: 36, element: 'archery' },
  },
  /** Bare hands: quick, short, light. Used whenever nothing is held. */
  'attack.fist_jab': {
    id: 'attack.fist_jab',
    family: 'unarmed',
    windup: 3,
    active: 2,
    recover: 4,
    mult: 100,
    stagger: 5,
    knock: 4,
    shape: { kind: 'arc', reach: 16, cos256: 100 },
  },
  'attack.fist_combo_1': {
    id: 'attack.fist_combo_1',
    family: 'unarmed',
    windup: 3,
    active: 2,
    recover: 4,
    mult: 100,
    stagger: 5,
    knock: 3,
    shape: { kind: 'arc', reach: 16, cos256: 100 },
  },
  'attack.fist_combo_2': {
    id: 'attack.fist_combo_2',
    family: 'unarmed',
    windup: 3,
    active: 2,
    recover: 4,
    mult: 110,
    stagger: 5,
    knock: 3,
    shape: { kind: 'arc', reach: 16, cos256: 100 },
  },
  'attack.fist_combo_3': {
    id: 'attack.fist_combo_3',
    family: 'unarmed',
    windup: 4,
    active: 2,
    recover: 7,
    mult: 140,
    stagger: 10,
    knock: 8,
    shape: { kind: 'arc', reach: 18, cos256: 100 },
  },
  /** Wrapped fists: the bare-hand swings, with more behind them. */
  'attack.wraps_jab': {
    id: 'attack.wraps_jab',
    family: 'unarmed',
    windup: 3,
    active: 2,
    recover: 4,
    mult: 150,
    stagger: 5,
    knock: 4,
    shape: { kind: 'arc', reach: 16, cos256: 100 },
  },
  'attack.wraps_combo_1': {
    id: 'attack.wraps_combo_1',
    family: 'unarmed',
    windup: 3,
    active: 2,
    recover: 4,
    mult: 150,
    stagger: 5,
    knock: 3,
    shape: { kind: 'arc', reach: 16, cos256: 100 },
  },
  'attack.wraps_combo_2': {
    id: 'attack.wraps_combo_2',
    family: 'unarmed',
    windup: 3,
    active: 2,
    recover: 4,
    mult: 165,
    stagger: 5,
    knock: 3,
    shape: { kind: 'arc', reach: 16, cos256: 100 },
  },
  'attack.wraps_combo_3': {
    id: 'attack.wraps_combo_3',
    family: 'unarmed',
    windup: 4,
    active: 2,
    recover: 7,
    mult: 210,
    stagger: 10,
    knock: 8,
    shape: { kind: 'arc', reach: 18, cos256: 100 },
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
  /** Polearms technique: a stepping thrust that runs the whole line through. Longer and narrower than the blades lunge. */
  'technique.polearms_lunge': {
    id: 'technique.polearms_lunge',
    family: 'polearms',
    windup: 4,
    active: 3,
    recover: 7,
    mult: 160,
    stagger: 12,
    knock: 14,
    shape: { kind: 'line', reach: 34, halfWidth: 7 },
    dash: 28,
    cost: { pool: 'sta', amount: 250 },
    pierce: true,
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
    projectile: { speed: 5, ttl: 40, element: 'ember' },
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
  /** A Shooter's seed. The 14 tick wind-up (467 ms) is the telegraph. */
  'attack.spitbloom_seed': {
    id: 'attack.spitbloom_seed',
    family: 'creature',
    windup: 14,
    active: 1,
    recover: 14,
    mult: 90,
    stagger: 0,
    knock: 6,
    shape: { kind: 'line', reach: 0, halfWidth: 0 },
    projectile: { speed: 3.5, ttl: 40, element: 'none' },
  },
  /** A Charger's close attack. */
  'attack.boar_gore': {
    id: 'attack.boar_gore',
    family: 'creature',
    windup: 12,
    active: 2,
    recover: 12,
    mult: 100,
    stagger: 0,
    knock: 10,
    shape: { kind: 'arc', reach: 20, cos256: 100 },
  },
  /** The charge: a long wind-up while it paws the ground, then a straight rush. */
  'attack.boar_charge': {
    id: 'attack.boar_charge',
    family: 'creature',
    windup: 18,
    active: 8,
    recover: 30,
    mult: 130,
    stagger: 0,
    knock: 16,
    shape: { kind: 'line', reach: 12, halfWidth: 8 },
    dash: 88,
    heavy: true,
  },
  'attack.boss_gore': {
    id: 'attack.boss_gore',
    family: 'creature',
    windup: 13,
    active: 3,
    recover: 14,
    mult: 100,
    stagger: 0,
    knock: 14,
    shape: { kind: 'arc', reach: 30, cos256: 90 },
    heavy: true,
  },
  'attack.boss_charge': {
    id: 'attack.boss_charge',
    family: 'creature',
    windup: 20,
    active: 10,
    recover: 34,
    mult: 140,
    stagger: 0,
    knock: 22,
    shape: { kind: 'line', reach: 18, halfWidth: 14 },
    dash: 140,
    heavy: true,
  },
  /** Phase two: it rears and slams. The ground marker is the circle. */
  'attack.boss_slam': {
    id: 'attack.boss_slam',
    family: 'creature',
    windup: 24,
    active: 2,
    recover: 22,
    mult: 160,
    stagger: 0,
    knock: 20,
    shape: { kind: 'circle', radius: 44 },
    heavy: true,
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
  /** The lunge every weapon of this family gives its holder, in slot 1. Null for none. */
  lunge: string | null;
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
    lunge: 'technique.blades_lunge',
  },
  spear: {
    id: 'spear',
    family: 'polearms',
    power: 11,
    auto: 'attack.spear_thrust',
    combo: ['attack.spear_combo_1', 'attack.spear_combo_2', 'attack.spear_combo_3'],
    chainWindow: 4,
    reach: 40,
    lunge: 'technique.polearms_lunge',
  },
  /** What the avatar fights with when nothing is held. */
  fists: {
    id: 'fists',
    family: 'unarmed',
    power: 5,
    auto: 'attack.fist_jab',
    combo: ['attack.fist_combo_1', 'attack.fist_combo_2', 'attack.fist_combo_3'],
    chainWindow: 4,
    reach: 16,
    lunge: null,
  },
  /** Heavy Arms. */
  maul: {
    id: 'maul',
    family: 'heavy',
    power: 12,
    auto: 'attack.maul_swing',
    combo: ['attack.maul_combo_1', 'attack.maul_combo_2', 'attack.maul_combo_3'],
    chainWindow: 5,
    reach: 26,
    lunge: null,
  },
  /** Archery. Reach is its range: the arrow flies speed times ttl px. */
  bow: {
    id: 'bow',
    family: 'archery',
    power: 10,
    auto: 'attack.bow_shot',
    combo: ['attack.bow_combo_1', 'attack.bow_combo_2', 'attack.bow_combo_3'],
    chainWindow: 4,
    reach: 120,
    lunge: null,
  },
  /** Wrapped fists: the bare-hand swings with a little more behind them. */
  wraps: {
    id: 'wraps',
    family: 'unarmed',
    power: 7,
    auto: 'attack.wraps_jab',
    combo: ['attack.wraps_combo_1', 'attack.wraps_combo_2', 'attack.wraps_combo_3'],
    chainWindow: 4,
    reach: 16,
    lunge: null,
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
    lunge: null,
  },
};

/** A technique: an attack that is used from a slot, with a cooldown. */
export interface TechniqueDef {
  id: string;
  attack: string;
  /** Hold to aim, release to fire. */
  aimed: boolean;
  cooldown: number;
  /** Button icon sprite id. */
  icon: string;
}

export const TECHNIQUES: Readonly<Record<string, TechniqueDef>> = {
  'technique.blades_lunge': {
    id: 'technique.blades_lunge',
    attack: 'technique.blades_lunge',
    aimed: false,
    cooldown: 45,
    icon: 'ui.icon_lunge',
  },
  'technique.polearms_lunge': {
    id: 'technique.polearms_lunge',
    attack: 'technique.polearms_lunge',
    aimed: false,
    cooldown: 45,
    icon: 'ui.icon_lunge',
  },
  'technique.ember_bolt': {
    id: 'technique.ember_bolt',
    attack: 'technique.ember_bolt',
    aimed: true,
    cooldown: 60,
    icon: 'ui.icon_ember',
  },
};
