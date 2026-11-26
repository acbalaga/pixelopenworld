import { MAIL } from '../content/balance/mail';
import type { SimState } from './state';
import { getComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { earnCoin } from './ledger';
import { give } from './items';

/**
 * The mailbox (POW-M5-12, design/07 Mail). Letters come from Travelers, in the Traveler's voice,
 * and are rendered from a template when read, so the save holds only the template id, the sender,
 * the day and what is attached. An attachment is created in the player's state only when it is
 * claimed, once: the claim sets `claimed`, gives the goods and writes the `mailGift` ledger entry in
 * the same tick, so there is no state with the goods given and the letter still unclaimed.
 */

export interface Letter {
  id: number;
  /** The sender's Traveler slot. */
  slot: number;
  /** The template id in `content/chat/letters`. */
  tpl: string;
  /** Real day index it was sent on. */
  day: number;
  /** A number the template can name: a creature, a board, a dungeon (by kind), or 0. */
  subject: number;
  /** Attachment: items and coin from the sender's own stock and purse. Empty string means none. */
  item: string;
  qty: number;
  coin: number;
  claimed: boolean;
  read: boolean;
}

export interface Mailbox {
  letters: Letter[];
  nextId: number;
  /** Gifts sent on this real day, to hold the daily cap. */
  gifts: { day: number; n: number };
  /**
   * The player's duel record (POW-M5-12): the Duels board reads the wins. `pit` counts the wins in
   * the Pit and `honor` is the Pit honor they bring, 0 none, 1 Pit regular, 2 Pit champion (M5-30).
   */
  duels: { wins: number; losses: number; pit: number; honor: number };
  /** Dungeon entries by real day (kind id, day), for the Rivals, newest last. */
  entries: { dungeon: string; day: number }[];
}

export const newMailbox = (): Mailbox => ({
  letters: [],
  nextId: 1,
  gifts: { day: -1, n: 0 },
  duels: { wins: 0, losses: 0, pit: 0, honor: 0 },
  entries: [],
});

/** A mailbox as loaded: a state from before the mailbox has an empty one, and one from before the
 * Pit honor (M5-30) gains its two counts at 0. */
export function normalMailbox(m: Mailbox | undefined): Mailbox {
  if (!m) return newMailbox();
  m.duels.pit ??= 0;
  m.duels.honor ??= 0;
  return m;
}

/** True if the letter has something to claim. */
export const hasAttachment = (l: Letter): boolean => l.coin > 0 || (l.item !== '' && l.qty > 0);

/** Letters waiting: unread, or with an attachment not yet claimed. */
export const unreadCount = (m: Mailbox): number =>
  m.letters.filter((l) => !l.read || (hasAttachment(l) && !l.claimed)).length;

/** Gifts the daily cap still allows on `day`. */
export function giftsLeft(m: Mailbox, day: number): number {
  return Math.max(0, MAIL.giftCapPerDay - (m.gifts.day === day ? m.gifts.n : 0));
}

/**
 * Puts a letter in the mailbox. If it is full, the oldest letter that is read and has nothing left
 * to claim makes room, and if there is none the new letter is not delivered (it returns false and
 * the sender keeps what they would have attached, so nothing is lost on either side).
 */
export function deliver(state: SimState, letter: Omit<Letter, 'id' | 'claimed' | 'read'>): boolean {
  const m = state.mail;
  if (m.letters.length >= MAIL.cap) {
    const i = m.letters.findIndex((l) => l.read && (!hasAttachment(l) || l.claimed));
    if (i < 0) return false;
    m.letters.splice(i, 1);
  }
  const gift = letter.coin > 0 || letter.item !== '';
  if (gift) {
    if (giftsLeft(m, letter.day) <= 0) return false;
    m.gifts = { day: letter.day, n: (m.gifts.day === letter.day ? m.gifts.n : 0) + 1 };
  }
  m.letters.push({ ...letter, id: m.nextId++, claimed: false, read: false });
  emit(state.events, { type: 'mailArrived', slot: letter.slot });
  return true;
}

/** Marks a letter read. */
export function readLetter(state: SimState, id: number): boolean {
  const l = state.mail.letters.find((x) => x.id === id);
  if (!l || l.read) return false;
  l.read = true;
  return true;
}

/**
 * Claims a letter's attachment, once. The goods are made in the same step the flag is set, and the
 * ledger says where they came from, so the integrity check can bound them.
 */
export function claimLetter(state: SimState, who: EntityId, id: number): boolean {
  const l = state.mail.letters.find((x) => x.id === id);
  if (!l || l.claimed || !hasAttachment(l)) return false;
  if (!getComp(state.entities, who, 'avatar')) return false;
  l.claimed = true;
  l.read = true;
  if (l.item !== '' && l.qty > 0) give(state, who, l.item, l.qty, 'mailGift');
  if (l.coin > 0) earnCoin(state, who, l.coin, 'mailGift');
  emit(state.events, { type: 'mailClaimed', id: l.id, who });
  return true;
}
