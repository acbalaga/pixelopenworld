import { FRIENDS, MEMORY } from '../../content/balance/social';
import {
  CHIPS,
  CHIP_SETS,
  DUEL_CHIPS,
  DUEL_LINES,
  EMOTE_CHIPS,
  HELLO_CHIPS,
  INTENT_SETS,
  MEMORY_CHIPS,
  MEMORY_LINES,
  REPLIES,
  RIVAL_LINES,
  REQUEST_CHIPS,
  WAKE,
  WHISPERS,
  type Reply,
} from '../../content/chat/social';
import { TEMPLATES } from '../../content/chat/templates';
import type { Category, ChipIntent } from '../../content/chat/types';
import { CREATURES } from '../../content/creatures';
import { SKILLS, TRIALS } from '../../content/skills';
import { ITEMS } from '../../content/items';
import { ITEM_STRINGS } from '../../content/strings/items';
import { PARTY_LINES } from '../../content/chat/party';
import { DUELIST_LINES, PIT_LINES } from '../../content/chat/pit';
import { PIT_HONOR_NAMES } from '../../content/strings/pit';
import { pitWatchers } from '../pitBouts';
import { FLAG, MEMORY_KINDS, type MemoryKind } from '../../content/travelers/types';
import { findAvatar } from '../../shared/summary';
import { emit, type SimEvent } from '../kernel/events';
import { SUBPX } from '../kernel/fixed';
import { OTHER_BOARDS } from '../rankings/boards';
import { isAsleep } from '../travelers/entities';
import { SKILL_LIST } from '../travelers/lists';
import {
  canAsk,
  isFriend,
  friendSlots,
  makeFriends,
  remember,
  removeFriend,
  tierNow,
  touch,
  updateRival,
  wouldAccept,
} from '../travelers/social';
import type { TravelerIdentity } from '../travelers/types';
import { DUELS } from '../../content/balance/mail';
import { PIT } from '../../content/balance/travelers';
import { DUNGEON_NAMES } from '../../content/chat/names';
import { acceptsDuel, startDuel } from '../duel';
import type { Ctx, Helpers } from './engine';
import { guildAsk, guildChip } from './guild';
import { writeDuelNote } from './letters';

/**
 * The social side of chat (POW-M5-06): reply chips and the Traveler's answer, memory of the player,
 * friend requests both ways, whispers, and the lines that bring a memory up. The engine calls these
 * once per abstract minute and when the player sends a command. Everything is seeded dice from the
 * engine and the sim state: nothing here reads a clock or a random source.
 */

/** What the player may answer with, per Traveler, until they answer or it goes stale. */
export interface Offer {
  slot: number;
  category: Category | 'request' | 'hello' | 'duelAsk' | 'guildAsk';
  chips: string[];
  channel: 'local' | 'whisper';
  minute: number;
}

/** A player command waiting for the next chat step. */
export type Inbox =
  | { type: 'chip'; slot: number; chip: string }
  | { type: 'friend'; slot: number; op: 'request' | 'accept' | 'decline' | 'remove' }
  | { type: 'poke'; slot: number }
  | { type: 'duel'; slot: number }
  | { type: 'guildAsk'; slot: number };

/** Abstract minutes (two real seconds each) an offer of chips lasts: a minute of real time. */
export const OFFER_MIN = 30;

const TEMPLATE_OF = new Map(TEMPLATES.map((t) => [t.id, t]));

/**
 * The chips for a line of a category (or of an intent, when its category is too broad), trimmed
 * or added to by regard tier. Always 2 to 4.
 */
export function chipsFor(kind: Category | ChipIntent, tier: number): string[] {
  return finishChips(
    kind in INTENT_SETS ? INTENT_SETS[kind as ChipIntent] : CHIP_SETS[kind as Category],
    tier,
  );
}

function finishChips(base: readonly string[], tier: number): string[] {
  let set = [...base];
  // A stranger gets no joking about, and a friend can say goodbye after a hello.
  if (tier === 0) set = set.filter((id) => id !== 'joke');
  if (tier >= 2 && set.length < 4 && set.includes('hi') && !set.includes('later'))
    set.push('later');
  for (const pad of ['hi', 'thanks', 'more'])
    if (set.length < 2 && !set.includes(pad)) set.push(pad);
  return set.slice(0, 4);
}

const PIT_DUELISTS = PIT;

const pickReply = (list: readonly Reply[], t: TravelerIdentity, d: () => number): string => {
  const fit = list.filter((r) => !r.temper || r.temper === t.temper);
  const pool = fit.length > 0 ? fit : list;
  return (pool[Math.floor(d() * pool.length)] as Reply).text;
};

