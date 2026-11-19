import { ROSTER_SPAWNERS } from '../creatures/rosters';
import { MANUALS } from '../items/manuals';
/**
 * Regions and what each must supply (design/02, POW-M3-12). The slice is the first map: it is
 * Dawnmeadow's home ground, and it prepares a character for the regions outside it. Everything
 * else a recipe or a request needs lives out there, at a tier that does not forgive an
 * unprepared character.
 *
 * A planned region has no map yet. Its supply is its spec's spawn table in advance: the nodes,
 * spawners and chests its map must place when it is built (M4 for Whisperwood). Content that
 * belongs to no region fails `npm run validate`, so nothing is authored and then forgotten.
 */
export interface RegionDef {
  id: string;
  name: string;
  /** Sets creature strength, material tier and gear tier (design/02). */
  tier: number;
  /** `built` has a baked map and the supply below is what it places. */
  status: 'built' | 'planned';
  supply: {
    /** Gathering node kinds. */
    nodes: readonly string[];
    /** Creature spawner kinds. */
    spawners: readonly string[];
    /** Chest fixture kinds with loot. */
    chests: readonly string[];
  };
}

export const REGIONS: readonly RegionDef[] = [
  {
    id: 'dawnmeadow',
    name: 'Dawnmeadow',
    tier: 1,
    status: 'built',
    supply: {
      nodes: [
        'node.herb_patch',
        'node.berry_bush',
        'node.copper_vein',
        'node.iron_vein',
        'node.oak_tree',
        'node.ash_tree',
        'node.fishing_spot',
      ],
      spawners: [
        'spawner.training_dummy',
        'spawner.mossling',
        'spawner.spitbloom',
        'spawner.bramble_boar',
        'spawner.old_bramblehide',
        // The zone rosters and the hand placed ones (M4-05).
        ...Object.keys(ROSTER_SPAWNERS),
      ],
      chests: [
        'fixture.chest_key',
        'fixture.chest_side',
        'fixture.satchel',
        // Manuals (M4-15), stand-ins until M4-11 and M4-21 place them.
        ...MANUALS.map((m) => `fixture.chest_${m.id.replace(/^item\./, '')}`),
      ],
    },
  },
  {
    id: 'whisperwood',
    name: 'Whisperwood',
    tier: 2,
    status: 'planned',
    supply: {
      nodes: [
        'node.flax_patch',
        'node.briar_tuft',
        'node.glowcap_cluster',
        'node.nightshade_bush',
        'node.river_bank',
        'node.silk_web',
      ],
      spawners: ['spawner.thornling', 'spawner.fogcap', 'spawner.cinderback_boar'],
      chests: ['fixture.chest_cairn', 'fixture.chest_hollow'],
    },
  },
];

/** The region a node, spawner or chest kind belongs to, or undefined. */
export function regionOf(kind: string): RegionDef | undefined {
  return REGIONS.find(
    (r) =>
      r.supply.nodes.includes(kind) ||
      r.supply.spawners.includes(kind) ||
      r.supply.chests.includes(kind),
  );
}
