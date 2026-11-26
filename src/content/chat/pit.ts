import type { Reply } from './social';

/**
 * What is said at the Pit (POW-M5-30). Spectators call out and cheer by name, and each of the
 * hand-tuned duelists has a sporting line for a win and a loss. `{handle}` is a duelist's name,
 * `{honor}` the player's Pit honor (or their handle when they have none). Never cruel.
 */

const R = (text: string, temper?: Reply['temper']): Reply => (temper ? { text, temper } : { text });

export const PIT_LINES = {
  /** A spectator as a bout begins. */
  open: [
    R('fight! fight! ...a friendly one'),
    R('{handle} vs the world, here we go'),
    R('ooh, a bout. front row'),
    R('my coin is on {handle}', 'bold'),
    R('oh, they are starting', 'shy'),
  ],
  /** A spectator cheering one fighter by name. */
  cheer: [
    R('go {handle}!'),
    R('come on {handle}'),
    R('{handle}, watch the left!'),
    R('GO {handle}!!', 'bold'),
    R('you can do it {handle}', 'shy'),
    R('nice one {handle}'),
  ],
  /** A spectator when it ends. */
  close: [
    R('what a bout'),
    R('gg both'),
    R('clean, very clean'),
    R('that was so close!', 'bold'),
    R('good fight', 'shy'),
  ],
  /** Spectators cheering the player, by their honor or name. */
  player: [
    R('go {honor}!'),
    R('the {honor} is up!'),
    R('everyone watch, {honor} is in the ring'),
    R('{honor}! {honor}!', 'bold'),
    R('good luck {honor}', 'shy'),
  ],
  /** Any duelist without their own line, winning and losing. */
  winner: [R('gg, good bout'), R('that was a fun one'), R('well fought, again sometime')],
  loser: [R('gg, you got me'), R('well fought, i will get you next time'), R('good bout')],
} as const satisfies Record<string, readonly Reply[]>;

/** Each hand-tuned duelist's own winning and losing line. */
export const DUELIST_LINES: Readonly<Record<string, { win: string; lose: string }>> = {
  NoScopeNed: {
    win: 'still undefeated today. gg though, that was close',
    lose: 'ok ok, you got me. respect. rematch later?',
  },
  Skarrow: { win: 'clean. gg', lose: 'good bout. noted' },
  Tobo: {
    win: 'did you see that spin? i did not plan it. gg',
    lose: 'hahaha i tripped over my own feet. gg',
  },
  Halla: {
    win: 'a fair exchange, and i came out ahead. gg',
    lose: 'you got the better of that deal. well played',
  },
  sir_pancake: {
    win: 'Sir Pancake stands victorious! A fine duel, good fellow!',
    lose: 'Alas, Sir Pancake is bested. Well fought, noble foe!',
  },
  lilfern: { win: 'yay :) good bout ^^', lose: 'aww you got me :) gg <3' },
  Thoradin: { win: 'HA! GOOD BOUT!', lose: 'ARGH. WELL FOUGHT. AGAIN!' },
  xVoltx: { win: 'won in 14 seconds!! new record maybe!', lose: 'aaa so close!! gg!!' },
  RiverStone: {
    win: 'oh that was fun, thanks for the bout!',
    lose: 'you were great, i had a lot of fun anyway!',
  },
  Duskwright: { win: 'margin of victory: small. gg', lose: 'loss logged. gg' },
  HollyHocks: { win: 'good bout, you did lovely', lose: 'oh well done, that was lovely' },
};