/** A Traveler's answer to a chip, in their temper. Voice is applied by the caller. */
export const replyFor = (chip: string, t: TravelerIdentity, d: () => number): string | null => {
  const list = REPLIES[chip];
  return list && list.length > 0 ? pickReply(list, t, d) : null;
};

/** What a Traveler says when poked awake: grumpy, or friendlier to a Friend (POW-M5-31). */
export const wakeFor = (friend: boolean, t: TravelerIdentity, d: () => number): string =>
  pickReply(friend ? WAKE.friendly : WAKE.grumpy, t, d);

/** A whispered line of a kind, in the Traveler's temper. */
export const whisperFor = (
  kind: keyof typeof WHISPERS,
  t: TravelerIdentity,
  d: () => number,
): string => pickReply(WHISPERS[kind], t, d);

const creatureIds = Object.keys(CREATURES);
const boardIds: readonly string[] = [...SKILL_LIST, ...OTHER_BOARDS];

const boardName = (idx: number): string => {
  const id = boardIds[idx] ?? '';
  return SKILLS[id]?.name ?? id.replace(/^board\./, '');
};

/** The name a memory subject reads as in a line. */
export function subjectName(kind: number, subject: number): string {
  const k = MEMORY_KINDS[kind];
  if (k === 'foughtNear') return CREATURES[creatureIds[subject] ?? '']?.name ?? '';
  if (k === 'passedOnBoard') return boardName(subject);
  return '';
}

export function daysAgoText(day: number, today: number): string {
  const n = Math.max(0, today - day);
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
}

/**
 * Stores the chips a line offers, if it is a line the player can answer. Only a line that is
 * addressed to the player, or about them, can be answered: one that names them (`{player}`, which
 * covers the reactions to their public deeds). Chatter between other people is not for them to
 * answer, so nothing offers chips for it. Returns the chips.
 */
export function offerFor(
  c: Ctx,
  slot: number,
  template: string,
  channel: 'world' | 'local' | 'whisper' | 'party' | 'guild',
  slots: Record<string, string>,
): { id: string; text: string }[] {
  if (
    channel === 'world' ||
    channel === 'party' ||
    channel === 'guild' ||
    slots.player === undefined
  )
    return [];
  const tpl = TEMPLATE_OF.get(template);
  if (!tpl) return [];
  const category = tpl.category;
  const life = c.state.travelers[slot];
  if (!life) return [];
  const ids = chipsFor(tpl.answers ?? category, tierNow(life, c.real));
  c.chat.offers.set(slot, { slot, category, chips: ids, channel, minute: c.minute });
  return ids.map((id) => ({ id, text: CHIPS[id]!.text }));
}

const avatarPos = (c: Ctx): { x: number; y: number } | null => {
  const me = findAvatar(c.state);
  const p = me === null ? undefined : c.state.entities.comps.pos[me];
  return p ? { x: p.x / SUBPX, y: p.y / SUBPX } : null;
};

/** Promoted Travelers within `px` of the player, by slot. */
function nearSlots(c: Ctx, px: number): number[] {
  const me = avatarPos(c);
  if (!me) return [];
  const out: number[] = [];
  for (const [id, ent] of c.state.crowd!.ents) {
    const p = c.state.entities.comps.pos[id];
    if (p && Math.hypot(p.x / SUBPX - me.x, p.y / SUBPX - me.y) <= px) out.push(ent.slot);
  }
  return out;
}

/** Adds a memory unless the newest is the same thing on the same day. */
function rememberOnce(c: Ctx, slot: number, kind: MemoryKind, subject: number): void {
  const life = c.state.travelers[slot]!;
  const k = MEMORY_KINDS.indexOf(kind);
  const last = life.memory[life.memory.length - 1];
  if (last && last.kind === k && last.subject === subject && last.day === c.day) {
    touch(life, c.real);
    return;
  }
  remember(life, kind, subject, c.day, c.real);
}

/** Keeps contact fresh for Travelers near the player and marks them as met. */
export function touchNear(c: Ctx): void {
  for (const slot of nearSlots(c, MEMORY.contactPx)) {
    const life = c.state.travelers[slot]!;
    touch(life, c.real);
    life.flags |= FLAG.met;
  }
}

