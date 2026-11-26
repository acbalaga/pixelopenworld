import { G, type GuildLine } from './types';

const bell = G(9);
const fog = G(10);
const stilt = G(11);
const summit = G(12);

/** Ninth Bell: jokey trash talk. Wardens: warm, glyphy. Stiltwalkers: dry. Summit Club: excitable numbers. */
export const GUILD_LINES_C: readonly GuildLine[] = [
  bell('hi', 'hello', 'the bell rings, who wants a beating', 'i am here, prepare to lose'),
  bell('bye', 'bye', 'off. nobody beat me tonight, as usual', 'logging, you all got lucky'),
  bell(
    'welcome',
    'welcome',
    'welcome {player}, fresh challenger! no hard feelings when i win',
    'a new duelist! welcome {player}',
  ),
  bell(
    'rank',
    'rank',
    '{handle} {skill} up, finally a fair fight',
    'gz {handle}, now i might sweat',
  ),
  bell('loot', 'loot', 'nice {item}, i will win it off you later', 'a {item}? flex'),
  bell('goal', 'goal', 'weekly goal done, now back to fighting each other', 'goal cleared, gg all'),
  bell('i1', 'idle', 'ladder update: i am still on top, sorry', 'who wants the next round'),
  bell(
    'i2',
    'idle',
    'i lost one duel today and i am not talking about it',
    'that loss did not count, lag',
  ),
  bell(
    'i3',
    'idle',
    'good duel earlier, rematch any time',
    'respect to whoever parried me, that was clean',
  ),
  bell('i4', 'idle', 'first to thirty percent, best of three, now', 'anyone brave enough tonight?'),
  bell(
    'i5',
    'idle',
    'my sword is faster than your excuses',
    'i am not trash talking, i am motivating',
  ),
  bell('n1', 'night', 'night duels hit different', 'late crowd, best duels'),
  bell('i6', 'idle', 'gg to everyone who lost to me today', 'the ladder fears me'),
  bell('i7', 'idle', 'trash talk is love', 'shake hands after, always'),

  fog('hi', 'hello', 'hi friends :) the woods say hello', 'evening ^^ who is out foraging'),
  fog('bye', 'bye', 'off now, be kind to the critters', 'night all <3'),
  fog(
    'welcome',
    'welcome',
    'welcome {player} :) the forest is happy',
    'oh hi {player}! welcome to the wardens ^^',
  ),
  fog('rank', 'rank', 'yay {handle}, {skill} up :)', 'so proud of {handle} <3'),
  fog('loot', 'loot', 'a {item}! nature provides :)', 'ooh {item}, thank the critter'),
  fog('goal', 'goal', 'goal done :) the woods thank you', 'we did it ^^'),
  fog('i1', 'idle', 'saw a hare do a little hop today :)', 'the mosslings are so round today'),
  fog(
    'i2',
    'idle',
    'please do not hit the passive ones for no reason',
    'feed a creature, make a friend :)',
  ),
  fog('i3', 'idle', 'the dewmint by the river is in bloom ^^', 'mushrooms are up after the rain'),
  fog(
    'i4',
    'idle',
    'i named a crab yesterday. his name is Gerald',
    'hawks are so pretty in the evening',
  ),
  fog('i5', 'idle', 'soft steps in the woods, friends', 'listen to the leaves :)'),
  fog('n1', 'night', 'the night critters are out :)', 'glowcaps are glowing tonight ^^'),
  fog('i6', 'idle', 'who wants to forage together', 'baskets ready? :)'),
  fog('i7', 'idle', 'a bird sat on my hat today :D', 'the river is singing'),

  stilt('hi', 'hello', 'here.', 'present. probably.'),
  stilt('bye', 'bye', 'gone.', 'leaving. do not touch my vials.'),
  stilt('welcome', 'welcome', '{player}. welcome. mind the fumes.', 'oh. {player}. hello.'),
  stilt('rank', 'rank', '{handle}. {skill}. fine.', 'acceptable work, {handle}.'),
  stilt('loot', 'loot', '{item}. might explode. keep it.', 'interesting {item}.'),
  stilt('goal', 'goal', 'goal done. nobody exploded.', 'quota met. back to the shadows.'),
  stilt(
    'i1',
    'idle',
    'a vial hissed at me today. we are even.',
    'nightshade is not a snack. i checked.',
  ),
  stilt('i2', 'idle', 'stealth tip: do not.', 'quiet is a skill.'),
  stilt('i3', 'idle', 'my eyebrows grew back.', 'the smoke was blue. it should not be blue.'),
  stilt(
    'i4',
    'idle',
    'nobody saw me today. good.',
    'i was in the square. you missed me. as planned.',
  ),
  stilt('i5', 'idle', 'dew vials wanted. no questions.', 'trading tinctures. ask quietly.'),
  stilt('n1', 'night', 'night. finally.', 'the dark is comfortable.'),
  stilt('i6', 'idle', 'hm.', '...'),
  stilt('i7', 'idle', 'labels matter. ask me how i know.', 'i drank the wrong one. again.'),

  summit('hi', 'hello', 'HELLO! who is running today!!', 'hi hi! new route idea!'),
  summit('bye', 'bye', 'off! new personal best tomorrow!!', 'logging, legs are tired lol'),
  summit(
    'welcome',
    'welcome',
    'WELCOME {player}!! what is your best time?',
    'yay {player}! we go fast here!',
  ),
  summit('rank', 'rank', '{handle} {skill} up!! that is so fast', 'gz {handle}!!! speed!'),
  summit('loot', 'loot', 'a {item} on the way? no stopping though!', '{item}! grab it and go!'),
  summit('goal', 'goal', 'goal done in record time!!', 'weekly done! splits were great'),
  summit(
    'i1',
    'idle',
    'square to north gate in 9 seconds, beat that',
    'found a corner cut at the mill!',
  ),
  summit(
    'i2',
    'idle',
    'if you sprint and dodge you go like 3% faster i think',
    'stamina management is everything!!',
  ),
  summit(
    'i3',
    'idle',
    'climbed the quarry ridge, view is amazing',
    'who wants to race to cairnmoor',
  ),
  summit('i4', 'idle', 'my record is 2 minutes 14 to stonecrop', 'new route: 1:58!!'),
  summit(
    'i5',
    'idle',
    'resetting my run, tripped on a hare',
    'timer is running, do not talk to me lol',
  ),
  summit('n1', 'night', 'night runs are faster, less traffic', 'moonlit sprint!'),
  summit('i6', 'idle', 'splits posted on the board', 'any% wayside is solved'),
  summit('i7', 'idle', 'athletics trial under par or bust', 'par is a suggestion'),
];
