import type { FixtureDef } from '../world/fixtures';

/**
 * Dawnmeadow's secrets (POW-M4-11, regions/01-dawnmeadow section 13). The four return-visit
 * secrets are in their dungeons (the seeping wall, the sealed vein, the Rootway's root wall, the
 * keep's upper room). The six here are in the open world. Each is a chest that stays shut until a
 * condition is met: a vigil sets a flag when the way is right (the right hour, a skill, being there
 * at dawn, dusk and night), or a door wants an item. At least a fifth of all of them are reached
 * by a non-combat skill (checked by the bake).
 */
export interface SecretDef {
  id: string;
  /** How it is found, for the doc and the tests. */
  how: 'patience' | 'noon' | 'skill' | 'vigil' | 'item';
  /** The non-combat skill that reaches it, if the route is a skill route. */
  skill?: string;
  /** Region tiles: the chest, and the vigil or door that wakes it. */
  chest: { x: number; y: number };
  trigger?: { x: number; y: number };
  /** The fixture kind of the vigil at the trigger. */
  vigil?: string;
  /** Journal flag the chest waits for. */
  flag?: string;
}

export const REGION_SECRETS: readonly SecretDef[] = [
  { id: 'hedge_maze_centre', how: 'patience', chest: { x: 142, y: 128 } },
  {
    id: 'sundial_door',
    how: 'noon',
    chest: { x: 207, y: 239 },
    trigger: { x: 201, y: 239 },
    vigil: 'fixture.sec_sundial_vigil',
    flag: 'secret.sundial',
  },
  {
    id: 'bell_stone',
    how: 'skill',
    skill: 'skill.performance',
    chest: { x: 109, y: 201 },
    trigger: { x: 107, y: 201 },
    vigil: 'fixture.sec_bell_vigil',
    flag: 'secret.bell_stone',
  },
  {
    id: 'lark_spring_grotto',
    how: 'skill',
    skill: 'skill.athletics',
    chest: { x: 280, y: 47 },
    trigger: { x: 278, y: 45 },
    vigil: 'fixture.sec_lark_vigil',
    flag: 'secret.lark_grotto',
  },
  { id: 'beekeepers_back_garden', how: 'item', chest: { x: 305, y: 140 } },
  {
    id: 'painters_last_canvas',
    how: 'vigil',
    chest: { x: 68, y: 40 },
    trigger: { x: 66, y: 38 },
    vigil: 'fixture.sec_painter_vigil',
    flag: 'secret.painter',
  },
];

/** The return-visit secrets of the dungeons, with the skill each asks (listed for the bake's balance check). */
export const DUNGEON_SECRETS: readonly { id: string; skill?: string }[] = [
  { id: 'rootway_root_wall', skill: 'skill.heavy_arms' },
  { id: 'undermill_cistern', skill: 'skill.tide' },
  { id: 'deeps_sealed_vein', skill: 'skill.mining' },
  { id: 'thornwall_upper_room', skill: 'skill.athletics' },
];

const chest = (id: string, loot: NonNullable<FixtureDef['loot']>, flag?: string): FixtureDef => ({
  kind: `fixture.sec_${id}_chest`,
  type: 'chest',
  sprite: 'prop.chest',
  size: 12,
  loot,
  ...(flag ? { needsFlag: flag } : {}),
});

/** The fixtures the secrets place: a chest each, a vigil for the ones that wake by being there, a door for the one that wants a cake. */
export const SECRET_FIXTURES: readonly FixtureDef[] = [
  chest('hedge_maze_centre', { items: [{ item: 'item.herbed_skewer', qty: 2 }], coin: 60 }),
  chest(
    'sundial_door',
    { items: [{ item: 'item.copper_ingot', qty: 2 }], coin: 70 },
    'secret.sundial',
  ),
  chest(
    'bell_stone',
    { items: [{ item: 'item.dish_bread', qty: 2 }], coin: 60 },
    'secret.bell_stone',
  ),
  chest(
    'lark_spring_grotto',
    { items: [{ item: 'item.fish_river', qty: 3 }], coin: 70 },
    'secret.lark_grotto',
  ),
  chest('beekeepers_back_garden', { items: [{ item: 'item.honey_cake', qty: 2 }], coin: 50 }),
  chest(
    'painters_last_canvas',
    { items: [{ item: 'item.lantern_oil', qty: 2 }], coin: 80 },
    'secret.painter',
  ),
  {
    kind: 'fixture.sec_sundial_vigil',
    type: 'vigil',
    secret: { radius: 24, flag: 'secret.sundial', minutes: [17, 21], weather: 'clear' },
  },
  {
    kind: 'fixture.sec_bell_vigil',
    type: 'vigil',
    secret: {
      radius: 24,
      flag: 'secret.bell_stone',
      need: { skill: 'skill.performance', points: 15 },
    },
  },
  {
    kind: 'fixture.sec_lark_vigil',
    type: 'vigil',
    secret: {
      radius: 40,
      flag: 'secret.lark_grotto',
      need: { skill: 'skill.athletics', points: 20 },
    },
  },
  {
    kind: 'fixture.sec_painter_vigil',
    type: 'vigil',
    secret: { radius: 40, flag: 'secret.painter', phases: ['dawn', 'dusk', 'night'] },
  },
  // The beekeeper's gate, shut till someone brings a honey cake.
  {
    kind: 'fixture.sec_bee_door',
    type: 'door',
    sprite: 'prop.door_locked',
    size: 16,
    key: 'item.honey_cake',
  },
];

/** The tile of the beekeeper's gate in the garden fence. */
export const BEE_DOOR = { x: 306, y: 137 } as const;
