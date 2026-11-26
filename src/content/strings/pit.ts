/** Pit text (POW-M5-30). Plain, no em dashes. Nothing here explains anything about the hidden layer. */

/** The Pit honor by tier: none, then the two titles. Cosmetic only. */
export const PIT_HONOR_NAMES: readonly string[] = ['', 'Pit regular', 'Pit champion'];

export const PIT_STRINGS = {
  title: 'Next',
  waiting: 'Waiting for a duel',
  none: 'Nobody is waiting right now. Duelists drift in through the evening.',
  challenge: 'Challenge',
  note: 'First to lose a third of their health loses. Nobody falls.',
  bout: 'In the ring: {a} and {b}.',
  wins: 'Your Pit wins: {n}.',
  honor: 'Your Pit honor: {honor}.',
  honorEarned: 'You are now a {honor}.',
  honorLine: 'Pit honor: {honor}',
} as const;
