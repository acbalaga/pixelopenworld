import type { SlotName, Trigger } from './types';

/**
 * Which slots each trigger can fill (design/12 4.2): only from the event's own payload or the
 * speaker's own state, so a Traveler never says what it could not know. The engine fills exactly
 * these, and the validator holds every template to them.
 */
const base: SlotName[] = ['player'];

export const SLOTS_BY_TRIGGER: Readonly<Record<Trigger, readonly SlotName[]>> = {
  travelerLooted: [...base, 'item', 'qty', 'creature', 'place'],
  travelerCrafted: [...base, 'item', 'qty', 'skill', 'place'],
  travelerSold: [...base, 'item', 'qty', 'price', 'place'],
  'price.up': [...base, 'item', 'price'],
  'world.raid': [...base, 'place'],
  'world.invasion': [...base],
  'world.market': [...base],
  'world.raidWon': [...base, 'place'],
  'world.raidLost': [...base, 'place'],
  'price.down': [...base, 'item', 'price'],
  travelerRankUp: [...base, 'skill', 'rank'],
  travelerDied: [...base, 'creature', 'place'],
  travelerArrived: [...base, 'place'],
  travelerLoggedIn: [...base, 'place'],
  travelerLoggedOut: [...base, 'place'],
  'state.weather': [...base, 'weather', 'place', 'time'],
  'state.phase': [...base, 'time', 'place'],
  'state.idle': [
    ...base,
    'place',
    'time',
    'handle',
    'skill',
    'rank',
    'item',
    'creature',
    'weather',
  ],
  'state.afk': [...base, 'place', 'time'],
  'state.lfg': [...base, 'dungeon', 'creature', 'place'],
  'state.question': [...base, 'item', 'creature', 'dungeon', 'place', 'skill'],
  'state.answer': [...base, 'rumor'],
  playerDeed: [...base, 'handle'],
  'deed.boss': [...base, 'handle'],
  'deed.trial': [...base, 'handle'],
  'deed.rank': [...base, 'handle'],
  'deed.singular': [...base, 'handle'],
  'deed.passed': [...base, 'handle'],
};
