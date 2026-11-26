/**
 * Guilds (POW-M5-08, design/12 section 7, design/07 Guilds). Join rules, weekly goals and their pay
 * are data. Guild request pay is ledger entry `guildRequest`, bounded by the weeks played times the
 * most a week's goals can pay (the integrity check reads `GUILD_PAY_CEILING`).
 */

/** One part of a join rule. Skill points are the skill's rank. */
export type JoinCond =
  | { kind: 'skill'; skills: readonly string[]; min: number }
  | { kind: 'renown'; min: number }
  | { kind: 'coin'; min: number }
  | { kind: 'memberFriend' }
  | { kind: 'sharedActivity' }
  | { kind: 'duelWins'; min: number }
  | { kind: 'trial'; skill: string };

/** A guild takes the player when every `all` holds and, if there is an `any`, one of those holds. */
export interface JoinRule {
  all?: readonly JoinCond[];
  any?: readonly JoinCond[];
}

const ARMS = [
  'skill.blades',
  'skill.heavy_arms',
  'skill.polearms',
  'skill.archery',
  'skill.unarmed',
  'skill.shieldcraft',
];
const CRAFTS = [
  'skill.smithing',
  'skill.woodworking',
  'skill.tailoring',
  'skill.cooking',
  'skill.alchemy',
  'skill.enchanting',
  'skill.tinkering',
];

/** By guild id (design/12 section 7, "Joins by"). */
export const JOIN_RULES: Readonly<Record<number, JoinRule>> = {
  1: {
    all: [
      { kind: 'skill', skills: ARMS, min: 30 },
      { kind: 'renown', min: 20 },
    ],
  },
  2: { all: [{ kind: 'skill', skills: CRAFTS, min: 25 }] },
  3: { any: [{ kind: 'skill', skills: ['skill.cartography'], min: 20 }, { kind: 'memberFriend' }] },
  4: { any: [{ kind: 'memberFriend' }, { kind: 'skill', skills: ['skill.performance'], min: 10 }] },
  5: { all: [{ kind: 'skill', skills: ['skill.fishing'], min: 20 }] },
  6: {
    all: [
      { kind: 'skill', skills: ['skill.bartering'], min: 20 },
      { kind: 'coin', min: 500 },
    ],
  },
  7: { all: [{ kind: 'sharedActivity' }] },
  8: { any: [{ kind: 'skill', skills: ['skill.cooking', 'skill.farming'], min: 15 }] },
  9: { all: [{ kind: 'duelWins', min: 3 }] },
  10: { any: [{ kind: 'skill', skills: ['skill.taming'], min: 15 }] },
  11: { any: [{ kind: 'skill', skills: ['skill.alchemy', 'skill.stealth'], min: 25 }] },
  12: { all: [{ kind: 'trial', skill: 'skill.athletics' }] },
};

/** A weekly goal: give N of an item to the guild, or bring down N of a creature. */
export interface GoalDef {
  id: string;
  kind: 'give' | 'clear';
  /** Item id for `give`, creature id for `clear`. */
  thing: string;
  qty: number;
  coin: number;
  /** An item paid as well, from the guild's table. */
  item?: string;
  itemQty?: number;
}

const give = (id: string, thing: string, qty: number, coin: number): GoalDef => ({
  id,
  kind: 'give',
  thing,
  qty,
  coin,
});
const clear = (id: string, thing: string, qty: number, coin: number): GoalDef => ({
  id,
  kind: 'clear',
  thing,
  qty,
  coin,
});

