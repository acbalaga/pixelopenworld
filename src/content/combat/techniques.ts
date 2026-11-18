import { TECHNIQUE_BALANCE as TB } from '../balance/techniques';
import type { Mod } from '../items/affixes';
import type { Family } from './attacks';
import type { StatusId } from './statuses';

/** What a technique does besides the hit its attack carries. */
export type TechniqueEffect =
  /** A status on the caster. `ticks` overrides the status's own length. */
  | { kind: 'selfStatus'; status: StatusId; ticks?: number }
  /** A temporary solid fixture `ahead` px in front of the caster, for `ticks` (Earth Wall). */
  | { kind: 'spawnFixture'; fixture: string; ahead: number; ticks: number }
  /** The caster lands behind the locked target (Shadowstep). */
  | { kind: 'shadowstep' }
  /** At the end of the channel, creatures in range of `maxTier` or lower are Dazed (Lullaby). */
  | { kind: 'dazeNear'; radius: number; maxTier: number; ticks: number };

export interface TechniqueDef {
  /** `technique.<skill>_<name>`. */
  id: string;
  skill: string;
  band: 0 | 15 | 30 | 50 | 75 | 100;
  nameKey: string;
  descKey: string;
  /** Sprite id in the ui atlas. */
  icon: string;
  kind: 'active' | 'passive';
  /** Also needs a `learnTechnique` effect, not only the rank. */
  taught?: true;
  cost?: { pool: 'sta' | 'foc'; amount: number };
  /** Ticks before it can be used again. */
  cooldown?: number;
  /** How it is aimed. `line` is held to aim and released to fire. */
  aim?: 'none' | 'cone' | 'line' | 'circle' | 'target' | 'self';
  /** The AttackDef with the hit data. */
  attack?: string;
  requires?: {
    main?: Family;
    off?: 'shield' | 'instrument';
    outOfCombat?: true;
    hidden?: true;
    target?: true;
  };
  effects?: readonly TechniqueEffect[];
  passive?: readonly Mod[];
  /** Ticks of channel, for songs. Moving or being hurt cancels it. */
  channel?: number;
}

/** Items that count as an instrument in the off hand. */
export const INSTRUMENTS: readonly string[] = ['item.flute_reed'];

