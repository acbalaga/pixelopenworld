import { GUILD } from '../../content/balance/guilds';
import { CHIPS, GUILD_CHIPS, GUILD_WHISPERS, type Reply } from '../../content/chat/social';
import { GUILD_LINES, type GuildTrigger } from '../../content/chat/templates/guild';
import { ITEMS } from '../../content/items';
import { SKILLS } from '../../content/skills';
import { ITEM_STRINGS } from '../../content/strings/items';
import { FLAG } from '../../content/travelers/types';
import { findAvatar } from '../../shared/summary';
import { guildDef, joinGuild, meetsRule } from '../guild';
import { emit, type SimEvent } from '../kernel/events';
import { putOffer } from './social';
import type { Ctx, Helpers } from './engine';

/**
 * The guild side of chat (POW-M5-08). Invitations: a friend in a guild whose rule the player meets
 * whispers one, and so, less often, does one of the guild's officers. The player can also ask a
 * member from their profile card. Guild chat: the player's guildmates talk in the Guild channel in
 * their guild's tone, about what is really going on: who logged in or out, a rank or a drop, the
 * player joining or a weekly goal finished, and quiet evening talk.
 */

const pick = (list: readonly Reply[], temper: string, d: () => number): string => {
  const fit = list.filter((r) => !r.temper || r.temper === temper);
  return (fit[Math.floor(d() * fit.length)] ?? list[0]!).text;
};

const guildName = (id: number): string => guildDef(id)?.name ?? 'the guild';

function whisper(
  c: Ctx,
  h: Helpers,
  slot: number,
  text: string,
  template: string,
  chips: readonly string[],
  d: () => number,
): void {
  const offered = chips.map((id) => ({ id, text: CHIPS[id]!.text }));
  if (chips.length > 0)
    putOffer(c.chat, {
      slot,
      category: 'guildAsk',
      chips: [...chips],
      channel: 'whisper',
      minute: c.minute,
    });
  h.enqueue(c, {
    due: c.minute,
    slot,
    channel: 'whisper',
    text: h.voice(c, slot, text, d),
    template,
    source: h.source(c, `state:${template}:${slot}:${c.minute}`, template),
    reply: true,
    slots: {},
    chips: offered,
  });
}

/** An officer: a member whose best skill is at Practiced or better. */
const isOfficer = (c: Ctx, slot: number): boolean =>
  c.state.travelers[slot]!.build.some(([, p]) => p >= 25);

/** Friends and officers invite a player who meets their guild's rule, now and then. */
export function guildInvites(c: Ctx, h: Helpers): void {
  const { state, chat } = c;
  const me = findAvatar(state);
  if (me === null || state.guild.id !== 0) return;
  const crowd = state.crowd!;
  const d = h.dice(c, 9600 + c.minute);
  for (const t of c.ids) {
    const life = state.travelers[t.slot]!;
    const g = life.guild;
    if (g === 0 || crowd.online[t.slot] !== 1 || chat.guildInvites.has(t.slot)) continue;
    if ([...chat.guildInvites.values()].includes(g)) continue;
    const friend = (life.flags & FLAG.friend) !== 0;
    const officer = !friend && isOfficer(c, t.slot);
    if (!friend && !officer) continue;
    if (d() >= (friend ? GUILD.inviteChance : GUILD.officerInviteChance)) continue;
    if (!meetsRule(state, me, g)) continue;
    chat.guildInvites.set(t.slot, g);
    const text = pick(friend ? GUILD_WHISPERS.invite : GUILD_WHISPERS.officer, t.temper, d).replace(
      '{guild}',
      guildName(g),
    );
    whisper(c, h, t.slot, text, friend ? 'guild.invite' : 'guild.officer', GUILD_CHIPS, d);
    emit(state.events, { type: 'guildInvited', slot: t.slot, guild: g });
    return;
  }
}

