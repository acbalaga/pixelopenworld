import type { LetterTemplate } from './types';

const mk =
  (kind: LetterTemplate['kind'], stem: string) =>
  (n: number, text: string): LetterTemplate => ({
    id: `letter.${stem}.n${String(n).padStart(2, '0')}`,
    kind,
    text,
  });
const V = mk('invite', 'invite');
const R = mk('rival', 'rival');
const W = mk('duelWon', 'duelwon');
const D = mk('duelLost', 'duellost');

/** Invitations to somewhere a Traveler spends time. `{place}` is a baked place. */
export const INVITES: readonly LetterTemplate[] = [
  V(1, 'i will be at {place} tonight, {player}. come by if you can'),
  V(2, 'meet me at {place}? no reason. just company'),
  V(3, '{player}, a few of us are at {place}. there is room for one more'),
  V(4, 'i am going to {place} in a bit. join me'),
  V(5, 'if you are free, {place} is quiet right now. nice for talking'),
  V(6, 'come to {place}. i will save you a spot'),
  V(7, 'heading to {place} to work. want company, {player}?'),
  V(8, '{place} tonight. bring a friend, or come alone'),
  V(9, 'i am at {place} until late. no rush, {player}'),
  V(10, 'the best place to be right now is {place}. trust me'),
  V(11, 'a few of us are meeting at {place}. you are on the list'),
  V(12, 'drop by {place} when you can. i have news'),
  V(13, '{player}, will you be at {place}? i would like to see you'),
  V(14, 'we are doing a little thing at {place}. low key. you should come'),
  V(15, 'if you are bored, {place} is where i am'),
  V(16, 'come find me at {place}. i will be the one waving'),
  V(17, 'i am trying a new routine at {place}. need a witness'),
  V(18, 'meet me at {place} and i will show you something'),
  V(19, 'saving the evening for {place}. say yes, {player}'),
  V(20, 'a slow one at {place} tonight. just talking'),
  V(21, '{place} in an hour? i will bring snacks'),
  V(22, 'finally some free time. i am at {place}. you?'),
  V(23, 'let us catch up at {place}, {player}. it has been a while'),
  V(24, 'the usual place, {place}. the usual time. the usual me'),
];

/** Rivals write sporting letters: a poke, never cruelty. */
export const RIVALS: readonly LetterTemplate[] = [
  R(1, 'i passed you on the board today, {player}. enjoy it while you can'),
  R(2, 'you are in my way, {player}. i like that'),
  R(3, 'do not get comfortable. i am coming for your spot'),
  R(4, 'good race lately. i want another'),
  R(5, 'i am practicing. you should too, {player}'),
  R(6, 'every time i think i have you, you pull ahead. keep doing that'),
  R(7, 'my count is climbing. yours is too. let us see who blinks'),
  R(8, 'you are the reason i play harder. thanks, i suppose'),
  R(9, 'i hear you cleared it again. i will clear it faster'),
  R(10, 'no hard feelings if i win. i will say that now'),
  R(11, 'meet me at the next one, {player}. best result takes bread'),
  R(12, 'i found a shortcut. i will not tell you. you will see'),
  R(13, 'it is a good rivalry, {player}. keep it up'),
  R(14, 'i put in extra hours just to catch you. do not make it easy'),
  R(15, 'a toast to the person who makes me try harder'),
  R(16, 'if you beat me this week, i will buy the bread. if i win, you do'),
  R(17, 'your last run was clean. i hate that. well done'),
  R(18, 'i am not worried. ok i am a little worried'),
  R(19, 'see you at the top, {player}. or just below it'),
  R(20, 'rematch soon. i have been thinking about it all week'),
];

/** After a duel the player won: a good loser's note. */
export const DUEL_WON: readonly LetterTemplate[] = [
  W(1, 'good duel, {player}. you earned that one'),
  W(2, 'you beat me fair. i will be back with a better plan'),
  W(3, 'i have been replaying it all night. your timing was perfect'),
  W(4, 'well fought. the next one is mine'),
  W(5, 'i lost, but i learned something. thank you'),
  W(6, '{player}, that was a clean win. no excuses'),
  W(7, 'my arm is sore and my pride is bruised. well done'),
  W(8, 'a worthy opponent. rematch when you are ready'),
  W(9, 'you were faster than i expected. respect'),
  W(10, 'that duel made my week, even though i lost'),
];

/** After a duel the player lost: a gracious winner's note. */
export const DUEL_LOST: readonly LetterTemplate[] = [
  D(1, 'good duel, {player}. that was close, honestly'),
  D(2, 'i got lucky on that last exchange. you were right there'),
  D(3, 'do not be down about it. you made me work for it'),
  D(4, 'rematch whenever you like. i would enjoy it'),
  D(5, 'thank you for the fight. you have got real speed'),
  D(6, 'a fair result, but a close one. try the left side next time'),
  D(7, '{player}, you will get me next time. i can feel it'),
  D(8, 'you took more from me than anyone this month'),
  D(9, 'i won, but you taught me something. thanks'),
  D(10, 'a good fight deserves a good letter. so, thanks, {player}'),
];
