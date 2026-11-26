/** World event text (POW-M5-11). Plain, no em dashes. Nothing here explains anything about the hidden layer. */
export const EVENT_STRINGS = {
  calendar: 'Calendar',
  names: {
    raid: 'Field raid',
    invasion: 'Invasion of Hearthford',
    market: 'Market day',
    maintenance: 'Maintenance',
  } as Record<string, string>,
  now: 'On now',
  inMin: 'in {m} min',
  inHours: 'in {h} h {m} min',
  inDays: 'in {d} days',
  soon: {
    raid: 'A field raid starts in {m} minutes. Raid parties muster at the north gate of Hearthford.',
    invasion: 'Creatures will attack the outskirts of Hearthford in {m} minutes.',
    market: 'Market day opens in {m} minutes at the terminal on the market street.',
    maintenance: 'Brief maintenance in {m} minutes. Nothing will change.',
  } as Record<string, string>,
  started: {
    raid: 'A field raid has begun near {place}.',
    invasion: 'Creatures are attacking the gates of Hearthford.',
    market: 'Market day is open.',
  } as Record<string, string>,
  raidWon: 'The raid boss is down.',
  raidLost: 'The raid boss got away.',
  reward: 'Raid share: {coin} coin.',
  renown: 'Renown for defending Hearthford.',
} as const;
