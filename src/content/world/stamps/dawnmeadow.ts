import type { StampV2 } from '../../../sim/world/stamp';
import { Terrain } from '../tileset';
import { StampBuilder } from './builder';

/*
 * The rest of Dawnmeadow's authored places (POW-M4-04): the three settlements, the Waystone sites,
 * the above-tier sights and the Fernside climb. Hearthford is in hearthford.ts. All are built with
 * the stamp builder, so each is an ordinary v2 stamp the dev map and stamp editor can open.
 */

/** A pole of fence tiles, `len` tall, with its foot at (x, y + len - 1). */
function pole(b: StampBuilder, x: number, y: number, len: number): void {
  for (let j = 0; j < len; j++) b.object(x, y + j, 'tile.fence_v');
}

/** A bar of fence tiles, `len` wide, from (x, y). */
function bar(b: StampBuilder, x: number, y: number, len: number): void {
  for (let i = 0; i < len; i++) b.object(x + i, y, 'tile.fence_h');
}

/** Millbrook: the mill with its sails (15 tiles tall), the pond and Waystone, three farms and the barn. */
function millbrook(): StampV2 {
  const b = new StampBuilder(28, 28);
  // The mill and its sails: a hub, four arms.
  b.building(2, 14, 8, 5, { roof: 'slate', door: 3, label: 'mill' });
  b.object(5, 9, 'tile.fence_post');
  pole(b, 5, 3, 6);
  pole(b, 5, 10, 4);
  bar(b, 1, 9, 4);
  bar(b, 6, 9, 4);
  // The pond, the Waystone beside it, and a path.
  b.rect(12, 15, 6, 4, Terrain.Water);
  b.place('fixture.waystone', 20, 17);
  b.rect(10, 19, 14, 2, Terrain.Dirt);
  b.rect(2, 19, 8, 2, Terrain.Dirt);
  // The barn, and three farms with fenced fields.
  b.place('npc.miller', 6, 20);
  b.place('npc.farmer', 21, 6);
  b.building(3, 22, 9, 6, { roof: 'thatch', door: 4, label: 'barn' });
  b.building(18, 1, 7, 5, { roof: 'thatch', door: 3, label: 'farm one' });
  b.field(16, 7, 11, 5);
  b.fence(16, 7, 26, 7);
  b.fence(16, 11, 26, 11);
  b.building(18, 22, 7, 5, { roof: 'thatch', door: 3, label: 'farm two' });
  b.field(1, 1, 10, 5);
  // Hay by the barn.
  for (const [x, y] of [
    [1, 24],
    [1, 26],
    [12, 27],
  ] as const)
    b.object(x, y, 'tile.hay_bale');
  b.fence(1, 1, 10, 1);
  b.fence(1, 5, 10, 5);
  // A scarecrow with a crow on it beside the field, and a mound of turned earth (M4-20). The
  // firebricks that stood under the mill are in the Undermill now (M4-11).
  b.place('fixture.scarecrow', 12, 3);
  b.place('fixture.crow_mound', 13, 12);
  b.building(13, 22, 4, 4, { roof: 'thatch', door: 1, label: 'farm three shed' });
  return b.toStamp('millbrook');
}

/** Reedmouth: stilt huts on planks over the delta, drying racks, a jetty, a Waystone at its end. */
function reedmouth(): StampV2 {
  const b = new StampBuilder(24, 18);
  b.rect(0, 9, 24, 9, Terrain.Water);
  b.rect(1, 2, 22, 6, Terrain.Planks);
  b.building(2, 3, 6, 4, { roof: 'thatch', door: 2, label: 'hut one' });
  b.building(10, 3, 6, 4, { roof: 'thatch', door: 2, label: 'hut two' });
  b.building(18, 3, 5, 4, { roof: 'thatch', door: 2, label: 'hut three' });
  for (const x of [3, 4, 5, 11, 12, 13]) b.object(x, 8, 'tile.fence_h');
  // Reeds along the shore.
  [1, 6, 9, 17, 20, 22].forEach((x, i) => b.object(x, 7, `tile.reeds_${i % 2}`));
  // The jetty runs out into the water.
  b.rect(11, 8, 3, 9, Terrain.Planks);
  b.place('fixture.waystone', 12, 15);
  b.place('npc.fisher', 12, 10);
  return b.toStamp('reedmouth');
}

