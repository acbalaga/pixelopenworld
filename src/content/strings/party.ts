/** Party text (POW-M5-07). Plain, no em dashes. Nothing here explains anything about the hidden layer. */
export const PARTY_STRINGS = {
  title: 'Party finder',
  groups: 'Groups looking',
  none: 'Nobody is looking for a group right now. Post your own below.',
  join: 'Join',
  full: 'No room',
  post: 'Post a listing',
  posting: 'Your listing: {activity}. Answers come in over a few minutes.',
  cancel: 'Take it down',
  yours: 'Your party',
  leave: 'Leave party',
  empty: 'You are not in a party.',
  with: '{n} in the group',
  kinds: { dungeon: 'Dungeons', area: 'Hunting', trial: 'Trials' },
  roles: { vanguard: 'Vanguard', striker: 'Striker', support: 'Support' },
  down: 'down',
  leaving: 'leaving soon',
  roll: {
    title: 'Roll: {item}',
    need: 'need {n}',
    pass: 'pass',
    won: '{name} takes it',
  },
  /** How an activity is named on the board. */
  hunt: '{creature} hunt',
  trial: '{skill} Trial',
} as const;
