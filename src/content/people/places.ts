import { PLACE_SPOTS, type PlaceSpot } from './placeSpots';

/**
 * Where people spend their hours (POW-M4-12, regions/01-dawnmeadow sections 4 and 9). A place is a
 * named spot in a settlement or the countryside. Hearthford's places are the parts of its layout
 * (`TOWN_PARTS`), so the same name means the same rectangle; a test holds them to that. Data only.
 */
export interface PlaceDef {
  id: string;
  /** The settlement or area it is in. */
  area: 'hearthford' | 'millbrook' | 'reedmouth' | 'stonecrop' | 'cairnmoor' | 'wayside';
  /** Indoors places shelter from weather. */
  indoors: boolean;
  /** The stamp part that makes up a Hearthford place. Absent for the rest. */
  part?: string;
  /** Its tile rectangle and standing tiles in the region. Absent until the place is built. */
  spot?: PlaceSpot;
}

const hearth = (id: string, part: string, indoors: boolean): PlaceDef => ({
  id: `hearthford.${id}`,
  area: 'hearthford',
  indoors,
  part,
});
const at = (id: string, area: PlaceDef['area'], indoors: boolean): PlaceDef => ({
  id,
  area,
  indoors,
});

export const PLACES: Readonly<Record<string, PlaceDef>> = Object.fromEntries(
  [
    hearth('square', 'square', false),
    hearth('market_street', 'market_street', false),
    hearth('brin_shop', 'brin_shop', true),
    hearth('smithy', 'smithy', true),
    hearth('carpentry', 'carpentry', true),
    hearth('tailor', 'tailor', true),
    hearth('apothecary', 'apothecary', true),
    hearth('tinker_shed', 'tinker_shed', true),
    hearth('rune_house', 'rune_house', true),
    hearth('bell_tower', 'bell_tower', true),
    hearth('guard_yard', 'guard_yard', false),
    hearth('inn', 'inn', true),
    at('millbrook.mill', 'millbrook', true),
    at('millbrook.farm_one', 'millbrook', true),
    at('millbrook.fields', 'millbrook', false),
    at('reedmouth.jetty', 'reedmouth', false),
    at('reedmouth.hut', 'reedmouth', true),
    at('stonecrop.quarry', 'stonecrop', false),
    at('stonecrop.foreman_tent', 'stonecrop', true),
    at('cairnmoor.well', 'cairnmoor', false),
    at('cairnmoor.shelter', 'cairnmoor', true),
    at('wayside.chapel', 'wayside', true),
    // Appended last: place indices are saved, so new places never go in the middle.
    at('wayside.river_camp', 'wayside', false),
    at('wayside.meadow_camp', 'wayside', false),
    // The Pit (M5-29). Not in the chat place names: nobody names it until the player has found it.
    at('stonecrop.pit', 'stonecrop', false),
    // Guild halls (M5-08): two in Hearthford, and the inn's back room for the rest.
    hearth('hall_lantern', 'hall_lantern', false),
    hearth('hall_hearth', 'hall_hearth', false),
    hearth('inn_back_room', 'inn_back_room', false),
    // The north gate (M5-11): raid parties muster here before walking out together.
    hearth('gate_n', 'gate_n', false),
  ].map((p) => {
    const spot = PLACE_SPOTS[p.id];
    return [p.id, spot ? { ...p, spot } : p];
  }),
);
