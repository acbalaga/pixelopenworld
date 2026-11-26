import type { Reply } from './social';

/**
 * What party members say in Party chat (POW-M5-07, design/07 Parties). Each line answers a real
 * party event: someone joined, gave notice, went down, got up, rolled on a drop. The engine voices
 * them. `{activity}` is the run's name, `{item}` a drop, `{roll}` a number rolled, `{player}` the
 * player's handle. No line explains anything about the hidden layer.
 */

const R = (text: string, temper?: Reply['temper']): Reply => (temper ? { text, temper } : { text });

export const PARTY_LINES: Readonly<Record<string, readonly Reply[]>> = {
  /** They joined from the board, or answered the player's listing. */
  join: [
    R('hi all'),
    R('hey, thanks for the inv'),
    R('o/ ready when you are'),
    R('hello hello, lets go', 'bold'),
    R('hi. i will try not to die', 'shy'),
  ],
  answer: [
    R('saw your post for {activity}, room for me?'),
    R('{activity}? count me in'),
    R('i can come along for {activity}'),
    R('inv me, i am free for {activity}', 'bold'),
    R('um, is {activity} still open? i can help', 'shy'),
  ],
  /** Notice before their session ends. */
  warn: [
    R('heads up, i have to go for dinner in ten'),
    R('ten more minutes for me, then i am off'),
    R('have to log soon, work tomorrow'),
    R('last fight for me after this one, sorry all'),
    R('gotta go in ten, the cat is yelling at me', 'bold'),
    R('sorry, i need to go soon', 'shy'),
  ],
  leave: [
    R('thanks all, gtg'),
    R('that was fun, see you around'),
    R('ty for the group o/'),
    R('off i go. good luck in there', 'bold'),
    R('thank you, bye', 'shy'),
  ],
  /** The player left the party: everyone goes their own way. */
  parted: [
    R('gg, thanks'),
    R('ty for the run'),
    R('see ya'),
    R('good group', 'bold'),
    R('bye', 'shy'),
  ],
  down: [
    R('ow, i am down'),
    R('down, res me after'),
    R('that hurt. on the floor'),
    R('i stood in it, my bad', 'bold'),
    R('sorry, i fell over', 'shy'),
  ],
  revive: [
    R('back up'),
    R('ok i am up'),
    R('alive again'),
    R('up and angry', 'bold'),
    R('up', 'shy'),
  ],
  wipe: [
    R('wipe. again?'),
    R('well that went great'),
    R('ok, new plan: we do not do that again'),
    R('run it back!', 'bold'),
    R('sorry... was that me', 'shy'),
  ],
  fightOver: [R('gg'), R('nice'), R('clean'), R('easy', 'bold'), R('phew', 'shy')],
  brb: [
    R('brb'),
    R('brb, door'),
    R('one sec, brb'),
    R('brb snack run', 'bold'),
    R('brb sorry', 'shy'),
  ],
  need: [R('need {roll}'), R('need, rolled {roll}'), R('{roll}, need')],
  pass: [R('pass'), R('pass, all yours'), R('greed... i mean pass')],
  won: [
    R('oh nice, ty'),
    R('yes! finally a {item}'),
    R('got the {item}, thanks all'),
    R('mine! ha', 'bold'),
    R('oh. thank you', 'shy'),
  ],
  rare: [
    R('wait, a {item} dropped?'),
    R('WHAT, {item}!'),
    R('never seen a {item} drop before'),
    R('{item}!! screenshot that', 'bold'),
    R('oh wow, {item}', 'shy'),
  ],
};
