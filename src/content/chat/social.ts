import type { Archetype, Temper } from '../travelers/types';
import type { Category, ChipIntent } from './types';

/**
 * What the player can say back and what Travelers say to the player (POW-M5-06, design/12 4.7 and
 * 5). All data. Chips are short clear-text buttons built from the category of the line they answer
 * and the player's regard with the speaker. Replies are the Traveler's side, in the Traveler's
 * voice (the engine applies it). Player lines go to the log in plain sentence case.
 */

export interface Chip {
  id: string;
  text: string;
  kind: 'reply' | 'emote' | 'friend';
}

export const CHIPS: Readonly<Record<string, Chip>> = Object.fromEntries(
  (
    [
      ['hi', 'Hey there', 'reply'],
      ['how', 'How is it going?', 'reply'],
      ['help', 'Need a hand?', 'reply'],
      ['joke', 'Ha, good one', 'reply'],
      ['thanks', 'Thanks', 'reply'],
      ['no', 'Not right now', 'reply'],
      ['more', 'Tell me more', 'reply'],
      ['gl', 'Good luck', 'reply'],
      ['congrats', 'Well done', 'reply'],
      ['later', 'Catch you later', 'reply'],
      ['luck', 'Got lucky', 'reply'],
      ['tries', 'Took a few tries', 'reply'],
      ['practice', 'Practice, mostly', 'reply'],
      ['show', 'Want me to show you?', 'reply'],
      ['unsure', 'Not sure what you mean', 'reply'],
      ['shrug', 'Hard to say', 'reply'],
      ['fine', 'Pretty good, you?', 'reply'],
      ['busy', 'Keeping busy', 'reply'],
      ['yes', 'Yes', 'reply'],
      ['notyet', 'Not yet', 'reply'],
      ['maybe', 'Maybe', 'reply'],
      ['anytime', 'Any time', 'reply'],
      ['goodtimes', 'Good times', 'reply'],
      ['sorry', 'Sorry about that', 'reply'],
      ['wave', 'Wave', 'emote'],
      ['cheer', 'Cheer', 'emote'],
      ['bow', 'Bow', 'emote'],
      ['laugh', 'Laugh', 'emote'],
      ['friend.yes', 'Sure, friends', 'friend'],
      ['friend.no', 'Maybe later', 'friend'],
      ['duel.yes', 'You are on', 'friend'],
      ['duel.no', 'Not today', 'friend'],
      ['guild.yes', 'I would like to join', 'friend'],
      ['guild.no', 'Not right now', 'friend'],
    ] as const
  ).map(([id, text, kind]) => [id, { id, text, kind }]),
);

/** The emote chips: always available. */
export const EMOTE_CHIPS: readonly string[] = ['wave', 'cheer', 'bow', 'laugh'];

/** The reply chips for the category of a line, before regard trims or adds to them. */
export const CHIP_SETS: Readonly<Record<Category, readonly string[]>> = {
  greet: ['hi', 'how'],
  lfg: ['gl', 'help', 'no'],
  trade: ['more', 'thanks', 'no'],
  brag: ['congrats', 'joke', 'more'],
  question: ['help', 'more', 'no'],
  answer: ['thanks', 'more'],
  joke: ['joke', 'more'],
  banter: ['joke', 'more', 'hi'],
  weather: ['more', 'hi', 'joke'],
  event: ['more', 'thanks'],
  deed: ['thanks', 'luck'],
  farewell: ['gl', 'hi'],
  afk: ['gl', 'hi'],
  complaint: ['help', 'joke', 'no'],
};

/**
 * The chips for a line whose category is too broad (see `ChipIntent`). `strange` never offers
 * "Tell me more": no Traveler knows what an odd thing was (design/08 Delivery rules, rule 5), so
 * the player can only shrug it off.
 */
export const INTENT_SETS: Readonly<Record<ChipIntent, readonly string[]>> = {
  askHow: ['tries', 'practice', 'show'],
  strange: ['unsure', 'shrug'],
  howGoes: ['fine', 'busy'],
  yesNo: ['yes', 'notyet', 'maybe'],
};

/**
 * The chips for a line that brings an earlier memory up, by the kind of memory. A thank-you is
 * answered with "Any time", a shared fight or trade with "Good times", a no-show with an apology.
 */
export const MEMORY_CHIPS: Readonly<Record<string, readonly string[]>> = {
  foughtNear: ['goodtimes', 'hi', 'how'],
  partied: ['goodtimes', 'hi', 'how'],
  helpedDown: ['anytime', 'hi', 'how'],
  traded: ['goodtimes', 'hi', 'how'],
  gifted: ['anytime', 'hi', 'how'],
  duelWon: ['goodtimes', 'hi', 'how'],
  duelLost: ['goodtimes', 'hi', 'how'],
  stoodUp: ['sorry', 'hi', 'how'],
  passedOnBoard: ['thanks', 'hi', 'how'],
  answered: ['anytime', 'hi', 'how'],
  ignoredRequest: ['sorry', 'hi', 'how'],
};

