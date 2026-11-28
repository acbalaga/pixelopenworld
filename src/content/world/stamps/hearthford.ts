import type { StampV2 } from '../../../sim/world/stamp';
import { Terrain } from '../tileset';
import { StampBuilder, type Rect } from './builder';

/** Hearthford is 56 x 56 tiles. The region spec places its top left at the town origin. */
export const HEARTHFORD_SIZE = 56;

/**
 * A named piece of the town's layout, in town tiles. The region spec turns these into the
 * districts the bake checks read (design/02, hub layout), so the layout is written once.
 */
export interface TownPart {
  id: string;
  kind:
    | 'square'
    | 'street'
    | 'craft_row'
    | 'rune_house'
    | 'inn'
    | 'guard_yard'
    | 'market'
    | 'home'
    | 'gate'
    | 'hall';
  rect: Rect;
}

export const TOWN_PARTS: TownPart[] = [];

/**
 * Hearthford (POW-M4-04, design/02 hub rules, regions/01-dawnmeadow section 4). Walled with a low
 * wall and four gates. A cross of streets 4 tiles wide, a civic square at the middle, a craft row
 * to the north east, the rune house, the guard yard, the inn with its yard, the market street, eight
 * homes and the bell tower. Every M3 station is placed in front of its workshop. The square holds
 * civic things only.
 */
