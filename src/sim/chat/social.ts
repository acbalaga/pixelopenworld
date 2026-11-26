import { FRIENDS, MEMORY } from '../../content/balance/social';
import {
  CHIPS,
  CHIP_SETS,
  EMOTE_CHIPS,
  HELLO_CHIPS,
  MEMORY_LINES,
  REPLIES,
  REQUEST_CHIPS,
  WAKE,
  WHISPERS,
  type Reply,
} from '../../content/chat/social';
import { TEMPLATES } from '../../content/chat/templates';
import type { Category } from '../../content/chat/types';
import { CREATURES } from '../../content/creatures';
import { SKILLS } from '../../content/skills';
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
  wouldAccept,
} from '../travelers/social';
import type { TravelerIdentity } from '../travelers/types';
import type { Ctx, Helpers } from './engine';

/**
 * The social side of chat (POW-M5-06): reply chips and the Traveler's answer, memory of the player,
 * friend requests both ways, whispers, and the lines that bring a memory up. The engine calls these
 * once per abstract minute and when the player sends a command. Everything is seeded dice from the
 * engine and the sim state: nothing here reads a clock or a random source.
 */

/** What the player may answer with, per Traveler, until they answer or it goes stale. */
export interface Offer {
  slot: number;
  category: Category | 'request' | 'hello';
  chips: string[];
  channel: 'local' | 'whisper';
  minute: number;
}

/** A player command waiting for the next chat step. */
export type Inbox =
  | { type: 'chip'; slot: number; chip: string }
  | { type: 'friend'; slot: number; op: 'request' | 'accept' | 'decline' | 'remove' }
  | { type: 'poke'; slot: number };

/** Abstract minutes (two real seconds each) an offer of chips lasts: a minute of real time. */
export const OFFER_MIN = 30;

const CATEGORY_OF = new Map(TEMPLATES.map((t) => [t.id, t.category]));

/** The chips for a line of a category, trimmed or added to by regard tier. Always 2 to 4. */
export function chipsFor(category: Category, tier: number): string[] {
  let set = [...CHIP_SETS[category]];
  // A stranger gets no joking about, and a friend can say goodbye.
  if (tier === 0) set = set.filter((id) => id !== 'joke');
  if (tier >= 2 && set.length < 4 && !set.includes('later')) set.push('later');
  for (const pad of ['hi', 'thanks', 'more'])
    if (set.length < 2 && !set.includes(pad)) set.push(pad);
  return set.slice(0, 4);
}

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

/** Stores the chips a line offers, if it is a line the player can answer. Returns the chips. */
export function offerFor(
  c: Ctx,
  slot: number,
  template: string,
  channel: 'world' | 'local' | 'whisper',
): { id: string; text: string }[] {
  if (channel === 'world') return [];
  const category = CATEGORY_OF.get(template);
  if (!category) return [];
  const life = c.state.travelers[slot];
  if (!life) return [];
  const ids = chipsFor(category, tierNow(life, c.real));
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
export const memorable = (e: SimEvent): boolean => e.type === 'killed' || e.type === 'playerPassed';

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
function memoryText(c: Ctx, slot: number, d: () => number): string | null {
  const life = c.state.travelers[slot]!;
  for (let i = life.memory.length - 1; i >= 0; i--) {
    const m = life.memory[i]!;
    const kind = MEMORY_KINDS[m.kind];
    const lines = kind ? MEMORY_LINES[kind] : undefined;
    if (!lines) continue;
    const subject = subjectName(m.kind, m.subject);
    const fit = lines.filter((t) => subject !== '' || !t.includes('{memory.subject}'));
    if (fit.length === 0) continue;
    return (fit[Math.floor(d() * fit.length)] as string)
      .replace(/\{memory\.subject\}/g, subject)
      .replace(/\{memory\.daysAgo\}/g, daysAgoText(m.day, c.day));
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
        mem,
        'whisper.memory',
        'memory:login',
        { category: 'hello', chips: HELLO_CHIPS },
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
  const text = memoryText(c, slot, d);
  if (text === null) return;
  c.chat.said.add(slot);
  const friend = isFriend(c.state.travelers[slot]!);
  saySocial(c, h, slot, friend ? 'whisper' : 'local', text, 'memory.line', 'memory:near', {
    category: 'greet',
    chips: chipsFor('greet', tierNow(c.state.travelers[slot]!, c.real)),
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
    if (it.chip === 'friend.yes') {
      life.flags &= ~FLAG.requestIn;
      c.chat.asked.delete(slot);
      makeFriends(life, c.real);
      emit(c.state.events, { type: 'friendChanged', slot, change: 'added' });
    } else if (it.chip === 'friend.no') {
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