/** Stonecrop: tents, an altar, and a crane at the quarry lip (14 tiles tall) with the Waystone at its foot. */
function stonecrop(): StampV2 {
  const b = new StampBuilder(26, 22);
  b.rect(0, 4, 26, 18, Terrain.Dirt);
  for (const [x, y] of [
    [2, 12],
    [8, 12],
    [2, 17],
    [8, 17],
  ] as const)
    b.building(x, y, 5, 3, { roof: 'slate', door: 2, label: `tent ${x},${y}` });
  pole(b, 20, 1, 14);
  bar(b, 13, 1, 8);
  b.object(13, 2, 'tile.crate');
  b.object(13, 3, 'tile.barrel');
  b.place('fixture.waystone', 22, 15);
  b.place('npc.foreman', 14, 10);
  b.object(17, 17, 'tile.rock');
  b.place('fixture.tablet', 16, 17);
  return b.toStamp('stonecrop');
}

/** Fernside: a broken arch at the forest edge, with the Waystone beside it. */
function fernsideArch(): StampV2 {
  const b = new StampBuilder(9, 6);
  b.rect(0, 2, 9, 4, Terrain.Dirt);
  b.object(2, 2, 'tile.cave_arch');
  b.object(1, 3, 'tile.rock');
  b.object(4, 4, 'tile.rock');
  b.place('fixture.waystone', 6, 4);
  // A crate for the Rootway's firebricks, a stand-in until M4-21 (M4-20).
  b.place('fixture.chest_firebrick', 7, 2);
  return b.toStamp('fernside_arch');
}

/** Cairnmoor: a ring of standing stones with the Waystone inside. */
function cairnRing(): StampV2 {
  const b = new StampBuilder(11, 11);
  b.rect(0, 0, 11, 11, Terrain.Dirt);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    b.object(5 + Math.round(Math.cos(a) * 4), 5 + Math.round(Math.sin(a) * 4), 'tile.rock');
  }
  b.place('fixture.waystone', 5, 5);
  return b.toStamp('cairn_ring');
}

/** The wayside chapel on the south road, with the steps a new character may wake on. */
function chapel(): StampV2 {
  const b = new StampBuilder(11, 9);
  b.building(3, 1, 5, 4, { roof: 'slate', door: 2, label: 'chapel' });
  b.rect(2, 5, 7, 3, Terrain.Cobble);
  b.object(1, 6, 'tile.crate');
  for (const x of [0, 1, 9, 10]) b.detail(x, 7, 'tile.flower_white_0');
  return b.toStamp('chapel');
}

/** Small waysides: a hunter's lean-to, a shepherd's hut and pen, a milestone. */
function leanTo(): StampV2 {
  const b = new StampBuilder(6, 4);
  b.rect(0, 0, 6, 4, Terrain.Dirt);
  b.object(1, 1, 'tile.crate');
  b.object(2, 1, 'tile.barrel');
  b.fence(0, 0, 5, 0);
  return b.toStamp('lean_to');
}
function shepherdHut(): StampV2 {
  const b = new StampBuilder(14, 8);
  b.building(1, 1, 5, 3, { roof: 'thatch', door: 2, label: 'shepherd hut' });
  b.fence(7, 1, 13, 1);
  b.fence(7, 6, 13, 6);
  b.fence(7, 1, 7, 6);
  b.fence(13, 1, 13, 6);
  return b.toStamp('shepherd_hut');
}
function milestone(): StampV2 {
  const b = new StampBuilder(3, 3);
  b.place('fixture.sign_milestone', 1, 1);
  b.object(0, 2, 'tile.rock');
  return b.toStamp('milestone');
}

/** The great oak on Hollow Downs, where the Rootway will open (POW-M4-21). */
function greatOak(): StampV2 {
  const b = new StampBuilder(9, 8);
  for (const [x, y] of [
    [2, 3],
    [5, 3],
    [3, 5],
    [6, 5],
  ] as const) {
    b.object(x, y, 'tile.tree_oak_0_trunk');
    b.overhead(x, y, 'tile.tree_oak_0_canopy');
    b.overhead(x, y - 1, 'tile.tree_oak_1_canopy');
  }
  return b.toStamp('great_oak');
}

/** Above-tier sight 1: stones afloat above the Crown, on the northern skyline. Overhead only, so nothing blocks. */
function floatingStones(): StampV2 {
  const b = new StampBuilder(30, 9);
  for (const [x, y] of [
    [2, 6],
    [7, 2],
    [12, 5],
    [16, 1],
    [21, 6],
    [25, 3],
    [28, 7],
  ] as const) {
    b.overhead(x, y, 'tile.rock');
    b.overhead(x + 1, y, 'tile.rock');
  }
  return b.toStamp('floating_stones');
}

