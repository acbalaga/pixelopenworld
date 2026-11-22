import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../../src/content/combat/attacks';
import { DAWNMEADOW_CREATURES } from '../../src/content/creatures/dawnmeadow';
import { ITEMS } from '../../src/content/items';
import { computeDamage } from '../../src/sim/combat/damage';

const O = { crit: false, staggered: false };
const def = (...ids: string[]): number =>
  ids.reduce((n, i) => n + (ITEMS[i]?.equip?.defense ?? 0), 0);

/** Worn defense: a tier 1 leather set, and a full tier 2 iron set with a shield (G4 playtest). */
const T1 = def('item.cap_leather', 'item.jerkin_leather', 'item.chaps_leather');
const T2 = def('item.helm_iron', 'item.cuirass_iron', 'item.greaves_iron', 'item.shield_iron');

/** What one creature's first attack does to a wearer with this defense. */
const taken = (id: string, d: number): number => {
  const c = DAWNMEADOW_CREATURES[id]!;
  const mult = ATTACKS[c.attacks[0]!.attack]?.mult ?? 100;
  return computeDamage(c.power, mult, 0, d, 100, O);
};

describe('armor reads in a fight (G4 playtest)', () => {
  const hitters = Object.values(DAWNMEADOW_CREATURES).filter((c) => c.power >= 8);

  it('tier 1 armor takes a visible bite out of the meadow hitters', () => {
    for (const c of hitters) expect(taken(c.id, T1), c.id).toBeLessThan(taken(c.id, 0));
  });

  it('a full tier 2 set takes at least a fifth off every meadow hitter', () => {
    for (const c of hitters)
      expect(taken(c.id, T2), c.id).toBeLessThanOrEqual(Math.floor(taken(c.id, 0) * 0.8));
  });

  it('armor never makes a hit free', () => {
    for (const c of Object.values(DAWNMEADOW_CREATURES)) expect(taken(c.id, T2)).toBeGreaterThan(0);
  });
});
