import type { ChatTemplate } from '../types';
import { T } from './helper';

/**
 * Lines that only one hand-tuned Traveler says (POW-M5-15, design/12 section 6). They are the
 * character made audible: the thing a regular learns to expect from them. Every one carries the
 * `handle` condition and sits at a low weight so it stays a signature, not a refrain. None names a
 * region that is not baked (D25), and none says anything about the hidden layer.
 */
const own = (
  handle: string,
  n: number,
  category: ChatTemplate['category'],
  trigger: ChatTemplate['trigger'],
  text: string[],
  extra: Partial<ChatTemplate> = {},
): ChatTemplate =>
  T(`own.${handle.toLowerCase().replace(/[^a-z0-9]/g, '')}.n${n}`, category, trigger, text, {
    when: { handle: [handle] },
    weight: 6,
    cooldownMin: 90,
    ...extra,
  });

export const INDIVIDUALS: readonly ChatTemplate[] = [
  // 0 mira_: shy, kind, always at the water.
  own('mira_', 1, 'greet', 'state.idle', [
    'welcome, {player}. take your time',
    'hi {player}. the fish are biting if you want to sit',
  ]),
  own('mira_', 2, 'trade', 'state.idle', [
    'i have spare {item} if a newer player needs it',
    'extra {item}, free for anyone just starting',
  ]),
  own(
    'mira_',
    3,
    'weather',
    'state.weather',
    ['quiet at the water {time}', 'rain on the jetty is my favorite sound'],
    { when: { handle: ['mira_'], weather: ['rain', 'clear', 'fog'] } },
  ),

  // 1 Tobo: burns everything, remembers who helped.
  own('Tobo', 1, 'joke', 'state.idle', [
    'i burned the anvil. is that possible? it happened',
    'smithing update: i am now an expert at ash',
  ]),
  own(
    'Tobo',
    2,
    'question',
    'state.question',
    ['how do you stop burning the {item}?', 'how do you make {item} without it turning to slag?'],
    { topic: 'recipe' },
  ),
  own(
    'Tobo',
    3,
    'brag',
    'travelerRankUp',
    ['{skill} {rank}! i am practically a master', '{skill} {rank}! look out, guild smiths'],
    { weight: 8 },
  ),

  // 2 Halla: sells fresh forage in the morning, first to complain when prices move.
  own('Halla', 1, 'trade', 'state.idle', [
    'fresh forage this morning, still wet with dew',
    'foraged at dawn, best stock in town, whisper me',
  ]),
  own('Halla', 2, 'complaint', 'state.idle', [
    'the price of dewmint moved again. who is doing this?',
    'prices move and nobody tells me. i hear it from the shop',
  ]),
  own('Halla', 3, 'greet', 'travelerLoggedIn', [
    'market is open, come and see',
    'good morning. the market never waits',
  ]),

  // 3 Kestrel99: farms one creature area, posts kill counts.
  own('Kestrel99', 1, 'brag', 'state.idle', [
    'kill count today: new best',
    'kills this session: more than yesterday',
  ]),
  own('Kestrel99', 2, 'brag', 'state.idle', [
    'out-farming thoradin is a lifestyle',
    'rivals keep me honest. thoradin keeps me fast',
  ]),
  own('Kestrel99', 3, 'lfg', 'state.lfg', [
    'farming {creature}, same spot as yesterday, join',
    'same {creature} farm, same time. fall in',
  ]),

  // 4 sir_pancake: in-character, hosts readings at the inn.
  own(
    'sir_pancake',
    1,
    'event',
    'state.phase',
    [
      'Hear ye, hear ye: a reading at the inn, by lamplight!',
      'Gather, good folk. The inn holds a tale tonight.',
    ],
    { when: { handle: ['sir_pancake'], phase: ['dusk', 'night'] } },
  ),
  own('sir_pancake', 2, 'greet', 'travelerLoggedIn', [
    'Hail, Dawnmeadow! Sir Pancake returns.',
    'Hail and well met, all.',
  ]),
  own('sir_pancake', 3, 'joke', 'state.idle', [
    'A knight without a breakfast is merely a man in armor.',
    'Fear not the boar. Fear the empty pantry.',
  ]),

  // 5 Aelwynn: keeps a map tally, corrects directions politely.
  own('Aelwynn', 1, 'brag', 'state.idle', [
    'my map is another percent more complete, if anyone is counting',
    'map progress: slow and steady, as is proper',
  ]),
  own('Aelwynn', 2, 'answer', 'state.answer', [
    'If I may, {rumor}. I did check the map.',
    'Allow me to correct that: {rumor}.',
  ]),
  own(
    'Aelwynn',
    3,
    'greet',
    'state.idle',
    ['Welcome, {player}. Do you have a map?', 'Good day, {player}. Mind your step.'],
    { channel: 'local' },
  ),

  // 6 lilfern: greets everyone, friendliest.
  own('lilfern', 1, 'greet', 'travelerLoggedIn', [
    'hi!!! everyone!!! :heart:',
    'hello hello, so happy to see you all',
  ]),
  own(
    'lilfern',
    2,
    'greet',
    'state.idle',
    ['hi {player}!! want to be friends?', 'hi {player}! come sit with us'],
    { channel: 'local', weight: 8 },
  ),
  own('lilfern', 3, 'brag', 'state.idle', [
    'my taming skill is {rank}. look at the cute ones',
    'i met a mossling today and we became friends',
  ]),

  // 7 NoScopeNed: here since launch, duels anyone.
  own('NoScopeNed', 1, 'brag', 'state.idle', [
    'been here since day one. nothing is new to me',
    'veteran of the early days. ask me anything',
  ]),
  own('NoScopeNed', 2, 'lfg', 'state.lfg', [
    'duel at the square? i go easy on the new ones',
    'who wants a duel? sporting only',
  ]),
  own('NoScopeNed', 3, 'complaint', 'state.idle', [
    'kids these days dodge on instinct. in my day we guessed',
    'back then the boar was twice as mean',
  ]),

  // 8 Ines: logs in late, cooks for the guild, logs off when the baby wakes.
  own('Ines', 1, 'trade', 'state.idle', [
    'cooked too much again, free dish for anyone hungry',
    'there is stew for the guild, and a bowl for you if you ask',
  ]),
  own('Ines', 2, 'afk', 'state.afk', ['the baby stirs, back soon', 'afk, little one is up']),
  own('Ines', 3, 'farewell', 'travelerLoggedOut', [
    'baby is up. goodnight all',
    'bye all, thank you for the company',
  ]),

  // 9 Thoradin: LOUD about rare drops, tank, rival to Kestrel99.
  own('Thoradin', 1, 'brag', 'travelerLooted', ['{item} DROPPED', 'LOOK AT THE {item}. FINALLY'], {
    weight: 10,
  }),
  own('Thoradin', 2, 'brag', 'state.idle', [
    'KESTREL IS BEHIND ME ON THE BOARD',
    'I AM THE WALL. NOTHING PASSES',
  ]),
  own('Thoradin', 3, 'lfg', 'state.lfg', [
    'TANK AVAILABLE FOR {dungeon}',
    'NEED A GROUP FOR {dungeon}? I TANK',
  ]),

  // 10 quietcat: rarely speaks in World, whispers useful things.
  own('quietcat', 1, 'answer', 'state.answer', ['{rumor}', '{rumor}. keep it to yourself'], {
    weight: 8,
  }),
  own('quietcat', 2, 'brag', 'state.idle', [
    'found a quiet spot. do not tell anyone',
    'quiet night. i like it',
  ]),
  own('quietcat', 3, 'greet', 'state.idle', ['hi {player}', 'oh, hello {player}'], {
    channel: 'local',
    weight: 4,
  }),

  // 11 BreadKnight: only online at lunch, talks about bread.
  own(
    'BreadKnight',
    1,
    'joke',
    'state.idle',
    ['bread update: still great', 'did you know bread is a lifestyle?'],
    { weight: 8 },
  ),
  own('BreadKnight', 2, 'trade', 'state.idle', [
    'selling bread, a loaf for a coin',
    'fresh bread, whisper me, i have a lot',
  ]),
  own('BreadKnight', 3, 'farewell', 'travelerLoggedOut', [
    'lunch is over. bread break done',
    'back to work. save me a roll',
  ]),

  // 12 Marrow: best smith on the board, gracious about being passed.
  own('Marrow', 1, 'brag', 'travelerCrafted', ['a {item}. it holds', 'made a {item}. it will do'], {
    weight: 8,
  }),
  own('Marrow', 2, 'answer', 'state.answer', [
    '{rumor}. you will do better than me soon',
    '{rumor}. take it and run with it',
  ]),
  own('Marrow', 3, 'event', 'state.idle', [
    'good smithing today',
    'the anvil sings when the strike is true',
  ]),

  // 13 xVoltx: speedruns Trials, posts times.
  own('xVoltx', 1, 'brag', 'state.idle', [
    'new Trial time! small improvement, big win',
    'shaved a second off. not much, but it is mine',
  ]),
  own('xVoltx', 2, 'lfg', 'state.lfg', [
    'racing a Trial, who is in?',
    'race anyone? start at the square',
  ]),
  own('xVoltx', 3, 'joke', 'state.idle', [
    'speed is a mindset. so is tripping',
    'i run so you do not have to',
  ]),

  // 14 Saoirse: plays a healer in character, heals in parties.
  own('Saoirse', 1, 'lfg', 'state.lfg', [
    'A healer is at your service for {dungeon}.',
    'I shall tend the wounded in {dungeon}. Who comes?',
  ]),
  own(
    'Saoirse',
    2,
    'event',
    'travelerDied',
    ['Rest, friend. I will see you stand again.', 'Hold on. I am coming.'],
    { channel: 'local' },
  ),
  own('Saoirse', 3, 'greet', 'travelerLoggedIn', [
    'Good day to you all.',
    'I am here. The wounded may come to me.',
  ]),

  // 15 RiverStone: knows every fishing spot, half his rumors wrong and sure.
  own('RiverStone', 1, 'answer', 'state.answer', [
    '{rumor}. i would stake my rod on it',
    '{rumor}. i have fished here a long time, trust me',
  ]),
  own('RiverStone', 2, 'brag', 'state.idle', [
    'i know every fishing spot in the region',
    'the Reedmouth jetty at dawn, that is the spot',
  ]),
  own('RiverStone', 3, 'weather', 'state.weather', [
    'rain is when they bite, always has been',
    'grey sky, good fishing, take my word',
  ]),

  // 16 mossy_: newbie, asks questions every morning, grows into a tamer.
  own(
    'mossy_',
    1,
    'question',
    'state.question',
    [
      'hi, quick question, how do i tame a {creature}?',
      'sorry to bother, how do i befriend {creature}?',
    ],
    { topic: 'creature', weight: 8 },
  ),
  own('mossy_', 2, 'greet', 'travelerLoggedIn', [
    'good morning!! what should i learn today?',
    'morning! i have questions',
  ]),
  own('mossy_', 3, 'brag', 'state.idle', [
    'a mossling let me pet it!!',
    'i think the {creature} likes me',
  ]),

  // 17 Duskwright: corners potion ingredients, the market's sporting villain.
  own('Duskwright', 1, 'trade', 'state.idle', [
    'buying all the dewmint. name your price',
    'the potion market is mine. sell me your sunwort',
  ]),
  own('Duskwright', 2, 'brag', 'travelerCrafted', [
    'a fresh {item}, at my price',
    'a {item}. exclusive, as usual',
  ]),
  own('Duskwright', 3, 'joke', 'state.idle', [
    'villain? i am a patron of the arts',
    'supply and demand. mostly supply, which i hold',
  ]),

  // 18 Petra.k: explains crafting math nobody asked for.
  own('Petra.k', 1, 'brag', 'travelerCrafted', [
    '{item}: efficiency of this batch was 91 percent, if anyone cares',
    'the marginal cost of a {item} is lower than you think',
  ]),
  own('Petra.k', 2, 'answer', 'state.answer', [
    'Actually, {rumor}. Here is the math.',
    '{rumor}. The numbers agree.',
  ]),
  own('Petra.k', 3, 'joke', 'state.idle', [
    'crafting math is just cooking with fewer feelings',
    'i did the math and then did it again, to be sure',
  ]),

  // 19 HollyHocks: organizes festival entries, remembers birthdays in game days.
  own(
    'HollyHocks',
    1,
    'greet',
    'state.idle',
    [
      'hello {player}! are you entering the festival?',
      'welcome, {player}. we are always short a hand for the festival',
    ],
    { channel: 'local', weight: 8 },
  ),
  own('HollyHocks', 2, 'event', 'state.idle', [
    'festival entries are open. bring something nice',
    'festival entry sheets are at the inn',
  ]),
  own('HollyHocks', 3, 'brag', 'state.idle', [
    'it is the guild birthday today, in game days. cake for everyone',
    'cake day at the guild. everyone is invited',
  ]),

  // 20 Skarrow: top of the Renown board, says little, notices when the player passes him.
  own('Skarrow', 1, 'brag', 'state.idle', ['still on top', 'nothing to report']),
  own('Skarrow', 2, 'greet', 'state.idle', ['{player}.', 'hello, {player}'], {
    channel: 'local',
    weight: 3,
  }),
  own('Skarrow', 3, 'joke', 'state.idle', ['quiet is a skill too', 'less talk, more strike']),

  // 21 ByTheBook: bestiary race, asks about creatures seen.
  own(
    'ByTheBook',
    1,
    'question',
    'state.question',
    [
      'which {creature} have you seen? i am up to the one near {place}',
      'have you seen a {creature}? i am tracking my bestiary',
    ],
    { topic: 'creature', weight: 8 },
  ),
  own('ByTheBook', 2, 'brag', 'state.idle', [
    'bestiary: one entry nearer to done',
    'every entry matters. every one',
  ]),
  own('ByTheBook', 3, 'answer', 'state.answer', [
    'By the book: {rumor}.',
    'The record says: {rumor}.',
  ]),

  // 22 AshAndOak: builds bows for friends, sibling to lilfern.
  own('AshAndOak', 1, 'trade', 'state.idle', [
    'making a bow for a friend, need ash. anyone?',
    'ash logs wanted, i build bows for pals',
  ]),
  own('AshAndOak', 2, 'brag', 'travelerCrafted', [
    'a {item}, made with care, for a friend',
    'fresh {item}. if you want one, say so',
  ]),
  own('AshAndOak', 3, 'joke', 'state.idle', [
    'lilfern says it is my turn to log off. i say she is wrong',
    'sibling rule: whoever is wrong is online',
  ]),

  // 23 Olly_O: plays half asleep, gn at 02:00, AFKs at the fountain.
  own(
    'Olly_O',
    1,
    'afk',
    'state.afk',
    ['afk at the fountain. zzz', 'fell asleep at {place}. wake me later'],
    { weight: 8 },
  ),
  own('Olly_O', 2, 'farewell', 'travelerLoggedOut', ['gn', 'gn everyone, see you at eleven'], {
    weight: 8,
  }),
  own('Olly_O', 3, 'joke', 'state.idle', [
    'i am awake. mostly',
    'sleepwalking through the square, hello',
  ]),
];
