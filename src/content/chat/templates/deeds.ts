import type { ChatTemplate } from '../types';
import { L, T } from './helper';

/**
 * Reactions to the player's public deeds that exist today (POW-M5-15): a boss resolved, a Trial
 * passed, a rank, a Singular finished, and a Traveler passed on a board. Said by someone who was
 * there. None names or explains the hidden layer (design/08 Delivery rules): a Singular is
 * remarked on only as an odd thing, never as a thing with a meaning.
 */
export const DEEDS: readonly ChatTemplate[] = [
  // A boss resolved.
  L(
    'deed.boss.n01',
    'deed',
    'deed.boss',
    ['{player} just beat the boss!', 'did you see that? {player} cleared it'],
    { weight: 4, cooldownMin: 10 },
  ),
  L(
    'deed.boss.n02',
    'deed',
    'deed.boss',
    ['nice one, {player}. that boss is no joke', 'well fought, {player}'],
    { cooldownMin: 10 },
  ),
  L(
    'deed.boss.n03',
    'deed',
    'deed.boss',
    [
      '{player} is out of the dungeon alive and holding a trophy, i am jealous',
      'whatever {player} just did, i want to do it too',
    ],
    { when: { archetype: ['Newbie', 'Casual', 'Socializer'] }, cooldownMin: 10 },
  ),
  L('deed.boss.n04', 'deed', 'deed.boss', ['clean run, {player}', 'solid, {player}. respect'], {
    when: {
      archetype: ['Veteran', 'Grinder', 'Completionist'],
      voice: ['veteran', 'terse', 'dry'],
    },
    cooldownMin: 10,
  }),
  L(
    'deed.boss.n05',
    'deed',
    'deed.boss',
    [
      'Well done, {player}. That was a fine victory.',
      'A boss falls, and {player} stands. Well done.',
    ],
    { when: { voice: ['formal', 'roleplay'] }, cooldownMin: 10 },
  ),
  L('deed.boss.n06', 'deed', 'deed.boss', ['{player} did it!! :star:', 'go {player}! :sparkle:'], {
    when: { voice: ['glyphy', 'excitable', 'kind'] },
    cooldownMin: 10,
  }),
  L(
    'deed.boss.n07',
    'deed',
    'deed.boss',
    ['how long did that take, {player}?', 'was it hard, {player}? i keep failing'],
    { when: { archetype: ['Newbie', 'Casual', 'Explorer'] }, cooldownMin: 10 },
  ),
  L(
    'deed.boss.n08',
    'deed',
    'deed.boss',
    [
      'they say you can walk around the boss. {player} just did it the hard way',
      'fight or sneak, {player} got through. good for you',
    ],
    { when: { archetype: ['Explorer', 'Veteran', 'Completionist'] }, cooldownMin: 10 },
  ),
  T(
    'deed.boss.n09',
    'deed',
    'deed.boss',
    ['somebody just cleared a boss, i heard the horn', 'a boss fell. good for whoever it was'],
    { cooldownMin: 10, weight: 2 },
  ),

  // A Trial passed.
  L(
    'deed.trial.n01',
    'deed',
    'deed.trial',
    ['{player} passed a Trial! nice', 'congrats on the Trial, {player}'],
    { weight: 4, cooldownMin: 10 },
  ),
  L(
    'deed.trial.n02',
    'deed',
    'deed.trial',
    ['a Trial is a real test. well done, {player}', 'Trials are rough. respect, {player}'],
    { cooldownMin: 10 },
  ),
  L(
    'deed.trial.n03',
    'deed',
    'deed.trial',
    ['did you pass? you passed! {player}!!', '{player} passed, {player} passed, {player} passed'],
    { when: { voice: ['excitable', 'glyphy', 'jokey'] }, cooldownMin: 10 },
  ),
  L(
    'deed.trial.n04',
    'deed',
    'deed.trial',
    ['what was your time, {player}?', 'how many tries did the Trial take, {player}?'],
    { when: { archetype: ['Completionist', 'Grinder', 'Veteran'] }, cooldownMin: 10 },
  ),
  L(
    'deed.trial.n05',
    'deed',
    'deed.trial',
    [
      'the first Trial is the hardest. you will love the next one',
      'once you pass one, the rest feel easier',
    ],
    {
      when: { archetype: ['Veteran', 'Completionist'], voice: ['kind', 'veteran', 'nerdy'] },
      cooldownMin: 10,
    },
  ),
  L(
    'deed.trial.n06',
    'deed',
    'deed.trial',
    ['Well passed, {player}. A mark of skill.', 'You have passed. A Trial well met.'],
    { when: { voice: ['formal', 'roleplay'] }, cooldownMin: 10 },
  ),
  L(
    'deed.trial.n07',
    'deed',
    'deed.trial',
    [
      '{player}, i barely know the basics. teach me?',
      'how do you do that, {player}? i keep failing mine',
    ],
    { when: { archetype: ['Newbie', 'Casual'] }, cooldownMin: 10 },
  ),

  // A rank worth a remark.
  L('deed.rank.n01', 'deed', 'deed.rank', ['nice rank, {player}', 'rank up! well done, {player}'], {
    weight: 4,
    cooldownMin: 10,
  }),
  L('deed.rank.n02', 'deed', 'deed.rank', ['{player} is climbing fast', '{player} is on a roll'], {
    cooldownMin: 10,
  }),
  L(
    'deed.rank.n03',
    'deed',
    'deed.rank',
    [
      'i am still at the bottom of the ladder, {player}. how do you do it?',
      'okay {player}, share your secrets',
    ],
    { when: { archetype: ['Newbie', 'Casual', 'Socializer'] }, cooldownMin: 10 },
  ),
  L(
    'deed.rank.n04',
    'deed',
    'deed.rank',
    ['good rank, {player}. keep going', 'rank climbs are slow. glad to see it pay off, {player}'],
    {
      when: { archetype: ['Veteran', 'Grinder', 'Crafter'], voice: ['kind', 'veteran', 'dry'] },
      cooldownMin: 10,
    },
  ),
  L('deed.rank.n05', 'deed', 'deed.rank', ['{player} up a rank! :star:', 'go {player}! :heart:'], {
    when: { voice: ['glyphy', 'excitable', 'kind'] },
    cooldownMin: 10,
  }),

  // A Singular finished: only as an odd thing, never as a thing with meaning.
  L(
    'deed.singular.n01',
    'deed',
    'deed.singular',
    [
      'something just happened to {player}. did anyone else see?',
      'what did {player} just do? that was strange',
    ],
    { weight: 3, cooldownMin: 10 },
  ),
  L(
    'deed.singular.n02',
    'deed',
    'deed.singular',
    ['{player} knows something i do not', '{player} is doing something. i can feel it'],
    { cooldownMin: 10 },
  ),
  L(
    'deed.singular.n03',
    'deed',
    'deed.singular',
    ['i heard a bell. did you hear a bell? {player}?', 'did the sky just do something? {player}?'],
    { when: { archetype: ['Newbie', 'Casual', 'Socializer'] }, cooldownMin: 10 },
  ),
  L(
    'deed.singular.n04',
    'deed',
    'deed.singular',
    ['good eye, {player}. not many find that', 'nice find, {player}. i had never seen it'],
    { when: { archetype: ['Explorer', 'Completionist', 'Veteran'] }, cooldownMin: 10 },
  ),
  L(
    'deed.singular.n05',
    'deed',
    'deed.singular',
    ['hm. well done, {player}', 'huh. nice, {player}'],
    { when: { voice: ['dry', 'terse', 'veteran', 'lowercase'] }, cooldownMin: 10 },
  ),

  // A Traveler passed on a board (the rankings ticket emits `playerPassed`).
  L(
    'deed.passed.n01',
    'deed',
    'deed.passed',
    ['{player} passed {handle} on the board', 'did you see? {player} is above {handle} now'],
    { weight: 4, cooldownMin: 10 },
  ),
  L(
    'deed.passed.n02',
    'deed',
    'deed.passed',
    [
      '{handle} is going to hear about this, {player}',
      'watch out {player}, {handle} will want that spot back',
    ],
    { cooldownMin: 10 },
  ),
  L(
    'deed.passed.n03',
    'deed',
    'deed.passed',
    [
      'you passed {handle}. i did not think anyone could',
      'passing {handle} is no small thing, {player}',
    ],
    { when: { archetype: ['Veteran', 'Grinder', 'Completionist'] }, cooldownMin: 10 },
  ),
  L(
    'deed.passed.n04',
    'deed',
    'deed.passed',
    [
      '{player} is above {handle} now. well deserved',
      'well played, {player}. {handle} will not like it, but well played',
    ],
    { when: { voice: ['kind', 'formal', 'dry'] }, cooldownMin: 10 },
  ),

  // A general nod, for any deed the engine passes along.
  L('deed.generic.n01', 'deed', 'playerDeed', ['well done, {player}', 'nice one, {player}'], {
    weight: 3,
  }),
  L('deed.generic.n02', 'deed', 'playerDeed', ['good going, {player}', 'keep it up, {player}'], {
    when: { voice: ['kind', 'chatty'] },
  }),
];
