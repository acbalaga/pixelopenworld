import { MAIL } from '../../content/balance/mail';
import { SOCIAL_PLACES } from '../../content/balance/travelers';
import { LETTER_BY_ID, lettersOfKind, type LetterKind } from '../../content/chat/letters';
import { PLACE_NAMES } from '../../content/chat/names';
import { VOICES } from '../../content/chat/voices';
import { ITEMS } from '../../content/items';
import { ITEM_STRINGS } from '../../content/strings/items';
import { FLAG } from '../../content/travelers/types';
import { findAvatar } from '../../shared/summary';
import type { SimEvent } from '../kernel/events';
import { deliver, type Letter } from '../mail';
import type { SimState } from '../state';
import { hash01 } from '../travelers/dice';
import { identitiesOf } from '../travelers/generate';
import { PLACE_LIST } from '../travelers/lists';
import type { Ctx } from './engine';
import { applyVoice } from './voice';

/**
 * Letters from Travelers (POW-M5-12). A friend who logs in may write: a note, an invitation, or a gift
 * from their own purse and stock. A rival may write a sporting poke, and a duel is followed by a
 * short note from the other side. The save holds only the template id, so the text is rendered
 * here, in the sender's voice, the same way each time for the same letter.
 */

const itemName = (id: string): string => {
  const def = ITEMS[id];
  return (def ? ITEM_STRINGS[def.nameKey] : undefined) ?? id;
};

const PLAYER_FALLBACK = 'friend';

/** The text of a letter, in the sender's voice. Deterministic in the letter. */
export function letterText(state: SimState, l: Letter): string {
  const tpl = LETTER_BY_ID.get(l.tpl);
  if (!tpl) return '';
  const sender = senderOf(state, l.slot);
  const me = findAvatar(state);
  const slots: Record<string, string> = {
    player: (me === null ? undefined : state.entities.comps.avatar[me]?.handle) ?? PLAYER_FALLBACK,
    coin: String(l.coin),
    item: l.item === '' ? '' : itemName(l.item),
    qty: String(l.qty),
    place: PLACE_NAMES[PLACE_LIST[l.subject] ?? ''] ?? '',
  };
  const filled = tpl.text.replace(/\{([a-z]+)\}/g, (_, k: string) => slots[k] ?? '');
  const voice = VOICES.find((v) => v.id === sender.voice);
  if (!voice) return filled;
  let n = 0;
  const dice = (): number => hash01(state.seed, l.slot, l.id, n++);
  return applyVoice(voice, filled, 'banter', dice).text;
}

const senderOf = (state: SimState, slot: number) => identitiesOf(state.seed)[slot]!;

const pickTpl = (kind: LetterKind, d: () => number): string => {
  const pool = lettersOfKind(kind);
  return (pool[Math.floor(d() * pool.length)] as { id: string }).id;
};

/** Days since the sender last wrote, or a large number if they never have. */
function daysSince(state: SimState, slot: number, day: number): number {
  let last = -Infinity;
  for (const l of state.mail.letters) if (l.slot === slot) last = Math.max(last, l.day);
  return day - last;
}

const unreadFrom = (state: SimState, slot: number): number =>
  state.mail.letters.filter((l) => l.slot === slot && !l.read).length;

