import type { ChatTemplate } from '../types';
import { L } from './helper';

/**
 * What people say beside a camp fire (POW-M5-26). Local only, so a Traveler must be near the
 * player, and gated by `place` so they fire only at a camp. Plain talk: tea, stew, tired feet.
 */
const AT_CAMP = {
  place: ['wayside.river_camp', 'wayside.meadow_camp'],
  doing: ['social', 'afk'],
} as const;

export const CAMP: readonly ChatTemplate[] = [
  L(
    'camp.idle.n01',
    'joke',
    'state.idle',
    ['stew is on, bring a bowl', 'who put the stew on? bless them'],
    { when: AT_CAMP },
  ),
  L(
    'camp.idle.n02',
    'complaint',
    'state.idle',
    ['five more minutes and then i am walking back', 'just five more minutes by the fire'],
    { when: AT_CAMP },
  ),
  L(
    'camp.idle.n03',
    'banter',
    'state.idle',
    ['the river sounds nice at night', 'listen to the water. no lag at all'],
    { when: { ...AT_CAMP, phase: ['dusk', 'night'] } },
  ),
  L(
    'camp.idle.n04',
    'joke',
    'state.idle',
    ['my feet have opinions about the walk here', 'sat down and my boots said thank you'],
    { when: AT_CAMP },
  ),
  L(
    'camp.idle.n05',
    'greet',
    'state.idle',
    ['pull up a log, plenty of room', 'warm spot over here if you want it'],
    { when: AT_CAMP },
  ),
];