const LIST: readonly TechniqueDef[] = [
  // ---- Arms ----
  {
    id: 'technique.blades_lunge',
    skill: 'skill.blades',
    band: 0,
    ...text('blades_lunge'),
    icon: 'ui.icon_lunge',
    kind: 'active',
    cost: { pool: 'sta', amount: 250 },
    cooldown: 45,
    aim: 'cone',
    attack: 'technique.blades_lunge',
    requires: { main: 'blades' },
  },
  {
    id: 'technique.blades_crosscut',
    skill: 'skill.blades',
    band: 15,
    ...text('blades_crosscut'),
    icon: 'ui.icon_attack',
    kind: 'active',
    cost: { pool: 'sta', amount: 300 },
    cooldown: 60,
    aim: 'cone',
    attack: 'technique.blades_crosscut',
    requires: { main: 'blades' },
  },
  {
    id: 'technique.heavy_overhead',
    skill: 'skill.heavy_arms',
    band: 0,
    ...text('heavy_overhead'),
    icon: 'ui.icon_slam',
    kind: 'active',
    cost: { pool: 'sta', amount: 350 },
    cooldown: 90,
    aim: 'circle',
    attack: 'technique.heavy_overhead',
    requires: { main: 'heavy' },
  },
  {
    id: 'technique.heavy_whirl',
    skill: 'skill.heavy_arms',
    band: 15,
    ...text('heavy_whirl'),
    icon: 'ui.icon_whirl',
    kind: 'active',
    cost: { pool: 'sta', amount: 500 },
    cooldown: 120,
    aim: 'circle',
    attack: 'technique.heavy_whirl',
    requires: { main: 'heavy' },
  },
  {
    id: 'technique.polearms_lunge',
    skill: 'skill.polearms',
    band: 0,
    ...text('polearms_lunge'),
    icon: 'ui.icon_lunge',
    kind: 'active',
    cost: { pool: 'sta', amount: 250 },
    cooldown: 45,
    aim: 'cone',
    attack: 'technique.polearms_lunge',
    requires: { main: 'polearms' },
  },
  {
    id: 'technique.polearms_sweep',
    skill: 'skill.polearms',
    band: 15,
    ...text('polearms_sweep'),
    icon: 'ui.icon_whirl',
    kind: 'active',
    cost: { pool: 'sta', amount: 300 },
    cooldown: 70,
    aim: 'cone',
    attack: 'technique.polearms_sweep',
    requires: { main: 'polearms' },
  },
  {
    id: 'technique.archery_aimed',
    skill: 'skill.archery',
    band: 0,
    ...text('archery_aimed'),
    icon: 'ui.icon_arrow',
    kind: 'active',
    cost: { pool: 'sta', amount: 300 },
    cooldown: 60,
    aim: 'line',
    attack: 'technique.archery_aimed',
    requires: { main: 'archery' },
  },
  {
    id: 'technique.archery_scatter',
    skill: 'skill.archery',
    band: 15,
    ...text('archery_scatter'),
    icon: 'ui.icon_arrow',
    kind: 'active',
    cost: { pool: 'sta', amount: 400 },
    cooldown: 90,
    aim: 'cone',
    attack: 'technique.archery_scatter',
    requires: { main: 'archery' },
  },
  {
    id: 'technique.unarmed_palm',
    skill: 'skill.unarmed',
    band: 0,
    ...text('unarmed_palm'),
    icon: 'ui.icon_palm',
    kind: 'active',
    cost: { pool: 'sta', amount: 200 },
    cooldown: 40,
    aim: 'cone',
    attack: 'technique.unarmed_palm',
    requires: { main: 'unarmed' },
  },
  {
    id: 'technique.unarmed_flurry',
    skill: 'skill.unarmed',
    band: 15,
    ...text('unarmed_flurry'),
    icon: 'ui.icon_palm',
    kind: 'active',
    cost: { pool: 'sta', amount: 400 },
    cooldown: 100,
    aim: 'cone',
    attack: 'technique.unarmed_flurry',
    requires: { main: 'unarmed' },
  },
  {
    id: 'technique.shieldcraft_bash',
    skill: 'skill.shieldcraft',
    band: 0,
    ...text('shieldcraft_bash'),
    icon: 'ui.icon_guard',
    kind: 'active',
    cost: { pool: 'sta', amount: 200 },
    cooldown: 60,
    aim: 'cone',
    attack: 'technique.shieldcraft_bash',
    requires: { off: 'shield' },
  },
  {
    id: 'technique.shieldcraft_bulwark',
    skill: 'skill.shieldcraft',
    band: 15,
    ...text('shieldcraft_bulwark'),
    icon: 'ui.status_warded',
    kind: 'active',
    cost: { pool: 'sta', amount: 300 },
    cooldown: 240,
    aim: 'self',
    requires: { off: 'shield' },
    effects: [{ kind: 'selfStatus', status: 'warded', ticks: TB.bulwarkTicks }],
  },
  {
    id: 'technique.evasion_light_feet',
    skill: 'skill.evasion',
    band: 0,
    ...text('evasion_light_feet'),
    icon: 'ui.icon_dodge',
    kind: 'passive',
    passive: [{ stat: 'perfectWindow', add: TB.lightFeetTicks }],
  },
  {
    id: 'technique.evasion_shadowstep',
    skill: 'skill.evasion',
    band: 15,
    ...text('evasion_shadowstep'),
    icon: 'ui.icon_dodge',
    kind: 'active',
    cost: { pool: 'sta', amount: 300 },
    cooldown: 180,
    aim: 'target',
    requires: { target: true },
    effects: [{ kind: 'shadowstep' }],
  },
  // ---- Magic. Band 0 spells are taught by Wren. ----
  {
    id: 'technique.ember_bolt',
    skill: 'skill.ember',
    band: 0,
    ...text('ember_bolt'),
    icon: 'ui.icon_ember',
    kind: 'active',
    taught: true,
    cost: { pool: 'foc', amount: 300 },
    cooldown: 60,
    aim: 'line',
    attack: 'technique.ember_bolt',
  },
  {
    id: 'technique.ember_flame_ring',
    skill: 'skill.ember',
    band: 15,
    ...text('ember_flame_ring'),
    icon: 'ui.icon_ember',
    kind: 'active',
    cost: { pool: 'foc', amount: 450 },
    cooldown: 150,
    aim: 'circle',
    attack: 'technique.ember_flame_ring',
  },
  {
    id: 'technique.tide_splash',
    skill: 'skill.tide',
    band: 0,
    ...text('tide_splash'),
    icon: 'ui.icon_splash',
    kind: 'active',
    taught: true,
    cost: { pool: 'foc', amount: 250 },
    cooldown: 50,
    aim: 'cone',
    attack: 'technique.tide_splash',
  },
  {
    id: 'technique.tide_undertow',
    skill: 'skill.tide',
    band: 15,
    ...text('tide_undertow'),
    icon: 'ui.icon_splash',
    kind: 'active',
    cost: { pool: 'foc', amount: 400 },
    cooldown: 120,
    aim: 'line',
    attack: 'technique.tide_undertow',
  },
  {
    id: 'technique.gale_gust',
    skill: 'skill.gale',
    band: 0,
    ...text('gale_gust'),
    icon: 'ui.icon_gust',
    kind: 'active',
    taught: true,
    cost: { pool: 'foc', amount: 250 },
    cooldown: 60,
    aim: 'line',
    attack: 'technique.gale_gust',
  },
  {
    id: 'technique.gale_tailwind',
    skill: 'skill.gale',
    band: 15,
    ...text('gale_tailwind'),
    icon: 'ui.icon_gust',
    kind: 'active',
    cost: { pool: 'foc', amount: 350 },
    cooldown: 300,
    aim: 'self',
    effects: [{ kind: 'selfStatus', status: 'tailwind' }],
  },
  {
    id: 'technique.stone_fist',
    skill: 'skill.stone',
    band: 0,
    ...text('stone_fist'),
    icon: 'ui.icon_stone',
    kind: 'active',
    taught: true,
    cost: { pool: 'foc', amount: 350 },
    cooldown: 90,
    aim: 'line',
    attack: 'technique.stone_fist',
  },
  {
    id: 'technique.stone_earth_wall',
    skill: 'skill.stone',
    band: 15,
    ...text('stone_earth_wall'),
    icon: 'ui.icon_stone',
    kind: 'active',
    cost: { pool: 'foc', amount: 500 },
    cooldown: 300,
    aim: 'cone',
    effects: [
      {
        kind: 'spawnFixture',
        fixture: 'fixture.earth_wall',
        ahead: TB.earthWall.ahead,
        ticks: TB.earthWall.ticks,
      },
    ],
  },
  {
    id: 'technique.mending_mend',
    skill: 'skill.mending',
    band: 0,
    ...text('mending_mend'),
    icon: 'ui.icon_heart',
    kind: 'active',
    taught: true,
    cost: { pool: 'foc', amount: 400 },
    cooldown: 240,
    aim: 'self',
    effects: [{ kind: 'selfStatus', status: 'mending' }],
  },
  {
    id: 'technique.mending_ward',
    skill: 'skill.mending',
    band: 15,
    ...text('mending_ward'),
    icon: 'ui.status_warded',
    kind: 'active',
    cost: { pool: 'foc', amount: 450 },
    cooldown: 300,
    aim: 'self',
    effects: [{ kind: 'selfStatus', status: 'warded', ticks: TB.wardTicks }],
  },
  {
    id: 'technique.hexing_hex',
    skill: 'skill.hexing',
    band: 0,
    ...text('hexing_hex'),
    icon: 'ui.status_hexed',
    kind: 'active',
    taught: true,
    cost: { pool: 'foc', amount: 300 },
    cooldown: 90,
    aim: 'line',
    attack: 'technique.hexing_hex',
  },
  {
    id: 'technique.hexing_drain',
    skill: 'skill.hexing',
    band: 15,
    ...text('hexing_drain'),
    icon: 'ui.status_hexed',
    kind: 'active',
    cost: { pool: 'foc', amount: 450 },
    cooldown: 120,
    aim: 'cone',
    attack: 'technique.hexing_drain',
  },
  // ---- Stealth ----
  {
    id: 'technique.stealth_hide',
    skill: 'skill.stealth',
    band: 0,
    ...text('stealth_hide'),
    icon: 'ui.icon_hide',
    kind: 'active',
    cooldown: 60,
    aim: 'self',
    requires: { outOfCombat: true },
    effects: [{ kind: 'selfStatus', status: 'hidden' }],
  },
  {
    id: 'technique.stealth_ambush',
    skill: 'skill.stealth',
    band: 15,
    ...text('stealth_ambush'),
    icon: 'ui.icon_attack',
    kind: 'active',
    cost: { pool: 'sta', amount: 250 },
    cooldown: 120,
    aim: 'cone',
    attack: 'technique.stealth_ambush',
    requires: { hidden: true },
  },
  // ---- Performance ----
  {
    id: 'technique.performance_hum',
    skill: 'skill.performance',
    band: 0,
    ...text('performance_hum'),
    icon: 'ui.icon_note',
    kind: 'active',
    cost: { pool: 'foc', amount: 200 },
    cooldown: 150,
    aim: 'self',
    channel: 90,
    effects: [{ kind: 'selfStatus', status: 'courage' }],
  },
  {
    id: 'technique.performance_lullaby',
    skill: 'skill.performance',
    band: 15,
    ...text('performance_lullaby'),
    icon: 'ui.icon_note',
    kind: 'active',
    cost: { pool: 'foc', amount: 300 },
    cooldown: 300,
    aim: 'self',
    channel: 60,
    requires: { off: 'instrument' },
    effects: [
      {
        kind: 'dazeNear',
        radius: TB.lullaby.radius,
        maxTier: TB.lullaby.maxTier,
        ticks: TB.lullaby.ticks,
      },
    ],
  },
];

/** Name and description keys: `<id>.name` and `<id>.desc` in `content/strings/techniques.ts`. */
function text(short: string): { nameKey: string; descKey: string } {
  return { nameKey: `technique.${short}.name`, descKey: `technique.${short}.desc` };
}

export const TECHNIQUES: Readonly<Record<string, TechniqueDef>> = Object.fromEntries(
  LIST.map((t) => [t.id, t]),
);

/** Every technique, in table order. */
export const TECHNIQUE_LIST: readonly TechniqueDef[] = LIST;

/** True for a technique that is held to aim and released to fire. */
export function isAimed(t: TechniqueDef): boolean {
  return t.aim === 'line';
}
