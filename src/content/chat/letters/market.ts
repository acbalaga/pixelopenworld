import type { LetterTemplate } from './types';

const M = (n: number, text: string): LetterTemplate => ({
  id: `market.sold.n${String(n).padStart(2, '0')}`,
  kind: 'market',
  text,
});

/** Market proceeds (POW-M5-10): the buyer writes. The coin is the sale, after the market's cut. */
export const MARKET_LETTERS: readonly LetterTemplate[] = [
  M(1, 'bought your {qty} {item} at the market. {coin} coin is yours, {player}'),
  M(2, 'got your {item}, all {qty} of them. here is {coin} coin'),
  M(3, 'your listing was just what i needed. {coin} coin for the {qty} {item}'),
  M(4, 'picked up your {item} off the terminal. {coin} coin sent, thanks'),
];
