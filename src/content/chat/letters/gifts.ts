import type { LetterTemplate } from './types';

const C = (n: number, text: string): LetterTemplate => ({
  id: `letter.gift.coin.n${String(n).padStart(2, '0')}`,
  kind: 'giftCoin',
  text,
});
const I = (n: number, text: string): LetterTemplate => ({
  id: `letter.gift.item.n${String(n).padStart(2, '0')}`,
  kind: 'giftItem',
  text,
});

/** Gifts from a friend's own purse and stock. What is named is what is attached. */
export const GIFTS: readonly LetterTemplate[] = [
  C(1, 'a good week on the road. here is {coin} coin for you, {player}'),
  C(2, 'i had more than i needed, so {coin} coin is yours'),
  C(3, 'do not argue. {coin} coin. buy something nice'),
  C(4, 'a few coins from a happy friend: {coin} for you, {player}'),
  C(5, 'sold well today. sending you {coin} coin as thanks'),
  C(6, 'this is {coin} coin from my last haul. spend it on something silly'),
  C(7, 'for the bread fund, {player}: {coin} coin'),
  C(8, 'you helped me once. {coin} coin is a small way to say it'),
  C(9, 'here is {coin} coin. i found it in a boot. it is yours now'),
  C(10, 'a little something: {coin} coin. no need to write back'),
  C(11, 'it is not much, but {coin} coin is yours, {player}'),
  C(12, 'my purse was getting heavy. {coin} coin for you'),
  C(13, 'for repairs, {player}. {coin} coin, and say nothing'),
  C(14, 'coin from a friend: {coin}. enjoy it'),
  I(1, 'i had spare. here are {qty} {item} for you, {player}'),
  I(2, 'sending {qty} {item}. they will be more use to you than to me'),
  I(3, 'found too many {item}. {qty} are yours'),
  I(4, 'a small gift: {qty} {item}. no strings'),
  I(5, '{player}, take these {qty} {item}. i insist'),
  I(6, 'i thought of you when i saw {item}. {qty} are in the package'),
  I(7, 'my bag is full of {item}. {qty} for you'),
  I(8, 'call it a thank you: {qty} {item}'),
  I(9, 'i do not need {item}, but you might. {qty} inside'),
  I(10, 'from my stock to yours: {qty} {item}'),
  I(11, 'a few {item}, {qty} in all. use them well, {player}'),
  I(12, 'i owe you for last time. {qty} {item} should cover it'),
  I(13, '{qty} {item} for a friend. do not tell the others'),
  I(14, 'sorting my bag and found {item}. {qty} are yours now'),
  I(15, 'for the road, {player}: {qty} {item}'),
  I(16, 'a small package of {item}, {qty} in all. hope it helps'),
];
