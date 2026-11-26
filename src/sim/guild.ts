import { GOALS, GUILD, JOIN_RULES, type GoalDef, type JoinCond } from '../content/balance/guilds';
import { GUILDS } from '../content/travelers/guilds';
import { FIXTURES } from '../content/world/fixtures';
import { FLAG, MEMORY_KINDS } from '../content/travelers/types';
import { getComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { addStack, countItem, give, removeItem } from './items';
import { earnCoin } from './ledger';
import { renownIn } from './renown';
import type { ItemStack, SimState } from './state';
import { contextTarget } from './systems/interact';
import { hash01 } from './travelers/dice';
import { dayIndexOf, localMinute } from './travelers/schedule';

/**
 * Guilds (POW-M5-08, design/12 section 7). The player belongs to at most one guild. Joining needs
 * the guild's rule (`JOIN_RULES`) and an invitation: a friend in the guild or an officer sends one,
 * or the player asks a member from their profile card. A guild gives a hall (Lantern Players and
 * Hearth and Home in Hearthford, the inn's back room for the rest until their region is baked), a
 * shared stash, a weekly goal board and Guild chat.
 *
 * Saved (`state.guild`): the guild id, each guild's stash, and this week's goal progress. The stash
 * only ever holds what the player put in it: items are moved, never created. Goals pay coin and an
 * item through the ledger entry `guildRequest`.
 */

export interface GuildState {
  /** The player's guild, 1 to 12, or 0 for none. */
  id: number;
  /** Stash slots by guild id. A guild the player left keeps what was left in it. */
  stashes: Record<string, (ItemStack | null)[]>;
  /** The real week the goals are for, their progress, and which are paid. */
  week: number;
  progress: number[];
  paid: number[];
}

export function newGuildState(): GuildState {
  return { id: 0, stashes: {}, week: -1, progress: [], paid: [] };
}

export const guildDef = (id: number): (typeof GUILDS)[number] | undefined =>
  GUILDS.find((g) => g.id === id);

/** The hall a guild meets in: its own (4, 7) or the inn's back room (0). */
export const hallOf = (guild: number): number => (guild === 4 || guild === 7 ? guild : 0);

const MEM_PARTIED = MEMORY_KINDS.indexOf('partied');
const MEM_FOUGHT = MEMORY_KINDS.indexOf('foughtNear');

function holds(state: SimState, who: EntityId, c: JoinCond, guild: number): boolean {
  switch (c.kind) {
    case 'skill': {
      const pts = getComp(state.entities, who, 'skills')?.points ?? {};
      return c.skills.some((s) => (pts[s] ?? 0) >= c.min);
    }
    case 'renown':
      return renownIn(state, who, 'dawnmeadow') >= c.min;
    case 'coin':
      return (getComp(state.entities, who, 'avatar')?.coin ?? 0) >= c.min;
    case 'memberFriend':
      return state.travelers.some((l) => l.guild === guild && (l.flags & FLAG.friend) !== 0);
    case 'sharedActivity':
      return state.travelers.some(
        (l) =>
          l.guild === guild &&
          l.memory.some((m) => m.kind === MEM_PARTIED || m.kind === MEM_FOUGHT),
      );
    case 'duelWins':
      return state.mail.duels.wins >= c.min;
    case 'trial':
      return (getComp(state.entities, who, 'skills')?.passed ?? []).some((p) =>
        p.startsWith(`${c.skill}@`),
      );
  }
}

/** True if the player meets a guild's join rule now. */
export function meetsRule(state: SimState, who: EntityId, guild: number): boolean {
  const rule = JOIN_RULES[guild];
  if (!rule) return false;
  if (rule.all && !rule.all.every((c) => holds(state, who, c, guild))) return false;
  if (rule.any && !rule.any.some((c) => holds(state, who, c, guild))) return false;
  return true;
}

// ---- Goals ----

/** The real week index now, from the clock, or -1 without one. */
export function weekNow(state: SimState): number {
  const c = state.clock;
  if (!c) return -1;
  return Math.floor(dayIndexOf(localMinute(c.nowMs, c.tzOffsetMin)) / 7);
}

/** The goals a guild posts in a week: a fixed pick from its table by the world seed. */
export function goalsFor(seed: number, guild: number, week: number): GoalDef[] {
  const table = [...(GOALS[guild] ?? [])];
  const out: GoalDef[] = [];
  let n = 0;
  while (out.length < GUILD.goalsPerWeek && table.length > 0) {
    const i = Math.floor(hash01(seed, guild, 820 + n++, week) * table.length);
    out.push(table.splice(i, 1)[0]!);
  }
  return out;
}

/** Starts the week's goals over when the week or the guild changes. */
function freshWeek(g: GuildState, week: number): void {
  g.week = week;
  g.progress = Array.from({ length: GUILD.goalsPerWeek }, () => 0);
  g.paid = Array.from({ length: GUILD.goalsPerWeek }, () => 0);
}

/** The current goals of the player's guild, with progress. Empty when not in a guild. */
export function currentGoals(state: SimState): { def: GoalDef; progress: number; paid: boolean }[] {
  const g = state.guild;
  if (g.id === 0 || g.week < 0) return [];
  return goalsFor(state.seed, g.id, g.week).map((def, i) => ({
    def,
    progress: g.progress[i] ?? 0,
    paid: (g.paid[i] ?? 0) === 1,
  }));
}

// ---- Membership ----

/** Joins a guild if the player is in none and meets its rule. */
export function joinGuild(state: SimState, who: EntityId, guild: number): boolean {
  const g = state.guild;
  if (g.id !== 0 || !guildDef(guild) || !meetsRule(state, who, guild)) return false;
  g.id = guild;
  freshWeek(g, weekNow(state));
  emit(state.events, { type: 'guildJoined', guild });
  return true;
}

/** Leaves the guild. The stash stays with the guild; this week's goal progress is dropped. */
export function leaveGuild(state: SimState): void {
  const g = state.guild;
  if (g.id === 0) return;
  const was = g.id;
  g.id = 0;
  g.week = -1;
  g.progress = [];
  g.paid = [];
  emit(state.events, { type: 'guildLeft', guild: was });
}

/** The hall fixture the avatar faces, as its hall number, or null. */
function hallFaced(state: SimState, who: EntityId): number | null {
  const t = contextTarget(state, who);
  const kind = t === null ? undefined : getComp(state.entities, t, 'fixture')?.kind;
  const def = kind ? FIXTURES[kind] : undefined;
  return def?.type === 'guildHall' ? (def.hall ?? 0) : null;
}

/** True when the avatar is at its own guild's hall (or the back room, for a guild with no hall). */
export function atOwnHall(state: SimState, who: EntityId): boolean {
  const g = state.guild;
  return g.id !== 0 && hallFaced(state, who) === hallOf(g.id);
}

/** The stash of the player's guild, made on first use. */
export function stashOf(state: SimState): (ItemStack | null)[] | null {
  const g = state.guild;
  if (g.id === 0) return null;
  const s = (g.stashes[String(g.id)] ??= []);
  while (s.length < GUILD.stashSlots) s.push(null);
  return s;
}

/**
 * Moves a whole stack between the bag and the guild stash, at the hall. Whatever does not fit stays
 * where it was. Items are never created or lost here.
 */
export function moveStash(
  state: SimState,
  who: EntityId,
  dir: 'in' | 'out',
  slot: number,
): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const stash = stashOf(state);
  if (!inv || !stash || !atOwnHall(state, who)) return false;
  const from = dir === 'in' ? inv.slots : stash;
  const to = dir === 'in' ? stash : inv.slots;
  const stack = from[slot];
  if (!stack) return false;
  const left = addStack(to, { ...stack });
  const moved = stack.qty - left;
  if (moved === 0) return false;
  if (left === 0) from[slot] = null;
  else stack.qty = left;
  emit(state.events, { type: 'guildStashMoved', item: stack.item, qty: moved, dir });
  return true;
}