function hearthford(): StampV2 {
  const b = new StampBuilder(HEARTHFORD_SIZE, HEARTHFORD_SIZE, Terrain.Grass);
  const part = (
    id: string,
    kind: TownPart['kind'],
    x: number,
    y: number,
    w: number,
    h: number,
  ): Rect => {
    const rect = { x, y, w, h };
    TOWN_PARTS.push({ id, kind, rect });
    return rect;
  };

  // Streets: a cross, plus the lanes that front the workshops and the market.
  b.rect(26, 0, 4, 56, Terrain.Cobble);
  b.rect(0, 26, 56, 4, Terrain.Cobble);
  part('street_ns', 'street', 26, 0, 4, 56);
  part('street_we', 'street', 0, 26, 56, 4);
  b.rect(30, 10, 24, 4, Terrain.Cobble);
  part('lane_craft_north', 'street', 30, 10, 24, 4);
  b.rect(30, 19, 24, 3, Terrain.Cobble);
  part('lane_craft_south', 'street', 30, 19, 24, 3);
  b.rect(2, 20, 24, 3, Terrain.Cobble);
  part('lane_rune', 'street', 2, 20, 24, 3);
  b.rect(30, 36, 24, 2, Terrain.Cobble);
  b.rect(18, 43, 19, 4, Terrain.Cobble);
  part('market_street', 'street', 18, 43, 19, 4);

  // The square: civic things only.
  b.rect(16, 23, 24, 13, Terrain.Cobble);
  part('square', 'square', 16, 23, 24, 13);
  b.place('fixture.waystone', 21, 25);
  b.place('fixture.board', 34, 25);
  b.place('fixture.post_stand', 36, 25);
  b.place('fixture.party_board', 32, 25);
  for (const x of [18, 19, 20]) b.object(x, 24, 'tile.board');
  // A well: water in a ring of barrels.
  b.ground(21, 32, Terrain.Water);
  for (const [x, y] of [
    [20, 31],
    [22, 31],
    [20, 33],
    [22, 33],
    [21, 31],
    [21, 33],
    [20, 32],
    [22, 32],
  ] as const)
    b.object(x, y, 'tile.barrel');
  // Benches, and the Pilgrim on one.
  b.object(34, 32, 'tile.crate');
  b.object(35, 32, 'tile.crate');
  b.place('npc.pilgrim', 36, 32);

  // The craft row. Each station sits in front of its workshop, with the person who runs it.
  b.building(31, 5, 9, 5, { roof: 'slate', door: 4, label: 'smithy facade' });
  part('smithy', 'craft_row', 31, 5, 9, 5);
  b.place('fixture.anvil', 33, 10);
  b.place('npc.smith', 36, 10);
  b.building(41, 5, 9, 5, { roof: 'red', door: 4, label: 'carpentry facade' });
  part('carpentry', 'craft_row', 41, 5, 9, 5);
  b.place('fixture.workbench', 43, 10);
  b.place('npc.carpenter', 46, 10);
  b.building(31, 14, 9, 5, { roof: 'red', door: 4, label: 'tailor facade' });
  part('tailor', 'craft_row', 31, 14, 9, 5);
  b.place('fixture.loom', 33, 19);
  b.place('npc.outfitter', 36, 19);
  b.building(41, 14, 9, 5, { roof: 'slate', door: 4, label: 'apothecary facade' });
  part('apothecary', 'craft_row', 41, 14, 9, 5);
  b.place('fixture.alchemy_table', 43, 19);
  b.place('npc.herbalist', 46, 19);
  b.building(18, 14, 8, 5, { roof: 'red', door: 3, label: "tinker's shed facade" });
  part('tinker_shed', 'craft_row', 18, 14, 8, 5);
  b.place('fixture.tinker_bench', 20, 19);
  b.place('npc.tinker', 22, 19);

  // The rune house and Wren's study.
  b.building(3, 15, 12, 5, { roof: 'slate', door: 5, label: 'rune house facade' });
  part('rune_house', 'rune_house', 3, 15, 12, 5);
  b.place('fixture.tablet', 5, 20);
  b.place('fixture.rune_stone', 8, 20);
  b.place('npc.scholar', 11, 20);

  // The bell tower: the reeve's house, tall enough to see from two chunks away.
  b.building(20, 2, 6, 10, { roof: 'slate', door: 2, label: 'bell tower' });
  part('bell_tower', 'home', 20, 2, 6, 10);
  b.place('npc.reeve', 22, 12);

  // The guard yard: a fenced yard south of the west street, with the training dummy and a rack.
  b.rect(2, 31, 13, 8, Terrain.Dirt);
  b.claim(2, 31, 13, 8, 'guard yard');
  b.fence(2, 31, 14, 31, [6, 7, 8]);
  b.fence(2, 38, 14, 38);
  b.fence(2, 31, 2, 38);
  b.fence(14, 31, 14, 38);
  part('guard_yard', 'guard_yard', 2, 31, 13, 8);
  b.place('spawner.training_dummy', 8, 35);
  b.object(4, 33, 'tile.crate');
  b.object(5, 33, 'tile.crate');
  b.place('npc.guard', 13, 32);

  // The inn: facade, and a yard behind it with the bed, the chest, the pot and the mirror.
  b.building(3, 41, 15, 5, { roof: 'red', door: 7, label: 'inn facade' });
  part('inn', 'inn', 3, 41, 15, 5);
  b.rect(3, 47, 15, 7, Terrain.Dirt);
  b.claim(3, 47, 15, 7, 'inn yard');
  b.fence(3, 47, 17, 47, [6, 7, 8]);
  b.fence(3, 53, 17, 53);
  b.fence(3, 47, 3, 53);
  b.fence(17, 47, 17, 53);
  part('inn_yard', 'inn', 3, 47, 15, 7);
  // The cellar hatch (mini-dungeon m1, POW-M4-11): planks in the corner of the yard.
  b.rect(15, 51, 2, 2, Terrain.Planks);
  // The stair to the inn room (POW-M6-07): an arch beside the yard. The bed that stood in the yard is upstairs now.
  b.object(19, 50, 'tile.cave_arch');
  b.place('fixture.mailbox', 4, 50);
  b.place('fixture.storage', 9, 50);
  b.place('prop.camp_pot', 12, 50);
  // The inn kitchen's oven (POW-M6-04): bread, pies and roasts.
  b.place('fixture.oven', 13, 48);
  b.place('fixture.mirror', 15, 50);
  b.place('npc.cook', 10, 52);

  // The market street: Brin's shop and two day stalls.
  b.building(18, 38, 8, 5, { roof: 'red', door: 3, shop: true, label: "Brin's shop facade" });
  part('brin_shop', 'market', 18, 38, 8, 5);
  b.place('npc.shopkeeper', 21, 43);
  for (const [x, y] of [
    [31, 41],
    [32, 41],
    [34, 41],
    [35, 41],
  ] as const)
    b.object(x, y, x % 2 ? 'tile.crate' : 'tile.barrel');
  part('stalls', 'market', 31, 41, 5, 1);
  // The market terminal (POW-M5-10): the auction board at the end of the stalls.
  b.place('fixture.market_terminal', 36, 44);
  // An old cook pot on the porch of the empty house (home 5, below). Nothing marks it (M4-20).
  b.place('prop.camp_pot', 43, 44);

  // Eight homes.
  const homes: [number, number, number, 'red' | 'slate' | 'thatch'][] = [
    [3, 5, 8, 'red'],
    [12, 5, 7, 'thatch'],
    [40, 31, 7, 'red'],
    [49, 31, 5, 'thatch'],
    [40, 38, 8, 'slate'],
    [32, 47, 7, 'thatch'],
    [41, 47, 7, 'slate'],
    [50, 47, 4, 'thatch'],
  ];
  homes.forEach(([x, y, w, roof], i) => {
    b.building(x, y, w, 5, { roof, door: Math.floor(w / 2), label: `home ${i + 1}` });
    part(`home_${i + 1}`, 'home', x, y, w, 5);
  });
  // Guild halls (POW-M5-08): the Lantern Players meet before home 6, Hearth and Home before home 7,
  // each by a banner post with the guild's stash and goal board. The other guilds meet in the inn's
  // back room, the far end of the inn yard, until their own regions are baked.
  b.place('fixture.guild_hall_lantern', 33, 52);
  part('hall_lantern', 'hall', 32, 52, 7, 3);
  b.place('fixture.guild_hall_hearth', 42, 52);
  part('hall_hearth', 'hall', 41, 52, 7, 3);
  b.place('fixture.guild_back_room', 13, 52);
  part('inn_back_room', 'hall', 4, 51, 9, 2);
  b.rect(2, 10, 24, 4, Terrain.Cobble);

  // The wall: a low stone wall, four gates where the streets leave, a sign at each.
  const open = [26, 27, 28, 29];
  b.wall(0, 0, 55, 0, open);
  b.wall(0, 55, 55, 55, open);
  b.wall(0, 0, 0, 55, open);
  b.wall(55, 0, 55, 55, open);
  part('gate_n', 'gate', 26, 0, 4, 1);
  part('gate_s', 'gate', 26, 55, 4, 1);
  part('gate_w', 'gate', 0, 26, 1, 4);
  part('gate_e', 'gate', 55, 26, 1, 4);
  for (const [x, y] of [
    [30, 2],
    [25, 53],
    [2, 25],
    [53, 30],
  ] as const)
    b.object(x, y, 'tile.sign_post');
  // One post a gate can be read: what the road beyond it leads to.
  b.place('fixture.sign_gate_n', 25, 2);
  b.place('fixture.sign_gate_s', 30, 53);
  b.place('fixture.sign_gate_w', 2, 30);
  b.place('fixture.sign_gate_e', 53, 25);
  return b.toStamp('hearthford');
}

export const HEARTHFORD: StampV2 = hearthford();
