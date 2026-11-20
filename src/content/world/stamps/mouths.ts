import type { StampV2 } from '../../../sim/world/stamp';
import { Terrain } from '../tileset';
import { StampBuilder } from './builder';

/*
 * The ways down into mini-dungeons (POW-M4-11): a 3 by 2 stamp whose top row is the arch, hatch or
 * stones and whose bottom middle tile is open ground, where the portal fixture stands. The region
 * spec places one at each mini-dungeon's mouth and puts the portal on `MOUTH_PORTAL` from its
 * top left.
 */
export const MOUTH_PORTAL = { x: 1, y: 1 } as const;

function mouth(id: string, top: string, floor: number): StampV2 {
  const b = new StampBuilder(3, 2);
  b.rect(0, 0, 3, 2, floor);
  b.object(1, 0, top);
  b.object(0, 0, 'tile.rock');
  b.object(2, 0, 'tile.rock');
  return b.toStamp(id);
}

export const MOUTH_STAMPS: StampV2[] = [
  mouth('dg_mouth_arch', 'tile.cave_arch', Terrain.Dirt),
  mouth('dg_mouth_hatch', 'tile.crate', Terrain.Planks),
  mouth('dg_mouth_tomb', 'tile.sign_post', Terrain.Dirt),
  mouth('dg_mouth_tower', 'tile.wall_stone_post', Terrain.Cobble),
];