/** True if an event is one a Traveler may remember. */
export const memorable = (e: SimEvent): boolean =>
  e.type.startsWith('party') ||
  e.type.startsWith('pit') ||
  e.type === 'worldEventStarted' ||
  e.type === 'raidEnded' ||
  e.type === 'killed' ||
  e.type === 'playerPassed' ||
  e.type === 'duelStarted' ||
  e.type === 'duelEnded' ||
  e.type === 'delved' ||
  e.type === 'died';

/** Records what the player did near a Traveler, from this tick's events. */
export function recordMemories(c: Ctx, events: readonly SimEvent[]): void {
  const me = findAvatar(c.state);
  if (me === null) return;
  for (const e of events) {
    if (e.type === 'killed' && e.src === me) {
      const idx = creatureIds.indexOf(e.kind);
      if (idx < 0) continue;
      for (const slot of nearSlots(c, MEMORY.nearPx)) rememberOnce(c, slot, 'foughtNear', idx);
    } else if (e.type === 'playerPassed') {
      const idx = boardIds.indexOf(e.board);
      if (idx >= 0) rememberOnce(c, e.slot, 'passedOnBoard', idx);
    }
  }
}

/** The text of a memory line for a Traveler's newest memory, or null if none can be filled. */
function memoryText(
  c: Ctx,
  slot: number,
  d: () => number,
): { text: string; chips: string[] } | null {
  const life = c.state.travelers[slot]!;
  for (let i = life.memory.length - 1; i >= 0; i--) {
    const m = life.memory[i]!;
    const kind = MEMORY_KINDS[m.kind];
    const lines = kind ? MEMORY_LINES[kind] : undefined;
    if (!lines) continue;
    const subject = subjectName(m.kind, m.subject);
    const fit = lines.filter((t) => subject !== '' || !t.includes('{memory.subject}'));
    if (fit.length === 0) continue;
    const text = (fit[Math.floor(d() * fit.length)] as string)
      .replace(/\{memory\.subject\}/g, subject)
      .replace(/\{memory\.daysAgo\}/g, daysAgoText(m.day, c.day));
    return { text, chips: [...(MEMORY_CHIPS[kind!] ?? HELLO_CHIPS)] };
  }
  return null;
}

function saySocial(
  c: Ctx,
  h: Helpers,
  slot: number,
  channel: 'local' | 'whisper',
  text: string,
  template: string,
  fact: string,
  offer: { category: Offer['category']; chips: readonly string[] } | null,
  due = c.minute + 1,
): void {
  const d = h.dice(c, 8000 + slot + c.minute);
  const voiced = h.voice(c, slot, text, d);
  const chips = offer ? offer.chips.map((id) => ({ id, text: CHIPS[id]!.text })) : [];
  if (offer)
    c.chat.offers.set(slot, {
      slot,
      category: offer.category,
      chips: [...offer.chips],
      channel,
      minute: due,
    });
  h.enqueue(c, {
    due,
    slot,
    channel,
    text: voiced,
    template,
    source: h.source(c, `state:${template}:${slot}:${c.minute}`, fact),
    reply: false,
    slots: {},
    chips,
  });
}

/** A Traveler near the player who has shared activity and has enough regard asks to be friends. */
export function friendAsks(c: Ctx, h: Helpers): void {
  const { state, chat } = c;
  const crowd = state.crowd!;
  // A request nobody answered lapses, and so does one left from an earlier session.
  state.travelers.forEach((life, slot) => {
    if ((life.flags & FLAG.requestIn) === 0) return;
    const at = chat.asked.get(slot);
    if (at === undefined || c.real - at > FRIENDS.lapseMin) {
      life.flags &= ~FLAG.requestIn;
      chat.asked.delete(slot);
    }
  });
  const d = h.dice(c, 8100 + c.minute);
  if (d() >= FRIENDS.askChance * 6) return;
  const pool = nearSlots(c, MEMORY.contactPx).filter((slot) => {
    const life = state.travelers[slot]!;
    return (
      crowd.online[slot] === 1 &&
      canAsk(life, c.ids[slot]!.temper, c.real) &&
      h.canSpeak(c, slot) &&
      friendSlots(state).length < FRIENDS.max
    );
  });
  if (pool.length === 0) return;
  const slot = pool[Math.floor(d() * pool.length)] as number;
  state.travelers[slot]!.flags |= FLAG.requestIn;
  chat.asked.set(slot, c.real);
  saySocial(
    c,
    h,
    slot,
    'whisper',
    whisperFor('request', c.ids[slot]!, d),
    'whisper.request',
    'friend:request',
    { category: 'request', chips: REQUEST_CHIPS },
  );
  emit(state.events, { type: 'friendChanged', slot, change: 'requested' });
}

