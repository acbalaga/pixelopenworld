import type { ChatScene } from './types';

/**
 * Lines for the small scenes of POW-M5-27. Plain, a little silly, never cruel (design/07 rule 4).
 * Nothing here explains the world or points at the hidden layer. `{handle}` is the other speaker.
 * The fountain is the well in the square.
 */
const S = (
  id: string,
  kind: ChatScene['kind'],
  roles: string,
  lines: readonly string[],
  extra: Partial<ChatScene> = {},
): ChatScene => ({
  id,
  kind,
  weight: 3,
  lines: lines.map((text, i) => ({ role: roles[i] as 'a' | 'b' | 'c', text })),
  ...extra,
});

export const SCENES: readonly ChatScene[] = [
  // A coin at the fountain, and a wish.
  S('scene.wish.n1', 'wish', 'a', ['one coin. i wish for a good drop today']),
  S('scene.wish.n2', 'wish', 'a', ['wish: a clean run, no deaths']),
  S('scene.wish.n3', 'wish', 'a', ['for luck. all of it. please']),
  S('scene.wish.n4', 'wish', 'a', ['i wish my bag had more room']),
  S('scene.wish.n5', 'wish', 'a', ['wish for a rare drop, any rare drop']),
  S('scene.wish.n6', 'wish', 'a', ['wish: the dummy goes easy on me next time']),
  S('scene.wish.n7', 'wish', 'a', ['fountain, make me a rank up']),

  // The wish came true, tied to a real event of theirs.
  S('scene.wishcame.rank.n1', 'wishCame', 'a', ['the wish worked. rank up'], { on: 'rank' }),
  S('scene.wishcame.rank.n2', 'wishCame', 'a', ['told you the fountain listens. rank up'], {
    on: 'rank',
  }),
  S('scene.wishcame.rank.n3', 'wishCame', 'a', ['a coin well spent, got my rank up'], {
    on: 'rank',
  }),
  S('scene.wishcame.drop.n1', 'wishCame', 'a', ['the fountain came through, nice drop'], {
    on: 'drop',
  }),
  S('scene.wishcame.drop.n2', 'wishCame', 'a', ['wish worked, look at that drop'], { on: 'drop' }),
  S('scene.wishcame.drop.n3', 'wishCame', 'a', ['one coin, one drop. fair trade'], { on: 'drop' }),

  // A dance-off at the inn: a challenges, b answers, c judges (a again if only two dance).
  S('scene.dance.n1', 'dance', 'abc', [
    '{handle} dance off. right now',
    'you are on',
    'the judges say a draw. you both owe me a drink',
  ]),
  S('scene.dance.n2', 'dance', 'abc', [
    '{handle}, bet you cannot out dance me',
    'watch the feet',
    'that was a crime against music. a tie',
  ]),
  S('scene.dance.n3', 'dance', 'abc', [
    'dance off at the inn, {handle}. last one standing buys bread',
    'the bread is already mine',
    'the winner is whoever did not fall. so you both lose',
  ]),
  S('scene.dance.n4', 'dance', 'abc', [
    'step aside {handle}, i have moves',
    'those are not moves, that is a stumble',
    'the stumble wins on style',
  ]),
  S('scene.dance.n5', 'dance', 'abc', [
    'ready {handle}? three, two, one',
    'oh i was born ready',
    'scored by the innkeeper: ten for effort',
  ]),
  S('scene.dance.n6', 'dance', 'abc', [
    '{handle} let us settle this on the floor',
    'the floor is lava',
    'the lava lost. you both win',
  ]),

  // Stories at camp, with a punchline about who screamed.
  S('scene.ghost.n1', 'ghost', 'ababa', [
    'so the lantern was walking all by itself down the road',
    'and then?',
    'and then something screamed',
    'who screamed',
    'me. a moth landed on me',
  ]),
  S('scene.ghost.n2', 'ghost', 'ababa', [
    'a cold voice said, who is sitting in my spot',
    'who was it',
    'the cat. she wants the log back',
    'who screamed just now',
    'nobody. the fire popped',
  ]),
  S('scene.ghost.n3', 'ghost', 'ababa', [
    'there is a man who only walks the river at night',
    'what does he do',
    'he asks if you have seen his boat',
    'AAAH',
    'sorry, that was me. i saw a frog',
  ]),
  S('scene.ghost.n4', 'ghost', 'ababa', [
    'the old road is haunted, you know',
    'by what',
    'a very polite ghost. he says excuse me before he scares you',
    'who screamed?',
    'me. he said excuse me first',
  ]),
  S('scene.ghost.n5', 'ghost', 'abab', [
    'gather round, this one is true',
    'it is never true',
    'a stew pot that hums when nobody is looking',
    'the stew is humming. stop. who screamed',
  ]),
  S('scene.ghost.n6', 'ghost', 'ababa', [
    'something is watching us from the reeds',
    'it is a heron',
    'a heron with a grudge',
    'who screamed?',
    'the heron. it wants its reeds back',
  ]),

  // Arguments with the training dummy: alone, then with a friend who teases.
  S('scene.dummy.n1', 'dummy', 'aa', [
    'rematch. one more round',
    'the dummy cheats. it does not move and it still wins',
  ]),
  S('scene.dummy.n2', 'dummy', 'aa', [
    'i demand a rematch',
    'it is lagging, that is the only explanation',
  ]),
  S('scene.dummy.n3', 'dummy', 'aa', [
    'that dummy dodged. it has no legs',
    'i want a refund on this dummy',
  ]),
  S('scene.dummy.n4', 'dummy', 'aa', [
    'one more. i was warming up',
    'it blocked me. it is made of wood',
  ]),
  S('scene.dummy.n5', 'dummy', 'aa', [
    'best of three. no, best of five',
    'the dummy has a good guard today',
  ]),
  S('scene.dummy.n6', 'dummy', 'aa', [
    'okay the dummy won. but i let it',
    'rematch tomorrow. it knows what it did',
  ]),
  S('scene.dummy.tease.n1', 'dummy', 'aba', [
    'the dummy cheated',
    '{handle} it is a dummy. it stands still',
    'a very confident stand',
  ]),
  S('scene.dummy.tease.n2', 'dummy', 'aba', [
    'rematch!',
    'you lost to a stick, {handle}',
    'a stick with attitude',
  ]),
  S('scene.dummy.tease.n3', 'dummy', 'aba', [
    'again, it was lagging',
    'the dummy is not lagging, {handle}. you are',
    'rude. true, but rude',
  ]),
  S('scene.dummy.tease.n4', 'dummy', 'aba', [
    'best of five',
    '{handle} you have lost to it five times already',
    'five is an unlucky number',
  ]),
  S('scene.dummy.tease.n5', 'dummy', 'aba', [
    'it blocked me!',
    'it has never blocked anything, {handle}',
    'it is learning',
  ]),
  S('scene.dummy.tease.n6', 'dummy', 'aba', [
    'it hits harder than it looks',
    'it does not hit, {handle}',
    'exactly. suspicious',
  ]),
];
