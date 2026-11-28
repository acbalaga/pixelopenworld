/** Player-facing text for fishing (POW-M6-05). No em dashes. */
export const FISH_STRINGS = {
  /** The Chronicle's records page. */
  title: 'Fish records',
  record: '{cm} cm at {place}, {n} landed',
  count: '{n} of {of} kinds landed',
  places: {
    lark: 'the Lark',
    reedmouth: 'Reedmouth',
    millbrook_pond: 'Millbrook pond',
    south_coast: 'the south coast',
  } as Record<string, string>,
  /** Messages during a cast. */
  bite: 'A bite! Tap now.',
  hooked: 'Hooked. Hold to reel.',
  lostSlow: 'It let go.',
  lostTired: 'It got away.',
  baited: 'A minnow on the hook.',
  newBest: 'Your biggest {item} yet: {cm} cm.',
  /** The reel meter's accessible name. */
  meter: 'Keep the marker inside the band',
} as const;
