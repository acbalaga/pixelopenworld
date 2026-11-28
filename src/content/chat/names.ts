/**
 * How chat names places and dungeons in running text (POW-M5-05). Only places that are baked are
 * here (D25): a Traveler cannot mention a place that does not exist yet. Each name reads inside a
 * sentence ("at {place}", "head to {place}").
 */
export const PLACE_NAMES: Readonly<Record<string, string>> = {
  'hearthford.square': 'the square',
  'hearthford.market_street': 'market street',
  'hearthford.brin_shop': "Brin's shop",
  'hearthford.smithy': 'the smithy',
  'hearthford.carpentry': 'the carpentry',
  'hearthford.tailor': 'the tailor',
  'hearthford.apothecary': 'the apothecary',
  'hearthford.tinker_shed': 'the tinker shed',
  'hearthford.rune_house': 'the rune house',
  'hearthford.bell_tower': 'the bell tower',
  'hearthford.guard_yard': 'the guard yard',
  'hearthford.inn': 'the inn',
  'millbrook.mill': 'the mill',
  'millbrook.farm_one': 'the farm',
  'millbrook.fields': 'Millbrook fields',
  'reedmouth.jetty': 'the Reedmouth jetty',
  'reedmouth.hut': 'the Reedmouth hut',
  'stonecrop.quarry': 'the quarry',
  'stonecrop.foreman_tent': "the foreman's tent",
  'cairnmoor.well': 'the Cairnmoor well',
  'cairnmoor.shelter': 'the Cairnmoor shelter',
  'wayside.chapel': 'the wayside chapel',
  'wayside.river_camp': 'the river camp',
  'wayside.meadow_camp': 'the meadow camp',
  'wayside.woods_camp': 'the woods camp',
};

/** Dungeons a Traveler may look for a group in. */
export const DUNGEON_NAMES: Readonly<Record<string, string>> = {
  'dungeon.rootway': 'the Rootway',
  'dungeon.undermill': 'the Undermill',
  'dungeon.thornwall': 'Thornwall Pass',
};

/** Words for the in-game day phase inside a sentence. */
export const TIME_WORDS: Readonly<Record<string, string>> = {
  dawn: 'this morning',
  day: 'today',
  dusk: 'this evening',
  night: 'tonight',
};

/**
 * Names of things the game does not have yet (the other regions, their hubs). No template may
 * contain one (D25), whatever the slots fill. The validator checks the text for them.
 */
export const UNBAKED_NAMES: readonly string[] = [
  'Whisperwood',
  'Saltreach',
  'Ironvale',
  'Sunken Mire',
  'Frostspine',
  'Glass Desert',
  'The Crown',
  'Mossgate',
  'Port Brine',
  'Anvil Rest',
  'Stiltwater',
  'Highhearth',
  'Mirage',
  'Undercroft',
];
