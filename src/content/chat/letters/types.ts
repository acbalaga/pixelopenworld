/**
 * Letter templates (POW-M5-12, design/07 Mail). A letter is short and in the sender's voice: the
 * engine applies the voice when it is read. Slots: `{player}`, `{item}`, `{qty}`, `{coin}`,
 * `{place}` and `{creature}`, each filled only from the letter itself. A letter never explains
 * anything about the world and never names a place that is not baked (D25, the validator checks).
 */
export const LETTER_KINDS = [
  'letter',
  'giftCoin',
  'giftItem',
  'invite',
  'rival',
  'duelWon',
  'duelLost',
] as const;
export type LetterKind = (typeof LETTER_KINDS)[number];

export interface LetterTemplate {
  id: string;
  kind: LetterKind;
  text: string;
}

/** The slots each kind may use. A gift must name what it carries. */
export const LETTER_SLOTS: Readonly<Record<LetterKind, readonly string[]>> = {
  letter: ['player'],
  giftCoin: ['player', 'coin'],
  giftItem: ['player', 'item', 'qty'],
  invite: ['player', 'place'],
  rival: ['player'],
  duelWon: ['player'],
  duelLost: ['player'],
};
