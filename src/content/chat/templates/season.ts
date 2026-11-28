import type { ChatTemplate } from '../types';
import { T } from './helper';

/**
 * Crops in season (POW-M6-02): Travelers who gather or craft mention what is growing. `{item}` is
 * always a crop that can be planted this season (the engine picks it), so a line never names a crop
 * out of season or one that does not exist. No new Traveler activity: they talk, they do not farm.
 */
const GROWERS = ['Crafter', 'Casual', 'Completionist', 'Trader', 'Grinder'] as const;
const when = { archetype: GROWERS };

export const SEASON: readonly ChatTemplate[] = [
  T('season.crop.n01', 'banter', 'state.season', ['{item} is in season. good time to plant'], {
    when,
  }),
  T(
    'season.crop.n02',
    'banter',
    'state.season',
    ['put {item} in this morning, should be up soon', 'planted {item}, now the waiting'],
    { when },
  ),
  T(
    'season.crop.n03',
    'trade',
    'state.season',
    ['anyone selling {item} seed? the field by the east gate is cheap', 'wts {item}, fresh'],
    { when: { archetype: ['Trader', 'Crafter'] } },
  ),
  T(
    'season.crop.n04',
    'banter',
    'state.season',
    ['rain is good for the {item}', 'water your {item} or it crawls'],
    { when },
  ),
  T(
    'season.crop.n05',
    'question',
    'state.season',
    ['is {item} worth growing this season?', 'how long does {item} take?'],
    { when: { archetype: ['Casual', 'Completionist', 'Crafter'] } },
  ),
  T(
    'season.crop.n06',
    'brag',
    'state.season',
    ['first {item} of the season, done', 'pulled a good crop of {item} {time}'],
    { when: { archetype: ['Grinder', 'Completionist', 'Crafter'] } },
  ),
  T(
    'season.crop.n07',
    'banter',
    'state.season',
    ['cooking with {item} tonight', 'nothing beats {item} picked the same day'],
    { when: { archetype: ['Crafter', 'Casual'] } },
  ),
  T(
    'season.crop.n08',
    'complaint',
    'state.season',
    ['forgot to water my {item}. half speed all day', 'my {item} is still not ripe'],
    { when },
  ),
];
