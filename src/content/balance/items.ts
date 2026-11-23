/** Item, loot, gathering and cooking tunables. Times are sim ticks (30 per second). */
export const ITEMS_BALANCE = {
  inventory: {
    /** Bag slots at the start. */
    slots: 20,
  },
  /**
   * Potions per Bag slot. Each quality of each potion takes its own slot, so a small stack fills
   * the Bag fast once crafting makes Fine and Superior batches. Same as food and materials.
   */
  potionStack: 20,
  /**
   * The storage chest by the square Waystone. It also takes what does not fit in the Bag, so it
   * holds twice what it did (40 to 80). A chest saved with 40 grows to this when it is next used.
   * `nearlyFull` is the free slots at which the player is told the chest is filling up.
   */
  storage: { slots: 80, nearlyFull: 6 },
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
    /** Kit 2 (M4-14): a wooden dagger and ragged clothes, and one bread. Nothing else. */
    equipment: { main: 'item.dagger_wood', body: 'item.outfit_ragged' } as Readonly<
      Record<string, string>
    >,
    bag: [{ item: 'item.dish_bread', qty: 1 }] as readonly { item: string; qty: number }[],
  },
  /** Kit 1, what every character made before M4-14 started with. Kept for the integrity check only. */
  starterV1: {
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
    /** Sweeps to a node. Trees ask for more (see `NodeDef.sweep`). */
    swings: 1,
    /** A tool below the node's tier, or none, makes the sweep this much longer, percent. */
    toolSlowPct: 50,
    /** Each tool tier above the node's widens the sweet window by this many ticks. */
    toolWindowTicks: 1,
    /** Chance of Fine on a sweet hit, percent per skill point. Rolled on the `loot` stream. */
    finePctPerPoint: 1,
    /** Fishing placeholder: a bite comes after this many ticks (2 to 6 seconds), and holds this long. */
    fishWaitMin: 60,
    fishWaitMax: 180,
    fishBiteTicks: 15,
  },
  cook: {
    maxIngredients: 3,
  },
} as const;