/** A gift from the sender's own purse or stock, or null if they have nothing to spare. */
function giftFor(
  c: Ctx,
  slot: number,
  d: () => number,
): { coin: number; item: string; qty: number } | null {
  const life = c.state.travelers[slot]!;
  const stock = c.state.crowd?.stock[slot] ?? {};
  const spareCoin = life.coin - MAIL.coinKeep;
  const items = Object.keys(stock).filter(
    (i) => ITEMS[i] !== undefined && (stock[i] ?? 0) > MAIL.itemKeep,
  );
  const wantItem = items.length > 0 && (spareCoin < MAIL.giftCoin[0] || d() < 0.5);
  if (wantItem) {
    const item = items[Math.floor(d() * items.length)] as string;
    const room = (stock[item] ?? 0) - MAIL.itemKeep;
    const qty = Math.min(
      room,
      MAIL.giftQty[0] + Math.floor(d() * (MAIL.giftQty[1] - MAIL.giftQty[0] + 1)),
    );
    return { coin: 0, item, qty };
  }
  if (spareCoin >= MAIL.giftCoin[0]) {
    const coin = Math.min(
      spareCoin,
      MAIL.giftCoin[0] + Math.floor(d() * (MAIL.giftCoin[1] - MAIL.giftCoin[0] + 1)),
    );
    return { coin, item: '', qty: 0 };
  }
  return null;
}

/** Takes what a delivered gift carried out of the sender's purse and stock. */
function spend(c: Ctx, slot: number, g: { coin: number; item: string; qty: number }): void {
  c.state.travelers[slot]!.coin -= g.coin;
  const stock = c.state.crowd?.stock[slot];
  if (stock && g.item !== '') stock[g.item] = Math.max(0, (stock[g.item] ?? 0) - g.qty);
}

/** A place the sender could name in an invitation, as a place index. */
function invitePlace(d: () => number): number {
  const named = SOCIAL_PLACES.filter(([p]) => PLACE_NAMES[p] !== undefined);
  const [place] = named[Math.floor(d() * named.length)] as readonly [string, number];
  return PLACE_LIST.indexOf(place);
}

/**
 * A letter from `slot`, if they have something to say now: not too soon after the last, and not
 * piling on unread ones. A friend sends a note, an invitation or a gift. A rival sends a poke.
 */
export function maybeWrite(
  c: Ctx,
  slot: number,
  kind: 'friend' | 'rival',
  d: () => number,
): boolean {
  const { state } = c;
  if (daysSince(state, slot, c.day) < MAIL.gapDays) return false;
  if (unreadFrom(state, slot) >= MAIL.perSenderUnread) return false;
  if (d() >= MAIL.letterChance) return false;
  const base = { slot, day: c.day, subject: 0, item: '', qty: 0, coin: 0 };
  if (kind === 'rival') return deliver(state, { ...base, tpl: pickTpl('rival', d) });
  if (d() < MAIL.giftChance) {
    const g = giftFor(c, slot, d);
    if (g) {
      const tpl = pickTpl(g.coin > 0 ? 'giftCoin' : 'giftItem', d);
      if (deliver(state, { ...base, ...g, tpl })) {
        spend(c, slot, g);
        return true;
      }
    }
  }
  if (d() < 0.35)
    return deliver(state, { ...base, subject: invitePlace(d), tpl: pickTpl('invite', d) });
  return deliver(state, { ...base, tpl: pickTpl('letter', d) });
}

/** A note after a duel, from the other side. */
export function writeDuelNote(c: Ctx, slot: number, playerWon: boolean, d: () => number): boolean {
  if (d() >= 0.6) return false;
  return deliver(c.state, {
    slot,
    day: c.day,
    subject: 0,
    item: '',
    qty: 0,
    coin: 0,
    tpl: pickTpl(playerWon ? 'duelWon' : 'duelLost', d),
  });
}

/** Friends and rivals who log in may write. Called once per abstract minute with the tick's events. */
export function mailOnLogin(
  c: Ctx,
  events: readonly SimEvent[],
  dice: (salt: number) => () => number,
): void {
  const crowd = c.state.crowd!;
  for (const e of events) {
    if (e.type !== 'travelerLoggedIn' || crowd.online[e.slot] !== 1) continue;
    const life = c.state.travelers[e.slot]!;
    const d = dice(9000 + e.slot);
    if ((life.flags & FLAG.friend) !== 0) maybeWrite(c, e.slot, 'friend', d);
    else if ((life.flags & FLAG.rival) !== 0) maybeWrite(c, e.slot, 'rival', d);
  }
}
