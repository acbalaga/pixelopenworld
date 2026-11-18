import { CREATURES } from '../../src/content/creatures';

/**
 * Time-to-kill targets at par, in seconds (design/04): common enemy 4 to 8, elite 20 to 40,
 * miniboss 60 to 90, regional boss 180 to 300. A creature's role is data here, so a new creature
 * is checked as soon as it is given one.
 */
export type Role = 'common' | 'elite' | 'miniboss' | 'boss';

export const BANDS: Record<Role, [number, number]> = {
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
};

/**
 * The tier of build a creature is checked against at par. A creature is met at its own tier, and
 * the cave miniboss is the gate out of the first map, so it is met by a character who has done
 * what the first map asks: rank 15 and tier 2 gear.
 */
export const PAR_TIER: Readonly<Record<string, 1 | 2>> = {
  'creature.old_bramblehide': 2,
};

/** The creatures the simulator fights: every one with a role, in the content's order. */
export const TARGETS: string[] = Object.keys(CREATURES).filter((id) => ROLES[id]);
