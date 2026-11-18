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
  /** The built-in property of each weapon family (design/04, POW-M3-04). */
  weapons: {
    blades: {
      /** Damage from behind, percent. Behind means the attacker is more than 120 degrees from where the target faces. */
      behindPct: 130,
      /** Cosine of 120 degrees times 256, the cut-off for "behind". */
      behindCos256: -128,
      /** Damage on a staggered target, percent, on top of the general stagger bonus. */
      staggeredPct: 120,
    },
    heavy: {
      /** Stagger points added by a heavy hit are multiplied by this, percent. */
      staggerPct: 200,
    },
    polearms: {
      /** A polearm hit leaves the target at least this far from the wielder, px. Outreaches a common melee swipe. */
      keepOutPx: 30,
    },
    archery: {
      /** Ticks of standing still before a shot reaches full charge. */
      chargeTicks: 45,
      /** Damage at no charge, and at full charge, percent. */
      minPct: 70,
      maxPct: 170,
    },
    unarmed: {
      /** Stamina refunded by every hit that lands, in tenths. */
      refund: 20,
    },
  },
  /** Shieldcraft (design/04). */
  guard: {
    /** Walk speed while guarding, percent. */
    walkPct: 50,
    /** Cosine times 256 of the frontal arc's half angle: 60 degrees each side is 120 degrees. */
    frontCos256: 128,
    /** Damage taken through a block, percent. */
    takenPct: 25,
    /** Stamina per blocked hit, in tenths. A hit that finds less than this breaks the guard. */
    cost: 80,
    /** A block begun this many ticks or fewer before an impact is a parry. */
    parryWindow: 6,
    /** Stagger bar points a parry adds to the attacker. */
    parryStagger: 40,
  },
} as const;