/** A friend logs in: a request the player sent is answered, or they say hello (or remember). */
export function loginHellos(c: Ctx, h: Helpers, events: readonly SimEvent[]): void {
  const crowd = c.state.crowd!;
  for (const e of events) {
    if (e.type === 'travelerLoggedOut') c.chat.said.delete(e.slot);
    if (e.type !== 'travelerLoggedIn' || crowd.online[e.slot] !== 1) continue;
    const life = c.state.travelers[e.slot]!;
    if ((life.flags & FLAG.requestOut) !== 0) {
      answerRequest(c, h, e.slot);
      continue;
    }
    if (!isFriend(life)) continue;
    const d = h.dice(c, 8200 + e.slot + c.minute);
    if (d() >= 0.7) continue;
    const mem = c.chat.said.has(e.slot) ? null : memoryText(c, e.slot, d);
    if (mem !== null) {
      c.chat.said.add(e.slot);
      saySocial(
        c,
        h,
        e.slot,
        'whisper',
        mem.text,
        'whisper.memory',
        'memory:login',
        { category: 'hello', chips: mem.chips },
        c.minute + 2,
      );
    } else
      saySocial(
        c,
        h,
        e.slot,
        'whisper',
        whisperFor('hello', c.ids[e.slot]!, d),
        'whisper.hello',
        'friend:login',
        { category: 'hello', chips: HELLO_CHIPS },
        c.minute + 2,
      );
  }
}

/** Travelers near the player sometimes bring an earlier memory up, once each per session. */
export function memoryLines(c: Ctx, h: Helpers): void {
  const d = h.dice(c, 8300 + c.minute);
  if (d() >= 0.04 * 6) return;
  const pool = nearSlots(c, MEMORY.contactPx).filter((slot) => {
    const life = c.state.travelers[slot]!;
    return (
      c.state.crowd!.online[slot] === 1 &&
      !c.chat.said.has(slot) &&
      life.memory.length > 0 &&
      tierNow(life, c.real) >= 1 &&
      h.canSpeak(c, slot) &&
      c.real - life.lastSeen >= 0
    );
  });
  if (pool.length === 0) return;
  const slot = pool[Math.floor(d() * pool.length)] as number;
  const mem = memoryText(c, slot, d);
  if (mem === null) return;
  c.chat.said.add(slot);
  const friend = isFriend(c.state.travelers[slot]!);
  saySocial(c, h, slot, friend ? 'whisper' : 'local', mem.text, 'memory.line', 'memory:near', {
    category: 'greet',
    chips: finishChips(mem.chips, tierNow(c.state.travelers[slot]!, c.real)),
  });
}

/** Resolves a request the player sent to a Traveler who is now online. */
function answerRequest(c: Ctx, h: Helpers, slot: number): void {
  const life = c.state.travelers[slot]!;
  const t = c.ids[slot]!;
  const d = h.dice(c, 8400 + slot + c.minute);
  life.flags &= ~FLAG.requestOut;
  if (wouldAccept(life, t.temper, c.real) && friendSlots(c.state).length < FRIENDS.max) {
    makeFriends(life, c.real);
    saySocial(
      c,
      h,
      slot,
      'whisper',
      whisperFor('accepted', t, d),
      'whisper.accepted',
      'friend:accepted',
      null,
    );
    emit(c.state.events, { type: 'friendChanged', slot, change: 'added' });
  } else {
    saySocial(
      c,
      h,
      slot,
      'whisper',
      whisperFor('declined', t, d),
      'whisper.declined',
      'friend:declined',
      null,
    );
    emit(c.state.events, { type: 'friendChanged', slot, change: 'declined' });
  }
}

const EMOTE_TEXT: Readonly<Record<string, string>> = {
  wave: 'waves',
  cheer: 'cheers',
  bow: 'bows',
  laugh: 'laughs',
};