/** The chips on a Traveler's friend request, and on a friend's hello. */
export const REQUEST_CHIPS: readonly string[] = ['friend.yes', 'friend.no'];
export const DUEL_CHIPS: readonly string[] = ['duel.yes', 'duel.no'];
export const GUILD_CHIPS: readonly string[] = ['guild.yes', 'guild.no'];
export const HELLO_CHIPS: readonly string[] = ['hi', 'how', 'busy'];

/** A reply line, with who it suits. A reply with no `temper` suits all. */
export interface Reply {
  text: string;
  temper?: Temper;
  archetype?: readonly Archetype[];
}

const R = (text: string, temper?: Temper): Reply => (temper ? { text, temper } : { text });

/** The Traveler's side of each chip. Every chip has at least one reply every temper can give. */
export const REPLIES: Readonly<Record<string, readonly Reply[]>> = {
  hi: [R('hey'), R('hello there'), R('hey, good to see you', 'bold'), R('oh. hi', 'shy')],
  how: [
    R('not bad, you?'),
    R('busy, but good'),
    R('great, thanks for asking', 'bold'),
    R('fine. thanks', 'shy'),
  ],
  help: [
    R('i am fine, but thank you'),
    R('maybe in a bit, thanks'),
    R('yes please, grab the left one', 'bold'),
    R('oh, um, thanks. i can manage', 'shy'),
  ],
  joke: [R('ha'), R('i try'), R('i will be here all week', 'bold'), R('heh', 'shy')],
  thanks: [R('no problem'), R('any time'), R('happy to help', 'bold'), R('np', 'shy')],
  no: [R('no worries'), R('another time then'), R('fair enough', 'bold'), R('ok', 'shy')],
  more: [
    R('long story, ask me later'),
    R('you will find out, just keep playing'),
    R('where do i even start', 'bold'),
    R('it is a bit much to type', 'shy'),
  ],
  gl: [R('thanks, you too'), R('cheers'), R('i will need it', 'bold'), R('thanks', 'shy')],
  congrats: [
    R('thanks'),
    R('i got lucky'),
    R('i have been working at it', 'bold'),
    R('oh. ty', 'shy'),
  ],
  later: [R('see you around'), R('later'), R('catch you soon', 'bold'), R('bye', 'shy')],
  luck: [
    R('lucky or not, well done'),
    R('i will take that kind of luck'),
    R('i need some of that', 'bold'),
    R('heh. nice', 'shy'),
  ],
  tries: [
    R('that is how it goes'),
    R('worth it in the end'),
    R('i will keep trying, then', 'bold'),
    R('oh. ok. good to know', 'shy'),
  ],
  practice: [
    R('fair, practice it is'),
    R('ok, i will keep at it'),
    R('then i will practice all night', 'bold'),
    R('ok. thanks', 'shy'),
  ],
  show: [
    R('yes, please'),
    R('maybe later, thanks'),
    R('yes! when are you free?', 'bold'),
    R('oh. would you? thanks', 'shy'),
  ],
  unsure: [
    R('huh. maybe it was nothing'),
    R('ok. forget i asked'),
    R('i must be imagining things', 'bold'),
    R('oh. sorry', 'shy'),
  ],
  shrug: [R('fair enough'), R('hm. ok'), R('well, whatever it was', 'bold'), R('ok', 'shy')],
  fine: [
    R('not bad, thanks'),
    R('good, busy day'),
    R('great, thanks for asking', 'bold'),
    R('fine. thanks', 'shy'),
  ],
  busy: [R('same here'), R('good to be busy'), R('ha, me too', 'bold'), R('same. ok', 'shy')],
  yes: [R('good'), R('great, thank you'), R('perfect', 'bold'), R('oh. good', 'shy')],
  notyet: [
    R('no rush'),
    R('that is fine'),
    R('you will get there', 'bold'),
    R('ok. no rush', 'shy'),
  ],
  maybe: [
    R('think it over'),
    R('fair enough'),
    R('i will take a maybe', 'bold'),
    R('ok. maybe is fine', 'shy'),
  ],
  anytime: [
    R('i will remember that'),
    R('you are kind'),
    R('that means a lot', 'bold'),
    R('oh. thanks again', 'shy'),
  ],
  goodtimes: [
    R('good times indeed'),
    R('we should do it again'),
    R('best kind of day', 'bold'),
    R('oh. yes', 'shy'),
  ],
  sorry: [
    R('no worries'),
    R('it happens'),
    R('all good, really', 'bold'),
    R('oh. it is ok', 'shy'),
  ],
  wave: [R('o/'), R('hey'), R('hi hi', 'bold'), R('hi', 'shy')],
  cheer: [R('yeah!'), R('woo'), R('let us go', 'bold'), R('hehe', 'shy')],
  bow: [R('o7'), R('very polite'), R('a gentleperson, i see', 'bold'), R('o7', 'shy')],
  laugh: [R('xD'), R('ha'), R('right?', 'bold'), R('heh', 'shy')],
  'friend.yes': [
    R('nice, friends it is'),
    R('great, welcome to the list'),
    R('yes! finally', 'bold'),
    R('oh. ok. yes', 'shy'),
  ],
  'duel.yes': [
    R('good. no hard feelings either way'),
    R('here we go'),
    R('ready when you are', 'bold'),
    R('ok. gentle, please', 'shy'),
  ],
  'duel.no': [
    R('fair enough, another time'),
    R('no worries'),
    R('your loss', 'bold'),
    R('ok', 'shy'),
  ],
  'guild.yes': [
    R('welcome in!'),
    R('great, you are in'),
    R('yes! welcome to the guild', 'bold'),
    R('oh good. welcome', 'shy'),
  ],
  'guild.no': [
    R('no rush, the offer stands'),
    R('fair, maybe later'),
    R('your loss, ha. another time', 'bold'),
    R('ok. maybe later', 'shy'),
  ],
  'friend.no': [
    R('no worries, maybe later'),
    R('sure, another time'),
    R('fair enough', 'bold'),
    R('ok. sorry', 'shy'),
  ],
};