/** The player asks a member to join their guild, from the profile card. */
export function guildAsk(c: Ctx, h: Helpers, slot: number): void {
  const { state } = c;
  const me = findAvatar(state);
  const life = state.travelers[slot]!;
  const t = c.ids[slot]!;
  const g = life.guild;
  if (me === null || g === 0 || state.crowd!.online[slot] !== 1) return;
  const d = h.dice(c, 9700 + slot + c.minute);
  emit(state.events, {
    type: 'playerSpoke',
    channel: 'whisper',
    slot,
    text: `Could I join ${guildName(g)}?`,
  });
  if (state.guild.id !== 0) {
    whisper(c, h, slot, pick(GUILD_WHISPERS.inGuild, t.temper, d), 'guild.inGuild', [], d);
    return;
  }
  if (!meetsRule(state, me, g)) {
    const text = pick(GUILD_WHISPERS.notYet, t.temper, d).replace('{guild}', guildName(g));
    whisper(c, h, slot, text, 'guild.notYet', [], d);
    return;
  }
  c.chat.guildInvites.set(slot, g);
  const text = pick(GUILD_WHISPERS.invite, t.temper, d).replace('{guild}', guildName(g));
  whisper(c, h, slot, text, 'guild.invite', GUILD_CHIPS, d);
  emit(state.events, { type: 'guildInvited', slot, guild: g });
}

/** The player answered an invitation chip. True when they joined. */
export function guildChip(c: Ctx, slot: number, chip: string): boolean {
  const g = c.chat.guildInvites.get(slot);
  if (g === undefined) return false;
  c.chat.guildInvites.delete(slot);
  const me = findAvatar(c.state);
  if (chip !== 'guild.yes' || me === null) return false;
  return joinGuild(c.state, me, g);
}

const itemName = (id: string): string => {
  const def = ITEMS[id];
  return (def ? ITEM_STRINGS[def.nameKey] : undefined) ?? 'something';
};

/** Lines of the player's guild for a trigger. */
const linesFor = (guild: number, trigger: GuildTrigger) =>
  GUILD_LINES.filter((l) => l.guild === guild && l.trigger === trigger);

/** Guild chat, once per in-game minute, from this minute's events and the guild's mood. */
export function guildChatter(c: Ctx, h: Helpers, events: readonly SimEvent[], minute = true): void {
  const { state } = c;
  const g = state.guild.id;
  if (g === 0) return;
  const crowd = state.crowd!;
  const members = c.ids.filter(
    (t) => state.travelers[t.slot]!.guild === g && crowd.online[t.slot] === 1,
  );
  const d = h.dice(c, 9800 + c.minute);
  let said = 0;
  const say = (slot: number, trigger: GuildTrigger, fills: Record<string, string> = {}): void => {
    if (said >= GUILD.chatBurst) return;
    const pool = linesFor(g, trigger);
    if (pool.length === 0) return;
    const line = pool[Math.floor(d() * pool.length)]!;
    const raw = line.text[Math.floor(d() * line.text.length)]!;
    const text = raw.replace(/\{([a-z]+)\}/g, (_, k: string) =>
      k === 'player' ? c.player : (fills[k] ?? ''),
    );
    said++;
    h.enqueue(c, {
      due: c.minute,
      slot,
      channel: 'guild',
      text: h.voice(c, slot, text, d),
      template: line.id,
      source: h.source(c, `state:${line.id}:${slot}:${c.minute}`, `guild:${trigger}`),
      reply: true,
      slots: {},
      chips: [],
    });
  };
  const anyone = (): number | null =>
    members.length > 0 ? members[Math.floor(d() * members.length)]!.slot : null;
  const isMember = (slot: number): boolean => state.travelers[slot]?.guild === g;
  for (const e of events) {
    if (e.type === 'travelerLoggedIn' && isMember(e.slot)) say(e.slot, 'hello');
    else if (e.type === 'travelerLoggedOut' && isMember(e.slot)) say(e.slot, 'bye');
    else if (e.type === 'travelerRankUp' && isMember(e.slot) && crowd.online[e.slot] === 1) {
      const who = anyone();
      if (who !== null)
        say(who, 'rank', { handle: c.ids[e.slot]!.handle, skill: SKILLS[e.skill]?.name ?? '' });
    } else if (
      e.type === 'travelerLooted' &&
      e.chance <= GUILD.lootChatPct &&
      isMember(e.slot) &&
      crowd.online[e.slot] === 1 &&
      d() < 0.5
    ) {
      const who = anyone();
      if (who !== null && who !== e.slot) say(who, 'loot', { item: itemName(e.item) });
    } else if (e.type === 'guildJoined') {
      const who = anyone();
      if (who !== null) say(who, 'welcome');
    } else if (e.type === 'guildGoalDone') {
      const who = anyone();
      if (who !== null) say(who, 'goal');
    }
  }
  // The guild's own talk: more members online, more talk.
  if (minute && members.length > 0 && d() < GUILD.chatPerMember * members.length) {
    const who = anyone();
    if (who !== null) say(who, c.phase === 'night' && d() < 0.4 ? 'night' : 'idle');
  }
}
