import type { ChatExchange } from '../types';

/**
 * Exchanges for the standing ties of the 24 hand-tuned Travelers (POW-M5-15, design/12 sections 4.5
 * and 6). Each is said by those two, `a` first, a minute or so apart. Generic ones for each kind of
 * tie live in `knowledge.ts`; these are the specific ones, so a regular hears the same pair talk in
 * ways that belong to them. Rivalry is sporting and nobody is cruel (design/07 rule 4).
 *
 * `between` lists the pair as [a, b]: `a` speaks the `a` lines.
 */
const X = (
  id: string,
  between: readonly [string, string],
  tie: ChatExchange['tie'],
  lines: readonly string[],
  weight = 6,
): ChatExchange => ({
  id,
  tie,
  between,
  weight,
  lines: lines.map((text, i) => ({ role: i % 2 === 0 ? 'a' : 'b', text })),
});

export const PAIR_EXCHANGES: readonly ChatExchange[] = [
  // Tobo and BreadKnight: best friends. Bread, smithing and burning.
  X('exchange.tobo_breadknight.n1', ['Tobo', 'BreadKnight'], 'friend', [
    '{handle} i burned the anvil again',
    'was it a good burn?',
    'it was a very educational burn',
  ]),
  X('exchange.tobo_breadknight.n2', ['Tobo', 'BreadKnight'], 'friend', [
    '{handle} what is the best bread?',
    'the one you are about to eat',
    'that is not an answer',
    'that is the only answer',
  ]),
  X('exchange.tobo_breadknight.n3', ['Tobo', 'BreadKnight'], 'friend', [
    'lunch time, {handle}. what are you eating?',
    'bread. what else?',
  ]),
  X('exchange.tobo_breadknight.n4', ['Tobo', 'BreadKnight'], 'friend', [
    '{handle} i finally made a copper ingot that did not melt',
    'a proud day. i will bake a loaf for the occasion',
    'send me the loaf, i will send the ingot',
  ]),

  // Kestrel99 and Thoradin: rivals on the kill board.
  X('exchange.kestrel_thoradin.n1', ['Kestrel99', 'Thoradin'], 'rival', [
    '{handle} i passed your count',
    'ENJOY IT. I AM COMING FOR IT',
    'every day you say that',
    'EVERY DAY I MEAN IT',
  ]),
  X('exchange.kestrel_thoradin.n2', ['Kestrel99', 'Thoradin'], 'rival', [
    'farming the same spot as you today, {handle}',
    'WE SHARE THE SPOT. I TAKE THE LEFT',
    'i will take the boar',
  ]),
  X('exchange.kestrel_thoradin.n3', ['Kestrel99', 'Thoradin'], 'rival', [
    '{handle} nice drop',
    'THANK YOU. IT IS SEVEN TO ZERO',
    'for you, perhaps. it is a long board',
  ]),
  X('exchange.kestrel_thoradin.n4', ['Kestrel99', 'Thoradin'], 'rival', [
    'good fight, {handle}',
    'GOOD FIGHT. NEXT TIME I WIN',
  ]),

  // lilfern and AshAndOak: siblings. Who logs off first.
  X('exchange.lilfern_ashandoak.n1', ['lilfern', 'AshAndOak'], 'sibling', [
    '{handle} it is your turn to log off',
    'it is not my turn, i logged off yesterday',
    'you logged off two days ago',
    'we are not counting that high',
  ]),
  X('exchange.lilfern_ashandoak.n2', ['lilfern', 'AshAndOak'], 'sibling', [
    '{handle} did you make me a bow yet?',
    'i made you three bows',
    'the third was not a bow, it was a stick',
    'it was a very good stick',
  ]),
  X('exchange.lilfern_ashandoak.n3', ['lilfern', 'AshAndOak'], 'sibling', [
    '{handle} come to the square, there is a nice crowd',
    'in a bit, i am crafting',
    'you are always crafting',
    'you are always talking',
  ]),
  X('exchange.lilfern_ashandoak.n4', ['lilfern', 'AshAndOak'], 'sibling', [
    '{handle} i made a new friend! they are very nice',
    'you make a new friend every hour',
    'and every one is very nice',
  ]),

  // sir_pancake and Saoirse: friends, both players of in-character parts.
  X('exchange.pancake_saoirse.n1', ['sir_pancake', 'Saoirse'], 'friend', [
    'Lady {handle}, shall we read at the inn tonight?',
    'Gladly, Sir. I will bring the candles.',
    'And I the tale, and a proper breakfast.',
  ]),
  X('exchange.pancake_saoirse.n2', ['sir_pancake', 'Saoirse'], 'friend', [
    'Lady {handle}, I was struck down by a boar.',
    'Rise, Sir. I will tend the wound.',
    'It was a mighty boar.',
    'They always are.',
  ]),
  X('exchange.pancake_saoirse.n3', ['sir_pancake', 'Saoirse'], 'friend', [
    '{handle}, do you need a healer for the next reading?',
    'I need an audience, Sir, and a good light.',
  ]),
  X('exchange.pancake_saoirse.n4', ['sir_pancake', 'Saoirse'], 'friend', [
    'Lady {handle}, the festival draws near.',
    'Then we must prepare a scene.',
    'A grand one, with a boar.',
  ]),

  // Marrow and Tobo: mentor (from hour 20). Marrow lead, but pair order is by slot, Tobo first.
  X('exchange.tobo_marrow.n1', ['Tobo', 'Marrow'], 'mentor', [
    '{handle} my ingot cracked again',
    'what was the heat?',
    'hot?',
    'a little less hot. a little more patient',
  ]),
  X('exchange.tobo_marrow.n2', ['Tobo', 'Marrow'], 'mentor', [
    '{handle} how long until i am a master smith?',
    'a long time. then a long time more',
    'that is a lot of time',
    'it is a lot of anvil. you will be fine',
  ]),
  X('exchange.tobo_marrow.n3', ['Tobo', 'Marrow'], 'mentor', [
    '{handle} i made a pick that works!',
    'show me. the edge is crooked, but it works',
    'that is the best compliment i have had all week',
  ]),
  X('exchange.tobo_marrow.n4', ['Tobo', 'Marrow'], 'mentor', [
    'thanks for the tip, {handle}',
    'tips are free. practice is not',
  ]),

  // RiverStone and mira_: friends. Fishing spots and silence.
  X('exchange.mira_riverstone.n1', ['mira_', 'RiverStone'], 'friend', [
    'the jetty was good today, {handle}',
    'ha! i knew it. the jetty is always good',
    'not always',
    'always, at dawn, trust me',
  ]),
  X('exchange.mira_riverstone.n2', ['mira_', 'RiverStone'], 'friend', [
    '{handle} i caught a silver one',
    'you caught a silver one! wonderful, i have not seen one in a week',
    'it was small',
  ]),
  X('exchange.mira_riverstone.n3', ['mira_', 'RiverStone'], 'friend', [
    'quiet tonight, {handle}',
    'the best kind of night for fishing',
  ]),
  X('exchange.mira_riverstone.n4', ['mira_', 'RiverStone'], 'friend', [
    '{handle} is it true the fish bite more in the rain?',
    'it is the truest truth i know',
    'i think it might be a rumor',
    'it is a true rumor then',
  ]),

  // Halla and Duskwright: rivals. Price wars, sporting.
  X('exchange.halla_duskwright.n1', ['Halla', 'Duskwright'], 'rival', [
    '{handle} you bought all the dewmint again',
    'every single leaf. you were slow',
    'i was fair. you were greedy',
    'greedy and fast. the market rewards both',
  ]),
  X('exchange.halla_duskwright.n2', ['Halla', 'Duskwright'], 'rival', [
    'my forage is fresher than yours, {handle}',
    'and mine is cheaper',
    'cheap does not mean good',
    'good does not mean sold',
  ]),
  X('exchange.halla_duskwright.n3', ['Halla', 'Duskwright'], 'rival', [
    '{handle} i raised the price of sunwort, just so you know',
    'noted. i am raising mine too, so it is fair',
  ]),
  X('exchange.halla_duskwright.n4', ['Halla', 'Duskwright'], 'rival', [
    'good trade today, {handle}',
    'good trade. you will not win next time',
    'you say that every day',
  ]),

  // Skarrow and NoScopeNed: rivals. Both veterans, both say little, both keep score.
  X('exchange.noscope_skarrow.n1', ['NoScopeNed', 'Skarrow'], 'rival', [
    '{handle} duel at the square?',
    'later',
    'later is always later with you',
    'later.',
  ]),
  X('exchange.noscope_skarrow.n2', ['NoScopeNed', 'Skarrow'], 'rival', [
    'i beat you last time, {handle}',
    'you got lucky',
    'you can tell yourself that',
  ]),
  X('exchange.noscope_skarrow.n3', ['NoScopeNed', 'Skarrow'], 'rival', [
    'still on the board, {handle}?',
    'still here',
    'so am i',
  ]),
  X('exchange.noscope_skarrow.n4', ['NoScopeNed', 'Skarrow'], 'rival', [
    'good duel, {handle}',
    'good duel',
  ]),

  // Petra.k and Marrow: friends. Crafting math and the craft itself.
  X('exchange.marrow_petra.n1', ['Marrow', 'Petra.k'], 'friend', [
    '{handle} how many copper ingots for that pick again?',
    'two. and one oak plank. i have the math if you want it',
    'i do not want the math',
    'noted. here is the math anyway',
  ]),
  X('exchange.marrow_petra.n2', ['Marrow', 'Petra.k'], 'friend', [
    '{handle} i fixed my anvil',
    'the efficiency should be up eight percent now',
    'it sings now. that is enough for me',
  ]),
  X('exchange.marrow_petra.n3', ['Marrow', 'Petra.k'], 'friend', [
    'i saw your craft table, {handle}. neat',
    'thank you. the ratios are in a notebook, if you need them',
  ]),
  X('exchange.marrow_petra.n4', ['Marrow', 'Petra.k'], 'friend', [
    '{handle} are you going to the square later?',
    'after this batch. forty minutes by my numbers',
  ]),

  // A few cross-cutting ones that fit any pair in the same kind of tie (generic by kind, extra flavor).
  X(
    'exchange.mentor.extra1',
    ['Tobo', 'Marrow'],
    'mentor',
    [
      '{handle} what is a good first sword?',
      'a bronze one. do not skip bronze',
      'bronze, got it. thanks',
    ],
    2,
  ),
  X(
    'exchange.friend.extra1',
    ['Tobo', 'BreadKnight'],
    'friend',
    ['{handle} we should do a dungeon sometime', 'only if we bring bread', 'we always bring bread'],
    2,
  ),
  X(
    'exchange.friend.extra2',
    ['mira_', 'RiverStone'],
    'friend',
    ['afternoon, {handle}', 'afternoon. have you been fishing?', 'i am always fishing'],
    2,
  ),
  X(
    'exchange.rival.extra1',
    ['Kestrel99', 'Thoradin'],
    'rival',
    ['{handle} i beat you to the board', 'ONLY BECAUSE I WAS ASLEEP', 'that is when you lose most'],
    2,
  ),
  X(
    'exchange.sibling.extra1',
    ['lilfern', 'AshAndOak'],
    'sibling',
    ['{handle} are you still crafting?', 'still crafting. still not logging off'],
    2,
  ),
];
