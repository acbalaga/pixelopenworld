/**
 * Combat tunables. Times are sim ticks (30 per second). Distances are px. Percentages are whole
 * numbers (100 is 1.0). Stamina and Focus are stored in tenths of a point, so 1000 is a full bar
 * of 100. Health is stored in whole points.
 */
export const COMBAT = {
  pools: {
    hpMax: 100,
    staMax: 1000,
    focMax: 1000,
    /** Ticks without dealing or taking damage before Health regenerates (design/04: out of combat only). */
    hpRegenDelay: 150,
    /** Health regained every this many ticks once out of combat. Slow. */
    hpRegenEvery: 15,
    /** Ticks after spending Stamina before it regenerates. */
    staRegenDelay: 20,
    /** Stamina regained per tick. Fast. */
    staRegen: 20,
    /** Focus regained every this many ticks, and every this many while standing still. Slow. */
    focRegenEvery: 6,
    focRegenStillEvery: 3,
  },
  /** Damage model coefficients (design/04). */
  damage: {
    /** skillFactor in permille: 1000 at rank 0 to 2000 at rank 100. */
    skillFactorBase: 1000,
    skillFactorPerRank: 10,
    /** Crit multiplier in percent. */
    critMult: 150,
    /** Damage taken by a staggered target, percent. */
    staggerBonus: 150,
    /** Defense curve denominator base: factor = 100 / (100 + defense). */
    defenseBase: 100,
  },
  stagger: {
    /** Ticks an enemy stays helpless once its bar fills. */
    ticks: 45,
    /** Bar drains 1 point every this many ticks, after `decayDelay` ticks without a hit. */
    decayEvery: 3,
    decayDelay: 45,
  },
  /** Hit pause: ticks both sides freeze when a hit lands. */
  hitstop: { attacker: 2, target: 3, heavyBonus: 1 },
  /** Ticks the target is stunned by a hit that is not a stagger break. */
  hurtTicks: { player: 8, enemy: 0 },
  /** Knockback is spread over this many ticks. */
  knockTicks: 4,
  dodge: {
    cost: 250,
    ticks: 8,
    /** Ticks from the start of the dodge in which the avatar cannot be hurt. */
    iframes: 6,
    distance: 48,
    /** A dodge that started this many ticks or fewer before an impact is a perfect dodge. */
    perfectWindow: 6,
  },
  /** Fraction of walk speed while swinging, percent. */
  attackMoveFactor: 60,
  /** Flow: ticks between automatic swings. */
  flowGap: 2,
  /** Classic: ticks after the last combo hit before the combo resets. */
  comboResetGap: 6,
  lock: {
    /** Tap within this many px of an enemy to lock it. */
    tapRadius: 20,
    /** Lock drops past this distance. */
    leash: 160,
  },
  /** Flow auto attack target arc: half angle as cos*256 (128 is 60 degrees). */
  flowArcCos256: 128,
  death: {
    /** Ticks on the ground before respawn. */
    respawnDelay: 60,
    /** Ticks an enemy body stays before it is removed. */
    enemyLinger: 12,
    /** Percent of carried coin left as an Echo. */
    echoPercent: 10,
    /** Reach, px, within which the avatar recovers an Echo. */
    echoPickup: 12,
  },
  /** Shortest allowed wind-up of any creature attack, in ms (design/04): 350 at tier 1 to 200 at tier 8. */
  telegraphMs: { tier1: 350, tier8: 200 },
  crit: {
    /** Base crit chance, percent. */
    chancePct: 5,
  },
} as const;
