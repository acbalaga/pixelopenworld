/**
 * Rumors (design/02, POW-M4-06): places an NPC or a Traveler can tell the player about. Told
 * locations appear on the map as a hand-drawn mark that sits off the true spot by an amount that
 * shrinks with Cartography. A rumor is plain data, so dialogue says only `{ rumor: id }`.
 *
 * `x` and `y` are world tiles in the region's own coordinates. The spot must be a landmark, a
 * Waystone or another place the region really has. Wake points are never rumors.
 */
export interface RumorDef {
  id: string;
  region: string;
  x: number;
  y: number;
  /** Key in `content/strings/map.ts`. The name the player sees on the mark. */
  name: string;
}

export const RUMORS: Readonly<Record<string, RumorDef>> = Object.fromEntries(
  (
    [
      // Told by a stonecutter's word: the crane over the quarry (see the Dawnmeadow landmarks).
      { id: 'rumor.quarry_crane', region: 'dawnmeadow', x: 184, y: 37, name: 'rumor.quarry_crane' },
      { id: 'rumor.mill_sails', region: 'dawnmeadow', x: 277, y: 99, name: 'rumor.mill_sails' },
    ] satisfies RumorDef[]
  ).map((d) => [d.id, d]),
);
