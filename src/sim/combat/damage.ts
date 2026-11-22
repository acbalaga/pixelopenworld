import { COMBAT as C } from '../../content/balance/combat';

/** Options that scale a hit after the base formula. */
export interface DamageOpts {
  crit: boolean;
  /** The target was staggered when the hit landed. */
  staggered: boolean;
  /** Percent from a weapon property or a block. 100 or absent for none. */
  pct?: number;
}

/** Skill factor in permille: 1000 at rank 0, 2000 at rank 100. */
export function skillFactor(rank: number): number {
  const r = Math.min(100, Math.max(0, Math.floor(rank)));
  return C.damage.skillFactorBase + r * C.damage.skillFactorPerRank;
}

/**
 * The damage model from design/04:
 * `(weaponPower * techniqueMultiplier * skillFactor) * elementFactor * (base / (base + defense))`,
 * then crit and stagger bonus. `mult` and `element` are percents (100 is 1.0). Integer math
 * throughout, carried in hundredths until the end, so the same inputs give the same damage on
 * every device. Never below 1.
 */
export function computeDamage(
  power: number,
  mult: number,
  rank: number,
  defense: number,
  element: number,
  opts: DamageOpts,
): number {
  // power * mult/100 * skill/1000 * element/100 * base/(base+def), in hundredths.
  let centi = Math.floor(
    (power * mult * skillFactor(rank) * element * C.damage.defenseBase) /
      (100 * 1000 * (C.damage.defenseBase + defense)),
  );
  if (opts.crit) centi = Math.floor((centi * C.damage.critMult) / 100);
  if (opts.pct !== undefined && opts.pct !== 100) centi = Math.floor((centi * opts.pct) / 100);
  if (opts.staggered) centi = Math.floor((centi * C.damage.staggerBonus) / 100);
  return Math.max(1, Math.floor((centi + 50) / 100));
}