/** The player's commands, handled when they arrive. */
export function processInbox(c: Ctx, h: Helpers): void {
  const items = c.chat.inbox.splice(0);
  const crowd = c.state.crowd!;
  for (const it of items) {
    const slot = it.slot;
    if (!Number.isInteger(slot) || slot < 0 || slot >= c.state.travelers.length) continue;
    const life = c.state.travelers[slot]!;
    const t = c.ids[slot]!;
    const d = h.dice(c, 8500 + slot + c.minute);
    if (it.type === 'duel') {
      challenge(c, h, slot);
      continue;
    }
    if (it.type === 'guildAsk') {
      guildAsk(c, h, slot);
      continue;
    }
    if (it.type === 'poke') {
      // A joke, not an interaction: no memory, no regard, no contact. One reaction per Traveler a session.
      const ent = crowd.ents.get(crowd.entOf[slot] ?? -1);
      if (!ent || !isAsleep(ent) || c.chat.poked.has(slot)) continue;
      if (!nearSlots(c, MEMORY.contactPx).includes(slot)) continue;
      c.chat.poked.add(slot);
      ent.woke = true;
      ent.emote = null;
      const line = wakeFor(isFriend(life), t, d);
      h.enqueue(c, {
        due: c.minute + 1,
        slot,
        channel: 'local',
        text: h.voice(c, slot, line, d),
        template: 'wake.poke',
        source: h.source(c, `state:wake:${slot}:${c.minute}`, 'poke'),
        reply: true,
        slots: {},
        chips: [],
      });
      continue;
    }
    if (it.type === 'friend') {
      if (it.op === 'request') {
        if (isFriend(life) || (life.flags & FLAG.met) === 0) continue;
        emit(c.state.events, { type: 'friendChanged', slot, change: 'requested' });
        life.flags |= FLAG.requestOut;
        if (crowd.online[slot] === 1) answerRequest(c, h, slot);
      } else if (it.op === 'remove') {
        if (!isFriend(life)) continue;
        removeFriend(life);
        emit(c.state.events, { type: 'friendChanged', slot, change: 'removed' });
      } else if ((life.flags & FLAG.requestIn) !== 0) {
        life.flags &= ~FLAG.requestIn;
        c.chat.asked.delete(slot);
        if (it.op === 'accept' && friendSlots(c.state).length < FRIENDS.max) {
          makeFriends(life, c.real);
          emit(c.state.events, { type: 'friendChanged', slot, change: 'added' });
        } else emit(c.state.events, { type: 'friendChanged', slot, change: 'declined' });
      }
      continue;
    }
    // A chip. Emotes need only a Traveler near enough to see. Others need an offer still open.
    const chip = CHIPS[it.chip];
    if (!chip) continue;
    const emote = EMOTE_CHIPS.includes(it.chip);
    const offer = c.chat.offers.get(slot);
    if (emote) {
      if (crowd.online[slot] !== 1 || !nearSlots(c, MEMORY.contactPx).includes(slot)) continue;
    } else if (!offer || !offer.chips.includes(it.chip) || c.minute - offer.minute > OFFER_MIN)
      continue;
    const channel = emote ? 'local' : (offer as Offer).channel;
    emit(c.state.events, {
      type: 'playerSpoke',
      channel,
      slot,
      text: emote ? (EMOTE_TEXT[it.chip] ?? chip.text) : chip.text,
    });
    touch(life, c.real);
    life.flags |= FLAG.met;
    if (!emote) c.chat.offers.delete(slot);
    if (!emote && (offer as Offer).category === 'question') rememberOnce(c, slot, 'answered', 0);
    if ((it.chip === 'guild.yes' || it.chip === 'guild.no') && offer?.category === 'guildAsk') {
      guildChip(c, slot, it.chip);
    } else if (it.chip === 'duel.yes' && offer?.category === 'duelAsk') {
      if (startDuel(c.state, slot)) c.chat.duelAsked.add(slot);
    } else if (it.chip === 'friend.yes') {
      life.flags &= ~FLAG.requestIn;
      c.chat.asked.delete(slot);
      makeFriends(life, c.real);
      emit(c.state.events, { type: 'friendChanged', slot, change: 'added' });
    } else if (it.chip === 'friend.no' || it.chip === 'duel.no') {
      life.flags &= ~FLAG.requestIn;
      c.chat.asked.delete(slot);
      emit(c.state.events, { type: 'friendChanged', slot, change: 'declined' });
    }
    const text = replyFor(it.chip, t, d);
    if (text === null || crowd.online[slot] !== 1) continue;
    h.enqueue(c, {
      due: c.minute + 1,
      slot,
      channel,
      text: h.voice(c, slot, text, d),
      template: `reply.${it.chip}`,
      source: h.source(c, `state:reply:${slot}:${c.minute}`, `chip:${it.chip}`),
      reply: true,
      slots: {},
      chips: [],
    });
  }
}

const lineFor = (
  list: readonly Reply[],
  t: TravelerIdentity,
  d: () => number,
  fills: Record<string, string> = {},
): string => pickReply(list, t, d).replace(/\{([a-z]+)\}/g, (_, k: string) => fills[k] ?? '');

