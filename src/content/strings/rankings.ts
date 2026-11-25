/**
 * Rankings text (POW-M5-09): the board names that are not skills, the labels, and the lines the
 * panel fills in. Plain, no em dashes, nothing about the hidden layer.
 */
export const RANKING_STRINGS = {
  title: 'Rankings',
  open: 'Rankings',
  back: 'Requests',
  boardLabel: 'Board',
  you: 'You',
  empty: 'Nobody is on this board yet.',
  noneYet: 'You are not on this board yet.',
  yourRank: 'You are {rank} of {total}.',
  yourRankTop: 'You are first of {total}.',
  summary: '{rank} of {total}',
  notRanked: 'Not ranked',
  boards: {
    wealth: 'Wealth',
    bestiary: 'Bestiary',
    map: 'Map',
    fishing: 'Fish landed',
    duels: 'Duels',
    festivals: 'Festivals',
    renown: 'Renown',
  },
  /** What a value means on a board, after the number. */
  unit: {
    wealth: 'coin',
    bestiary: 'creatures',
    map: 'percent',
    fishing: 'fish',
    duels: 'wins',
    festivals: 'wins',
    renown: 'points',
    skill: 'points',
  },
  duelsEmpty: 'No duels have been fought yet.',
  festivalsEmpty: 'No festival has been held yet.',
} as const;
