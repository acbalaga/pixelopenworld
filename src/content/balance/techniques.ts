/**
 * Technique, loadout, Stealth and Performance tunables (M3-13). Ticks are sim ticks (30 per
 * second), distances px. Starting values for M3-12 to tune.
 */
export const TECHNIQUE_BALANCE = {
  /** After a swap in combat, every technique slot and the basic attack lock for this long. */
  loadoutLockTicks: 90,
  /** Hide: how long it lasts if nothing breaks it, notice radius percent, and move speed percent. */
  hide: { ticks: 900, noticePct: 50, speedPct: 60, shadowSpeedPct: 80 },
  /** Hum of Courage: Stamina regen bonus percent while the status lasts, and how long it lingers. */
  courage: { regenPct: 100, ticks: 390 },
  /** Tailwind: move speed and dodge cost percent changes, and how long. */
  tailwind: { speedPct: 30, dodgeCostPct: -40, ticks: 240 },
  /** Mend: Health every `every` ticks for `ticks`. */
  mending: { ticks: 180, every: 15, heal: 3 },
  /** Bulwark and Ward: how long the Warded status lasts. */
  bulwarkTicks: 90,
  wardTicks: 150,
  /** Earth Wall: how long it stands, its size, and how far in front of the caster it rises. */
  earthWall: { ticks: 120, ahead: 22 },
  /** Shadowstep: how far behind the target the caster lands, and the invulnerable ticks on arrival. */
  shadowstep: { behind: 14, iframes: 8 },
  /** Lullaby: radius, the highest creature tier it affects, and how long Dazed lasts. */
  lullaby: { radius: 90, maxTier: 2, ticks: 150 },
  /** Light Feet: ticks added to the perfect dodge window. */
  lightFeetTicks: 2,
  /** Scatter: arrows in the volley and the angle between them, in degrees. */
  scatter: { arrows: 3, spreadDeg: 16 },
  /** Busker (M3-08) makes songs last this much longer. Reserved for that ticket's Path. */
  buskerPct: 50,
} as const;