function say(
  c: Ctx,
  h: Helpers,
  slot: number,
  text: string,
  template: string,
  channel: 'local' | 'world' | 'whisper' | 'party',
  d: () => number,
  due = c.minute + 1,
): void {
  h.enqueue(c, {
    due,
    slot,
    channel,
    text: h.voice(c, slot, text, d),
    template,
    source: h.source(c, `state:${template}:${slot}:${c.minute}`, template),
    reply: true,
    slots: {},
    chips: [],
  });
}

/** The player challenges a Traveler from their profile card. */
function challenge(c: Ctx, h: Helpers, slot: number): void {
  const t = c.ids[slot]!;
  const d = h.dice(c, 8600 + slot + c.minute);
  const near = nearSlots(c, DUELS.nearPx).includes(slot);
  if (c.state.crowd!.online[slot] !== 1 || !near || c.state.duel) return;
  if (acceptsDuel(c.state, slot, t.temper, c.real) && startDuel(c.state, slot)) {
    say(c, h, slot, lineFor(DUEL_LINES.accept, t, d), 'duel.accept', 'local', d);
    emit(c.state.events, { type: 'playerSpoke', channel: 'local', slot, text: 'Duel?' });
  } else say(c, h, slot, lineFor(DUEL_LINES.refuse, t, d), 'duel.refuse', 'local', d);
}

/** Is this Traveler the sort who asks for a duel: bold, or in the duelists' guild, or named for it. */
const duelMinded = (c: Ctx, slot: number): boolean =>
  c.ids[slot]!.temper === 'bold' ||
  PIT_DUELISTS.guilds.includes(c.state.travelers[slot]!.guild) ||
  PIT_DUELISTS.handles.includes(c.ids[slot]!.handle);

/** A duel-minded Traveler near the player, who has met them, sometimes asks for a duel, by whisper. */
export function duelAsks(c: Ctx, h: Helpers): void {
  if (c.state.duel) return;
  const d = h.dice(c, 8700 + c.minute);
  if (d() >= 0.015 * 6) return;
  const pool = nearSlots(c, DUELS.nearPx).filter((slot) => {
    const life = c.state.travelers[slot]!;
    return (
      c.state.crowd!.online[slot] === 1 &&
      duelMinded(c, slot) &&
      !c.chat.duelAsked.has(slot) &&
      tierNow(life, c.real) >= 1 &&
      h.canSpeak(c, slot)
    );
  });
  if (pool.length === 0) return;
  const slot = pool[Math.floor(d() * pool.length)] as number;
  c.chat.duelAsked.add(slot);
  saySocial(
    c,
    h,
    slot,
    'whisper',
    lineFor(DUEL_LINES.ask, c.ids[slot]!, d),
    'whisper.duel',
    'duel:ask',
    { category: 'duelAsk', chips: DUEL_CHIPS },
  );
}

/**
 * What a duel leaves behind: the count-down line, then the result as memory (once, for the
 * Traveler), the Duels record, a Rival flag if the competition has been close and repeated, a
 * sporting line from the Traveler and sometimes a letter.
 */
export function duelEvents(c: Ctx, h: Helpers, events: readonly SimEvent[]): void {
  for (const e of events) {
    if (e.type === 'duelStarted') {
      const d = h.dice(c, 8800 + e.slot + c.minute);
      say(c, h, e.slot, lineFor(DUEL_LINES.go, c.ids[e.slot]!, d), 'duel.go', 'local', d);
    } else if (e.type === 'duelEnded') {
      const life = c.state.travelers[e.slot]!;
      const t = c.ids[e.slot]!;
      const d = h.dice(c, 8900 + e.slot + c.minute);
      if (e.result !== 'draw') {
        remember(life, e.result === 'player' ? 'duelWon' : 'duelLost', 0, c.day, c.real);
        updateRival(life);
        writeDuelNote(c, e.slot, e.result === 'player', d);
      }
      const list =
        e.result === 'draw'
          ? DUEL_LINES.draw
          : e.result === 'player'
            ? DUEL_LINES.loser
            : DUEL_LINES.winner;
      say(c, h, e.slot, lineFor(list, t, d), `duel.${e.result}`, 'local', d);
    }
  }
}

/**
 * Dungeon entries and Rivals (POW-M5-12). Each entry is kept by real day. When the player goes into
 * the dungeon they have entered most in the last week, a Rival may show up: they say so and taunt,
 * sportingly. The chance climbs with each visit they miss, so one comes within a few. A Rival who has
 * shown up may say a line to a downed player. (Travelers do not fight in dungeons yet, so a Rival's
 * help is a line and nothing more until parties exist.)
 */