/** What Travelers say to the player, whispered, by temper. */
export const WHISPERS = {
  request: [
    R('hey, we keep running into each other. want to be friends?'),
    R('you fight well. add me?'),
    R('been meaning to ask, friends?', 'steady'),
    R('i like how you play. friend me?', 'bold'),
    R('um, this is awkward. would you like to be friends?', 'shy'),
  ],
  accepted: [
    R('great, friends it is'),
    R('nice, added you'),
    R('yes! welcome to my list', 'bold'),
    R('oh. ok. i would like that', 'shy'),
  ],
  declined: [
    R('maybe when i know you better'),
    R('not yet, but soon'),
    R('thanks, but i keep my list small', 'steady'),
    R('sorry. maybe later', 'shy'),
  ],
  hello: [
    R('just logged in. you around?'),
    R('hey, back online'),
    R('hello, friend. what are you up to?', 'bold'),
    R('hi. just saying hi', 'shy'),
  ],
} as const satisfies Record<string, readonly Reply[]>;

/**
 * Lines that bring up an earlier memory of the player: the "they remember" moments. `{memory.subject}`
 * is a creature, a board or an item by kind; `{memory.daysAgo}` reads "today", "yesterday" or "3 days
 * ago". Said at most once per Traveler per session.
 */
export const MEMORY_LINES: Readonly<Record<string, readonly string[]>> = {
  foughtNear: [
    'we were fighting near each other {memory.daysAgo}. that {memory.subject} was a handful',
    'i remember you fighting a {memory.subject} {memory.daysAgo}',
  ],
  partied: ['good run together {memory.daysAgo}', 'we partied {memory.daysAgo}. do that again?'],
  helpedDown: [
    'you helped me up {memory.daysAgo}. i have not forgotten',
    'thanks again for the rescue {memory.daysAgo}',
  ],
  traded: [
    'good trade with you {memory.daysAgo}',
    'that {memory.subject} deal {memory.daysAgo} was fair',
  ],
  gifted: [
    'i still think about that gift from {memory.daysAgo}',
    'thank you for the gift {memory.daysAgo}',
  ],
  duelWon: [
    'good duel {memory.daysAgo}. you earned that win',
    'i am still thinking about that duel {memory.daysAgo}',
  ],
  duelLost: [
    'i beat you in a duel {memory.daysAgo}. a rematch?',
    'rematch? i won {memory.daysAgo}',
  ],
  stoodUp: ['you did not show {memory.daysAgo}. it happens', 'i waited a while {memory.daysAgo}'],
  passedOnBoard: [
    'you passed me on the {memory.subject} board {memory.daysAgo}. well played',
    'saw you climb the {memory.subject} board {memory.daysAgo}',
  ],
  answered: [
    'thanks for answering my question {memory.daysAgo}',
    'you were a help {memory.daysAgo}, thanks',
  ],
  ignoredRequest: ['i asked for a hand {memory.daysAgo}. no hard feelings'],
};

