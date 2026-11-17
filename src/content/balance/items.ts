/** Item, loot, gathering and cooking tunables. Times are sim ticks (30 per second). */
export const ITEMS_BALANCE = {
  inventory: {
    /** Bag slots at the start. */
    slots: 20,
  },
  /** The storage chest by the square Waystone. */
  storage: { slots: 40 },
  /**
   * Power and defense are the base times this percent for a quality, indexed Common, Fine,
   * Superior, Masterwork. Starting values, tuned by M3-12.
   */
  qualityPct: [100, 110, 120, 135] as readonly number[],
  /** Percent of power and defense a broken item (0 durability) still gives. */
  brokenPct: 50,
  /**
   * Wear (design/04, design/05). Weapons lose 1 durability per `weaponHits` hits landed, armor
   * 1 per `armorHits` hits taken, tools 1 per `toolUses` gathers. Every worn item also loses
   * `deathPct` percent of its maximum on death. Nothing is ever destroyed.
   */
  wear: { weaponHits: 50, armorHits: 50, toolUses: 25, deathPct: 10 },
  /** What a new avatar carries and wears. Item ids from `content/items`. */
  starter: {
    /**
     * Techniques a new character knows beyond the lunge. Slot 1 always follows the weapon held
     * (see `recomputeGear`), so this is empty: anything else, Ember bolt for one, is learned in
     * play from a person in town.
     */
    techniques: [] as readonly string[],
    equipment: { main: 'item.sword_rusty' } as Readonly<Record<string, string>>,
    bag: [{ item: 'item.dish_bread', qty: 2 }] as readonly { item: string; qty: number }[],
  },
  loot: {
    /** Ticks a drop spends popping out before it can be picked up. */
    popTicks: 9,
    /** Drops land within this many px of where the creature fell. */
    scatterPx: 10,
    /** Within this many px a drop slides toward the avatar. */
    magnetPx: 28,
    /** Slide speed, px per tick. */
    magnetSpeedPx: 3,
    /** Within this many px a drop is taken. */
    collectPx: 6,
    /** Something the avatar drops cannot be picked up again for this long, so it is not re-collected at once. */
    dropGraceTicks: 90,
    /** A drop left alone this long is gone. */
    lifeTicks: 3600,
  },
  gather: {
    /** The timing sweep runs this long. A second press inside the sweet window pays a bonus. */
    sweepTicks: 24,
    sweetFrom: 13,
    sweetTo: 17,
    baseMin: 1,
    baseMax: 2,
    sweetBonus: 1,
  },
  cook: {
    maxIngredients: 3,
  },
} as const;
