/**
 * Named areas (POW-M4-20): rectangles of a region, in tiles (x1 and y1 exclusive), that data can
 * refer to by id. A Singular step can ask for the avatar to stand in one.
 */
export interface AreaDef {
  id: string;
  region: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The town's top left in Dawnmeadow, as in `waystones.ts`. */
const TOWN = { x: 164, y: 164 } as const;

export const AREAS: Readonly<Record<string, AreaDef>> = Object.fromEntries(
  (
    [
      // The porch of the empty house on the market street (home 5 in the town stamp, 40, 38), where
      // the old cook pot stands.
      {
        id: 'area.empty_house',
        region: 'dawnmeadow',
        x0: TOWN.x + 40,
        y0: TOWN.y + 43,
        x1: TOWN.x + 48,
        y1: TOWN.y + 46,
      },
    ] satisfies AreaDef[]
  ).map((a) => [a.id, a]),
);

/** True if the tile is inside the area, in that region. */
export function inArea(id: string, region: string, tx: number, ty: number): boolean {
  const a = AREAS[id];
  return !!a && a.region === region && tx >= a.x0 && tx < a.x1 && ty >= a.y0 && ty < a.y1;
}