/** Gives what the bag holds toward a `give` goal, at the hall, up to what it still needs. */
export function contribute(state: SimState, who: EntityId, i: number): number {
  const goal = currentGoals(state)[i];
  const inv = getComp(state.entities, who, 'inventory');
  if (!goal || goal.def.kind !== 'give' || !inv || !atOwnHall(state, who)) return 0;
  const want = goal.def.qty - goal.progress;
  const n = Math.min(want, countItem(inv, goal.def.thing));
  if (n <= 0 || !removeItem(inv, goal.def.thing, n)) return 0;
  state.guild.progress[i] = goal.progress + n;
  emit(state.events, { type: 'guildContributed', goal: goal.def.id, qty: n });
  return n;
}

/** Takes a finished goal's pay, once, at the hall. Ledger entry `guildRequest`. */
export function claimGoal(state: SimState, who: EntityId, i: number): boolean {
  const goal = currentGoals(state)[i];
  if (!goal || goal.paid || goal.progress < goal.def.qty || !atOwnHall(state, who)) return false;
  state.guild.paid[i] = 1;
  earnCoin(state, who, goal.def.coin, 'guildRequest');
  if (goal.def.item && goal.def.itemQty) {
    give(state, who, goal.def.item, goal.def.itemQty, 'guildRequest');
  }
  emit(state.events, { type: 'guildGoalDone', goal: goal.def.id, coin: goal.def.coin });
  return true;
}

/** A guild command from the hall, the Menu or a profile card. */
export function guildCommand(
  state: SimState,
  who: EntityId,
  c: { op: 'leave' | 'stash' | 'give' | 'claim'; dir?: 'in' | 'out'; slot?: number; goal?: number },
): void {
  if (c.op === 'leave') leaveGuild(state);
  else if (c.op === 'stash' && c.dir && c.slot !== undefined) moveStash(state, who, c.dir, c.slot);
  else if (c.op === 'give' && c.goal !== undefined) contribute(state, who, c.goal);
  else if (c.op === 'claim' && c.goal !== undefined) claimGoal(state, who, c.goal);
}

/**
 * Once a tick: keeps the week's goals current and counts kills toward `clear` goals. A goal counts
 * only kills by the player's own hand.
 */
export function guildSystem(state: SimState): void {
  const g = state.guild;
  if (g.id === 0) return;
  const week = weekNow(state);
  if (week >= 0 && week !== g.week) freshWeek(g, week);
  if (g.week < 0) return;
  const goals = goalsFor(state.seed, g.id, g.week);
  for (const e of state.events.list) {
    if (e.type !== 'killed' || !getComp(state.entities, e.src, 'avatar')) continue;
    goals.forEach((def, i) => {
      if (def.kind === 'clear' && def.thing === e.kind && (g.progress[i] ?? 0) < def.qty)
        g.progress[i] = (g.progress[i] ?? 0) + 1;
    });
  }
}

/** Total stash item count, for the tests: moving never changes it plus the bag's. */
export function stashCount(state: SimState): number {
  let n = 0;
  for (const s of Object.values(state.guild.stashes)) for (const st of s) if (st) n += st.qty;
  return n;
}
