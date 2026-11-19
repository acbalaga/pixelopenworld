/**
 * Waystones by region (POW-M4-07), in tiles from the region's top left. The region spec reads its
 * Waystone list from here, so the sim can name a stone from the fixture it touched without
 * shipping the spec. The bake checks that a Waystone fixture stands on each of these tiles.
 */
export interface WaystoneDef {
  id: string;
  x: number;
  y: number;
}

/** The town's top left in Dawnmeadow, which the Hearthford stamp is placed from. */
const TOWN = { x: 164, y: 164 } as const;

export const WAYSTONES: Readonly<Record<string, readonly WaystoneDef[]>> = {
  dawnmeadow: [
    { id: 'hearthford', x: TOWN.x + 21, y: TOWN.y + 25 },
    { id: 'millbrook', x: 292, y: 113 },
    { id: 'reedmouth', x: 308, y: 251 },
    { id: 'stonecrop', x: 186, y: 51 },
    { id: 'fernside', x: 96, y: 172 },
    { id: 'cairnmoor', x: 49, y: 49 },
  ],
};

/** The key a stone is saved under: its region and id. */
export const stoneKey = (region: string, id: string): string => `${region}:${id}`;

/** The stone standing on a tile, if the region has one there. */
export function stoneAtTile(region: string, tx: number, ty: number): WaystoneDef | null {
  return WAYSTONES[region]?.find((w) => w.x === tx && w.y === ty) ?? null;
}