/** Each guild's goal table. Three are picked each real week. */
export const GOALS: Readonly<Record<number, readonly GoalDef[]>> = {
  1: [
    clear('g1.boars', 'creature.bramble_boar', 6, 60),
    clear('g1.bones', 'creature.barrow_bones', 10, 70),
    clear('g1.hounds', 'creature.moorhound', 8, 60),
    give('g1.iron', 'item.iron_ingot', 6, 55),
  ],
  2: [
    give('g2.copper', 'item.copper_ingot', 10, 50),
    give('g2.planks', 'item.oak_plank', 12, 45),
    give('g2.thread', 'item.thread_spool', 8, 45),
    give('g2.leather', 'item.leather_strip', 10, 40),
  ],
  3: [
    clear('g3.hawks', 'creature.crag_hawk', 6, 50),
    give('g3.quartz', 'item.quartz', 5, 45),
    give('g3.clay', 'item.clay', 8, 35),
  ],
  4: [
    give('g4.cloth', 'item.wool_cloth', 6, 45),
    give('g4.oil', 'item.lantern_oil', 3, 40),
    give('g4.berries', 'item.berry_red', 12, 30),
    clear('g4.moss', 'creature.mossling', 12, 35),
  ],
  5: [
    give('g5.river', 'item.fish_river', 12, 40),
    give('g5.silver', 'item.fish_silver', 4, 55),
    clear('g5.crabs', 'creature.reed_crab', 8, 40),
  ],
  6: [
    give('g6.salt', 'item.salt', 12, 45),
    give('g6.linen', 'item.linen_cloth', 6, 50),
    give('g6.ingots', 'item.copper_ingot', 8, 45),
  ],
  7: [
    clear('g7.rats', 'creature.grain_rat', 10, 30),
    clear('g7.moss', 'creature.mossling', 10, 30),
    give('g7.berries', 'item.berry_blue', 10, 25),
    give('g7.sunwort', 'item.sunwort', 8, 30),
  ],
  8: [
    give('g8.dewmint', 'item.dewmint', 10, 35),
    give('g8.meat', 'item.raw_meat', 8, 40),
    give('g8.berries', 'item.berry_red', 10, 30),
  ],
  9: [
    clear('g9.hounds', 'creature.moorhound', 6, 50),
    clear('g9.boars', 'creature.bramble_boar', 5, 50),
    clear('g9.rubblets', 'creature.rubblet', 8, 45),
  ],
  10: [
    give('g10.dewmint', 'item.dewmint', 8, 35),
    clear('g10.leeches', 'creature.marsh_leech', 8, 40),
    give('g10.glowcap', 'item.glowcap', 4, 40),
  ],
  11: [
    give('g11.dew', 'item.dew_vial', 8, 40),
    give('g11.nightshade', 'item.nightshade', 4, 50),
    clear('g11.leeches', 'creature.marsh_leech', 8, 40),
  ],
  12: [
    clear('g12.hares', 'creature.meadow_hare', 12, 40),
    clear('g12.hawks', 'creature.crag_hawk', 6, 50),
    give('g12.ash', 'item.ash_log', 10, 35),
  ],
};

export const GUILD = {
  /** Goals a guild posts each real week. */
  goalsPerWeek: 3,
  /** Stash slots. */
  stashSlots: 24,
  /** A Traveler switches guilds at this chance per real day they log in. */
  switchPerDay: 0.01,
  /** A friend in a guild whose rule the player meets invites them, at this chance per in-game minute while online. */
  inviteChance: 0.01,
  /** An officer (a member at Practiced or better in their best skill) invites a player who meets the rule. */
  officerInviteChance: 0.004,
  /** Guild chat: chance per in-game minute, per online member, that someone says something. */
  chatPerMember: 0.03,
  /** A guildmate's drop is remarked on only when it is this rare (drop chance, percent). */
  lootChatPct: 10,
  /** At most this many guild lines in a minute. */
  chatBurst: 2,
  /** A guildmate idling in town keeps to the hall this share of the time. */
  hallChance: 0.08,
} as const;

/** The most a week of goals can pay any guild, in coin, for the integrity bound. */
export const GUILD_PAY_CEILING: number = Math.max(
  ...Object.values(GOALS).map((list) =>
    [...list]
      .map((g) => g.coin)
      .sort((a, b) => b - a)
      .slice(0, GUILD.goalsPerWeek)
      .reduce((a, b) => a + b, 0),
  ),
);