/** Above-tier sight 2: a lit window in the cliff face, seen at night. */
function cliffWindow(): StampV2 {
  const b = new StampBuilder(7, 7);
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) {
      b.ground(x, y, Terrain.Cave);
      b.object(x, y, y === 6 ? 'tile.cave_wall_face' : 'tile.cave_wall_top');
    }
  b.object(3, 3, 'tile.wall_window');
  return b.toStamp('cliff_window');
}

/** Above-tier sight 3: a tier 3 creature's den on the far bank of the delta. */
function farDen(): StampV2 {
  const b = new StampBuilder(14, 10);
  b.rect(0, 0, 14, 10, Terrain.Water);
  b.rect(3, 2, 9, 7, Terrain.Dirt);
  b.object(7, 2, 'tile.cave_arch');
  b.object(4, 3, 'tile.tree_dead_0_trunk');
  b.overhead(4, 3, 'tile.tree_dead_0_canopy');
  b.object(10, 4, 'tile.rock');
  b.object(5, 7, 'tile.rock');
  return b.toStamp('far_den');
}

/** The Fernside climb: a narrow cliff route with stamina ledges and two rest points (regions/01 section 7). */
function fernsideClimb(): StampV2 {
  const b = new StampBuilder(9, 26);
  for (let y = 0; y < 26; y++)
    for (let x = 0; x < 9; x++) {
      const route = x >= 3 && x <= 5;
      b.ground(x, y, route ? Terrain.Dirt : Terrain.Cave);
      if (!route) b.object(x, y, y % 3 === 2 ? 'tile.cave_wall_face' : 'tile.cave_wall_top');
    }
  // A ledge spans the whole route, so there is no way round it.
  for (const y of [3, 7, 11, 15, 19, 23]) for (const x of [3, 4, 5]) b.place('fixture.ledge', x, y);
  b.place('fixture.rest_point', 4, 9);
  b.place('fixture.rest_point', 4, 17);
  return b.toStamp('fernside_climb');
}

/** The closed yard at the far west where the three ways out of Dawnmeadow end (dungeons/west.ts). */
function whisperwoodEdge(): StampV2 {
  const b = new StampBuilder(16, 14);
  b.rect(0, 0, 16, 14, Terrain.Dirt);
  for (let x = 0; x < 16; x++) {
    b.object(x, 0, 'tile.cave_wall_top');
    b.object(x, 13, 'tile.cave_wall_top');
  }
  for (let y = 1; y < 13; y++) {
    b.object(0, y, 'tile.cave_wall_top');
    b.object(15, y, 'tile.cave_wall_top');
  }
  b.place('fixture.sign_edge', 8, 2);
  b.object(3, 3, 'tile.tree_pine_0_trunk');
  b.overhead(3, 3, 'tile.tree_pine_0_canopy');
  b.object(12, 3, 'tile.tree_pine_1_trunk');
  b.overhead(12, 3, 'tile.tree_pine_1_canopy');
  return b.toStamp('whisperwood_edge');
}

/**
 * The Pit (POW-M5-29): an old working in the quarry lip, east of the crane, a sunken ring of dirt
 * open to the sky with braziers at its corners. A low stone rim closes it on the west and south
 * (the quarry's own rock closes the north and east). The only way in is a gap in the west rim, where
 * a stack of crates stands until the player slides it aside. The stamp is 10 by 7 tiles.
 */
function quarryPit(): StampV2 {
  const b = new StampBuilder(10, 7);
  b.rect(0, 0, 10, 7, Terrain.Dirt);
  for (let y = 0; y < 6; y++) if (y !== 3) b.object(0, y, 'tile.wall_stone_v');
  b.object(0, 6, 'tile.wall_stone_post');
  for (let x = 1; x < 10; x++) b.object(x, 6, 'tile.wall_stone_h');
  b.place('fixture.pit_crates', 0, 3);
  // The "Next" board at the north rim (POW-M5-30): who is waiting for a duel.
  b.place('fixture.pit_board', 5, 0);
  for (const [x, y] of [
    [2, 1],
    [8, 1],
    [2, 4],
    [8, 4],
  ] as const)
    b.object(x, y, 'tile.torch');
  b.claim(0, 0, 10, 7, 'the pit');
  return b.toStamp('quarry_pit');
}

export const DAWNMEADOW_STAMPS: StampV2[] = [
  whisperwoodEdge(),
  millbrook(),
  reedmouth(),
  stonecrop(),
  quarryPit(),
  fernsideArch(),
  cairnRing(),
  chapel(),
  leanTo(),
  shepherdHut(),
  milestone(),
  greatOak(),
  floatingStones(),
  cliffWindow(),
  farDen(),
  fernsideClimb(),
];