export function rivalOnEntry(c: Ctx, h: Helpers, events: readonly SimEvent[]): void {
  const { state, chat } = c;
  const entries = state.mail.entries;
  const me = findAvatar(state);
  for (const e of events) {
    if (e.type === 'delved' && e.who === me) {
      const last = [...entries].reverse().find((x) => x.dungeon === e.dungeon);
      // One entry per visit, not one per room: a new visit is at least a real minute after the last.
      if (last && last.day === c.day && c.minute - (chat.lastEntry.get(e.dungeon) ?? -1e9) < 30) {
        chat.lastEntry.set(e.dungeon, c.minute);
        continue;
      }
      chat.lastEntry.set(e.dungeon, c.minute);
      entries.push({ dungeon: e.dungeon, day: c.day });
      while (entries.length > 60) entries.shift();
      const recent = entries.filter((x) => c.day - x.day < DUELS.rivalWindowDays);
      const count = new Map<string, number>();
      for (const x of recent) count.set(x.dungeon, (count.get(x.dungeon) ?? 0) + 1);
      let top = '';
      let best = 0;
      for (const [k, n] of count)
        if (n > best) {
          top = k;
          best = n;
        }
      if (top !== e.dungeon) continue;
      const rivals = state.travelers
        .map((l, slot) =>
          (l.flags & FLAG.rival) !== 0 && state.crowd!.online[slot] === 1 ? slot : -1,
        )
        .filter((slot) => slot >= 0);
      if (rivals.length === 0) continue;
      const d = h.dice(c, 9100 + c.minute);
      const chance = Math.min(1, 0.4 + 0.2 * chat.rivalMisses);
      if (d() >= chance) {
        chat.rivalMisses++;
        continue;
      }
      chat.rivalMisses = 0;
      const slot = rivals[Math.floor(d() * rivals.length)] as number;
      chat.rivalHere.set(slot, { dungeon: e.dungeon, minute: c.minute });
      const name = DUNGEON_NAMES[e.dungeon] ?? '';
      const text = lineFor(RIVAL_LINES.appear, c.ids[slot]!, d, {
        dungeon: name,
        player: c.player,
      });
      say(c, h, slot, text, 'rival.appear', 'world', d);
      emit(state.events, { type: 'rivalAppeared', slot, dungeon: e.dungeon });
    } else if (e.type === 'died' && e.id === me && e.team === 0) {
      for (const [slot, at] of chat.rivalHere) {
        if (c.minute - at.minute > 180) continue;
        const d = h.dice(c, 9200 + slot + c.minute);
        if (d() >= DUELS.rivalHelpChance) continue;
        say(
          c,
          h,
          slot,
          lineFor(RIVAL_LINES.help, c.ids[slot]!, d, { player: c.player }),
          'rival.help',
          'world',
          d,
        );
        break;
      }
    }
  }
}

const ACTIVITY_WORD: Readonly<Record<string, string>> = { area: 'a hunt', trial: 'a Trial' };

/** The name of a party's activity inside a line. */
function activityWord(id: string): string {
  if (DUNGEON_NAMES[id]) return DUNGEON_NAMES[id];
  const c = CREATURES[id];
  if (c) return `${c.name} hunting`;
  const t = TRIALS[id];
  if (t) return `the ${SKILLS[t.skill]?.name ?? ''} Trial`.replace('  ', ' ');
  return ACTIVITY_WORD[id] ?? 'a run';
}

const itemWord = (id: string): string => {
  const def = ITEMS[id];
  return (def ? ITEM_STRINGS[def.nameKey] : undefined) ?? 'something';
};

/**
 * Party chat (POW-M5-07). Every line follows a party event of this tick: a member joined or
 * answered, gave notice, left, went down, got up, said brb, the party wiped or won, and the loot
 * rolls. Lines are said in the member's voice in the Party channel.
 */
