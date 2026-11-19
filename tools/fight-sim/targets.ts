import { CREATURES } from '../../src/content/creatures';

/**
 * Time-to-kill targets at par, in seconds (design/04): common enemy 4 to 8, elite 20 to 40,
 * miniboss 60 to 90, regional boss 180 to 300. A creature's role is data here, so a new creature
 * is checked as soon as it is given one.
 */
export type Role = 'minor' | 'common' | 'elite' | 'miniboss' | 'boss';

export const BANDS: Record<Role, [number, number]> = {
  // Small prey, pests and birds (M4-05): over in a couple of hits, more of them at once.
  minor: [1, 4],
  common: [4, 8],
  elite: [20, 40],
  miniboss: [60, 90],
  boss: [180, 300],
};

export const ROLES: Readonly<Record<string, Role>> = {
  'creature.mossling': 'common',
  'creature.spitbloom': 'common',
  'creature.bramble_boar': 'common',
  'creature.old_bramblehide': 'miniboss',
  'creature.thornling': 'common',
  'creature.fogcap': 'common',
  'creature.cinderback_boar': 'common',
  // Dawnmeadow (M4-05).
  'creature.meadow_hare': 'minor',
  'creature.hedge_sparrow': 'minor',
  'creature.moor_wisp': 'minor',
  'creature.grain_rat': 'minor',
  'creature.thistle_wasp': 'minor',
  'creature.fox': 'common',
  'creature.downs_ram': 'common',
  'creature.burrow_mole': 'common',
  'creature.barrow_bones': 'common',
  'creature.reed_crab': 'common',
  'creature.marsh_leech': 'common',
  'creature.crag_hawk': 'common',
  'creature.moorhound': 'common',
  'creature.strawman': 'common',
  'creature.rubblet': 'common',
  'creature.thornling_scout': 'common',
  'creature.hollowhorn': 'miniboss',
};

/**
 * The tier of build a creature is checked against at par. A creature is met at its own tier, and
 * the cave miniboss is the gate out of the first map, so it is met by a character who has done
 * what the first map asks: rank 15 and tier 2 gear.
 */
export const PAR_TIER: Readonly<Record<string, 1 | 2>> = {
  'creature.old_bramblehide': 2,
  'creature.thornling_scout': 2,
  // The field boss is met by someone who has done what the first map asks.
  'creature.hollowhorn': 2,
};

/** The creatures the simulator fights: every one with a role, in the content's order. */
export const TARGETS: string[] = Object.keys(CREATURES).filter((id) => ROLES[id]);
