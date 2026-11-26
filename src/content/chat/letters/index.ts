import { GIFTS } from './gifts';
import { NEWS } from './news';
import { DUEL_LOST, DUEL_WON, INVITES, RIVALS } from './rest';
import type { LetterKind, LetterTemplate } from './types';

export { LETTER_KINDS, LETTER_SLOTS, type LetterKind, type LetterTemplate } from './types';

/** Every letter template: about 150, in voice at read time (POW-M5-12). */
export const LETTERS: readonly LetterTemplate[] = [
  ...NEWS,
  ...GIFTS,
  ...INVITES,
  ...RIVALS,
  ...DUEL_WON,
  ...DUEL_LOST,
];

export const LETTER_BY_ID: ReadonlyMap<string, LetterTemplate> = new Map(
  LETTERS.map((l) => [l.id, l]),
);

/** The templates of a kind. */
export const lettersOfKind = (kind: LetterKind): readonly LetterTemplate[] =>
  LETTERS.filter((l) => l.kind === kind);