export function partyEvents(c: Ctx, h: Helpers, events: readonly SimEvent[]): void {
  const now = c.minute;
  const line = (slot: number, key: string, fills: Record<string, string> = {}, due = now): void => {
    const list = PARTY_LINES[key];
    const t = c.ids[slot];
    if (!list || !t) return;
    const d = h.dice(c, 9300 + slot * 7 + key.length + c.minute);
    say(
      c,
      h,
      slot,
      lineFor(list, t, d, { player: c.player, ...fills }),
      `party.${key}`,
      'party',
      d,
      due,
    );
  };
  const members = c.state.party?.members.map((m) => m.slot) ?? [];
  const some = (salt: number): number | null => {
    if (members.length === 0) return null;
    const d = h.dice(c, 9400 + salt + c.minute);
    return members[Math.floor(d() * members.length)] ?? null;
  };
  const answered = new Set(events.flatMap((e) => (e.type === 'partyAnswered' ? [e.slot] : [])));
  for (const e of events) {
    switch (e.type) {
      case 'partyJoined':
        // One who answered the player's listing says so first, then hello a minute on.
        line(
          e.slot,
          'join',
          { activity: activityWord(e.activity) },
          answered.has(e.slot) ? now + 1 : now,
        );
        break;
      case 'partyAnswered':
        line(e.slot, 'answer', { activity: activityWord(e.activity) }, now);
        break;
      case 'partyWarned':
        line(e.slot, 'warn');
        break;
      case 'partyLeft':
        line(e.slot, e.why === 'player' ? 'parted' : 'leave');
        break;
      case 'partyDowned':
        line(e.slot, 'down');
        break;
      case 'partyRevived':
        line(e.slot, 'revive', {}, now + 1);
        break;
      case 'partyBrb':
        line(e.slot, 'brb');
        break;
      case 'partyWipe': {
        const s = some(1);
        if (s !== null) line(s, 'wipe', {}, now + 1);
        break;
      }
      case 'partyFightOver': {
        const d = h.dice(c, 9500 + c.minute);
        const s = some(2);
        if (s !== null && d() < 0.35) line(s, 'fightOver', {}, now + 1);
        break;
      }
      case 'partyLootRoll': {
        const item = itemWord(e.item);
        if (e.rare) {
          const s = some(3);
          if (s !== null) line(s, 'rare', { item });
        }
        for (const r of e.rolls)
          line(r.slot, r.need ? 'need' : 'pass', { roll: String(r.roll), item });
        line(e.winner, 'won', { item }, now + 1);
        break;
      }
      default:
        break;
    }
  }
}

/**
 * Pit chat (POW-M5-30): spectators call a bout as it opens, cheer the fighters by name, and close
 * it; the two fighters each say a sporting line, their own when they are one of the hand-tuned
 * duelists. When the player duels in the Pit, the watchers cheer them by their Pit honor.
 */
export function pitEvents(c: Ctx, h: Helpers, events: readonly SimEvent[]): void {
  const line = (
    slot: number,
    list: readonly Reply[],
    template: string,
    fills: Record<string, string> = {},
  ): void => {
    const t = c.ids[slot];
    if (!t) return;
    const d = h.dice(c, 9900 + slot * 3 + template.length + c.minute);
    say(c, h, slot, lineFor(list, t, d, fills), template, 'local', d, c.minute);
  };
  const handle = (slot: number): string => c.ids[slot]?.handle ?? '';
  const watcher = (salt: number, not: readonly number[] = []): number | null => {
    const pool = pitWatchers(c.state).filter((s) => !not.includes(s));
    if (pool.length === 0) return null;
    return pool[Math.floor(h.dice(c, 9950 + salt + c.minute)() * pool.length)] ?? null;
  };
  for (const e of events) {
    if (e.type === 'pitBoutStarted') {
      const w = watcher(1, [e.a, e.b]);
      if (w !== null) line(w, PIT_LINES.open, 'pit.open', { handle: handle(e.a) });
    } else if (e.type === 'pitCheer') {
      line(e.slot, PIT_LINES.cheer, 'pit.cheer', { handle: handle(e.for) });
    } else if (e.type === 'pitBoutEnded') {
      const own = (slot: number, won: boolean): Reply[] => {
        const mine = DUELIST_LINES[handle(slot)];
        return mine
          ? [{ text: won ? mine.win : mine.lose }]
          : [...(won ? PIT_LINES.winner : PIT_LINES.loser)];
      };
      line(e.winner, own(e.winner, true), 'pit.winner');
      line(e.loser, own(e.loser, false), 'pit.loser');
      const w = watcher(2, [e.winner, e.loser]);
      if (w !== null) line(w, PIT_LINES.close, 'pit.close');
    } else if (e.type === 'duelStarted' && c.state.duel?.pit) {
      const honor = PIT_HONOR_NAMES[c.state.mail.duels.honor] ?? '';
      for (const salt of [3, 4]) {
        const w = watcher(salt, [e.slot]);
        if (w !== null) line(w, PIT_LINES.player, 'pit.player', { honor: honor || c.player });
      }
    }
  }
}
