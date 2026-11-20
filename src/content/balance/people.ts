/**
 * How people move between places (POW-M4-12). A person whose schedule slot changes goes to the new
 * place only when neither spot can be seen, so no one is ever seen to jump.
 */
export const PEOPLE_BALANCE = {
  /** How often the schedule is checked, in ticks. */
  checkTicks: 30,
  /**
   * Half the area an avatar can see, in px, with a margin: a phone held upright shows about 22 x 50
   * tiles, the wide layout about 40 x 22.
   */
  viewHalfXPx: 336,
  viewHalfYPx: 416,
  /** A person within this many tiles of their slot counts as being at the place. */
  atPlaceTiles: 1,
} as const;