/**
 * What a sleeping Traveler says when the player pokes them awake (POW-M5-31). A joke, not an
 * interaction: no memory and no regard come of it. A Friend wakes friendlier.
 */
export const WAKE = {
  grumpy: [
    R('i was not asleep'),
    R('five more minutes'),
    R('i was resting my eyes'),
    R('what? who? i am awake'),
    R('i was thinking very hard', 'bold'),
    R('i was only blinking slowly', 'steady'),
    R('oh. sorry. i dozed off', 'shy'),
    R('this had better be good'),
  ],
  friendly: [
    R('oh hey, you caught me napping'),
    R('thanks for the wake up, friend'),
    R('ha, you got me. hi'),
    R('good timing, i was dreaming about iron', 'bold'),
  ],
} as const satisfies Record<string, readonly Reply[]>;

/**
 * What Travelers say around a duel (POW-M5-12). Sporting always: nobody is cruel (design/07 rule 4).
 * `ask` is a Traveler's challenge, whispered. `accept` and `refuse` answer the player's challenge.
 * `go` is said as the count ends. `winner` is a Traveler who won, `loser` a Traveler who lost.
 */
export const DUEL_LINES = {
  ask: [
    R('fancy a duel? first to lose a third of their health'),
    R('you and me, a friendly duel. what do you say?'),
    R('i have been itching for a duel. you free?', 'bold'),
    R('would you like a duel? only if you want to', 'shy'),
  ],
  accept: [
    R('you are on'),
    R('sure, a friendly one'),
    R('finally! let us go', 'bold'),
    R('ok. um. ok. let us do it', 'shy'),
  ],
  refuse: [
    R('not today, sorry'),
    R('maybe when i know you better'),
    R('i am not in the mood. another time'),
    R('i do not really duel. sorry', 'shy'),
  ],
  go: [R('three, two, one, go'), R('begin'), R('may the best swing win', 'bold')],
  winner: [
    R('good duel. you made me work for it'),
    R('that was close. well fought'),
    R('gg, and thank you for the match', 'bold'),
    R('oh. i won? good duel', 'shy'),
  ],
  loser: [
    R('well done, that was a clean win'),
    R('you got me. good duel'),
    R('next time, i promise. well fought', 'bold'),
    R('wow. ok. good duel', 'shy'),
  ],
  draw: [R('we ran out of time. a draw'), R('call it even'), R('a fair draw')],
} as const satisfies Record<string, readonly Reply[]>;

/**
 * What a Rival says (POW-M5-12). `appear` is said when a Rival turns up at a dungeon the player
 * keeps going to: sporting, never cruel. `help` is said when the player is downed and a Rival is
 * about. `{dungeon}` is a baked dungeon name; `{player}` is the player.
 */
export const RIVAL_LINES = {
  appear: [
    R('so you are here again, {player}. i will race you through {dungeon}'),
    R('{dungeon} again? me too. may the best run win, {player}'),
    R('saw you head for {dungeon}. i will not make it easy', 'bold'),
    R('oh. {player}. i am in {dungeon} too. good luck', 'shy'),
  ],
  help: [
    R('hang in there, {player}. i will hold them off'),
    R('not on my watch, {player}. get up'),
    R('i want the rematch, so do not stay down', 'bold'),
    R('are you ok? i will cover you', 'shy'),
  ],
} as const satisfies Record<string, readonly Reply[]>;

/** Guild invitations and answers (POW-M5-08), whispered. `{guild}` is the guild's name. */
export const GUILD_WHISPERS = {
  invite: [
    R('hey, want to join {guild}? you would fit right in'),
    R('we have room in {guild}, interested?'),
    R('you should join {guild}. i will vouch for you', 'bold'),
    R('um, would you like to join {guild}? no pressure', 'shy'),
  ],
  officer: [
    R('i look after recruits for {guild}. you meet our bar. want in?'),
    R('{guild} is recruiting and you qualify. interested?'),
    R('officer of {guild} here. we want you. join?', 'bold'),
    R('hello. i help run {guild}. would you like to join us?', 'shy'),
  ],
  notYet: [
    R('not yet, {guild} has a bar to meet. keep at it'),
    R('soon maybe. {guild} wants a bit more first'),
    R('come back when you are ready, {guild} will be here', 'bold'),
    R('sorry, {guild} has rules. not yet', 'shy'),
  ],
  inGuild: [
    R('you are already in a guild, you would have to leave it first'),
    R('one guild at a time, friend'),
    R('loyalty first, ha. leave yours and ask again', 'bold'),
    R('oh, you have a guild already', 'shy'),
  ],
} as const;
