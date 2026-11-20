/**
 * Creatures that roam a daily route (POW-M4-05). A roamer's spawner stands still at a baked tile;
 * the creature's home follows its schedule, so the same time of day always finds it in the same
 * place. A player can learn the route and avoid it, or wait for it. Positions are in tiles of the
 * region, and times are minutes of the in-game day (0 to 48, the clock of `balance/time.ts`).
 */
export interface RoamStop {
  x: number;
  y: number;
  /** Minute of the day it gets here, and the minute it sets off for the next stop. */
  arrive: number;
  leave: number;
}

export interface RoamerDef {
  creature: string;
  /** The region whose map it roams. */
  region: string;
  /** The spawner kind placed in the region's spec. */
  spawner: string;
  /**
   * The stops in order. It walks from each to the next between `leave` and the next `arrive`, and
   * from the last back to the first (its `arrive` taken as a minute of the next day).
   */
  stops: readonly RoamStop[];
}

export const ROAMERS: Readonly<Record<string, RoamerDef>> = {
  /**
   * Hollowhorn, the field boss of Cairnmoor. It grazes at five places on the west moor, the one
   * stretch of Cairnmoor that stays 12 tiles clear of the cairn ring and the roads, and rests
   * through the night in the middle of it. A dawn graze, a midday graze and a dusk graze give a
   * player three windows to watch it from the edge of the moor.
   */
  'creature.hollowhorn': {
    creature: 'creature.hollowhorn',
    region: 'dawnmeadow',
    spawner: 'spawner.hollowhorn',
    stops: [
      { x: 2, y: 47, arrive: 2, leave: 8 },
      { x: 29, y: 43, arrive: 14, leave: 20 },
      { x: 21, y: 55, arrive: 26, leave: 32 },
      { x: 29, y: 66, arrive: 37, leave: 40 },
      { x: 16, y: 57, arrive: 44, leave: 46 },
    ],
  },
};
