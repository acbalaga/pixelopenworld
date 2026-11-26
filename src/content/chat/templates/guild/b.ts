import { G, type GuildLine } from './types';

const hooks = G(5);
const brine = G(6);
const hearth = G(7);
const green = G(8);

/** Quiet Hooks: slow, kind, fish jokes. Brine Ledger: brisk merchants. Hearth and Home: chatty. Greenhand: homely. */
export const GUILD_LINES_B: readonly GuildLine[] = [
  hooks('hi', 'hello', 'evening all... the water is calm', 'hello hooks. nice and slow tonight'),
  hooks('bye', 'bye', 'reeling in for the night', 'off now. tight lines all'),
  hooks(
    'welcome',
    'welcome',
    'welcome {player}... take your time, the fish do',
    'oh, {player} is here. welcome to the club',
  ),
  hooks(
    'rank',
    'rank',
    'well done {handle}, {skill} is a patient skill',
    'nice and steady, {handle}',
  ),
  hooks('loot', 'loot', 'a {item}... lovely', 'that {item} is a keeper'),
  hooks(
    'goal',
    'goal',
    'the club met its catch this week. thank you all',
    'goal done. time for tea',
  ),
  hooks(
    'i1',
    'idle',
    'why did the fish blush... it saw the bottom of the river',
    'i told a fish a joke. it did not bite',
  ),
  hooks(
    'i2',
    'idle',
    'river is good at dusk, the silver ones come up',
    'reedmouth jetty is quiet tonight',
  ),
  hooks('i3', 'idle', 'no rush. there is never a rush', 'sometimes i just watch the float'),
  hooks(
    'i4',
    'idle',
    'record board check... nobody has beaten the old one yet',
    'that silver record still stands',
  ),
  hooks('i5', 'idle', 'bring a spare net, they snag', 'patience is half the bait'),
  hooks('n1', 'night', 'night fishing is the best fishing', 'stars on the water. nice'),
  hooks('i6', 'idle', 'anyone want to sit at the jetty a while', 'i saved you a spot by the reeds'),
  hooks('i7', 'idle', 'the one that got away was this big', 'i swear it was this big'),

  brine('hi', 'hello', 'Morning. Markets are open.', 'On. Prices first, talk later.'),
  brine('bye', 'bye', 'Closing the books. Night.', 'Off. Do not undersell.'),
  brine(
    'welcome',
    'welcome',
    'Welcome aboard, {player}. Margins are everything.',
    'New partner. Welcome, {player}.',
  ),
  brine(
    'rank',
    'rank',
    '{handle}, {skill} up. Good for business.',
    'Nice, {handle}. Raise your prices.',
  ),
  brine('loot', 'loot', 'What will that {item} fetch?', 'A {item}. Hold it, prices move.'),
  brine('goal', 'goal', 'Weekly orders filled. Profit noted.', 'Contract complete. Ledger closed.'),
  brine(
    'i1',
    'idle',
    'Salt is up again. Buy before Brin notices.',
    'Linen is cheap this week. Stock up.',
  ),
  brine(
    'i2',
    'idle',
    'Never sell to the shop what a player will pay more for.',
    'Buy low. Sell later.',
  ),
  brine(
    'i3',
    'idle',
    'Who keeps flooding copper? Stop it.',
    'Somebody is undercutting us. Find them.',
  ),
  brine('i4', 'idle', 'A rival house is watching our prices.', 'Keep the numbers to yourselves.'),
  brine(
    'i5',
    'idle',
    'Haggle hard. Smile while you do it.',
    'The best deal is the one they think they won.',
  ),
  brine('n1', 'night', 'Night market is thin. Good time to list.', 'Late listings sell at dawn.'),
  brine(
    'i6',
    'idle',
    'Coin in the purse is coin asleep. Put it to work.',
    'Margin check, everyone.',
  ),
  brine('i7', 'idle', 'Ledger audit Sunday. Bring receipts.', 'Who owes the house?'),

  hearth(
    'hi',
    'hello',
    'hiii everyone! how is everyone doing?',
    'hello hello! good to see you all',
  ),
  hearth('bye', 'bye', 'off to bed, love you all, be safe out there', 'night all! drink water!'),
  hearth(
    'welcome',
    'welcome',
    'WELCOME {player}!! so happy you are here',
    'yay, {player} joined! ask us anything, really',
  ),
  hearth('rank', 'rank', 'omg {handle} {skill} up, so proud', 'go {handle}!! well done'),
  hearth('loot', 'loot', 'ooh a {item}, lucky you', 'nice {item}! do you need help with anything?'),
  hearth(
    'goal',
    'goal',
    'we did it! weekly goal done, everyone is amazing',
    'goal finished! group hug',
  ),
  hearth(
    'i1',
    'idle',
    'anyone need help with anything? i am free',
    'if you are new, the square is a good place to start',
  ),
  hearth(
    'i2',
    'idle',
    'reminder that eating before a fight helps a lot',
    'do not forget to rest at the inn!',
  ),
  hearth(
    'i3',
    'idle',
    'hi again! did everyone have a good day?',
    'how is everyone feeling tonight?',
  ),
  hearth(
    'i4',
    'idle',
    'i am making bread for anyone who wants some',
    'who wants to do the mossling field together?',
  ),
  hearth(
    'i5',
    'idle',
    'be nice to newbies, we were all one once',
    'no question is a silly question here',
  ),
  hearth('n1', 'night', 'late night crew, hi!', 'go to sleep everyone... after one more fight'),
  hearth('i6', 'idle', 'group photo by the well later?', 'who wants to wave at the fountain'),
  hearth('i7', 'idle', 'thank you all for being so kind', 'this guild is the best, honestly'),

  green('hi', 'hello', 'hello all, the soup is on', 'evening, friends. the oven is warm'),
  green('bye', 'bye', 'off to bed, leave the kitchen tidy', 'goodnight, sleep well'),
  green(
    'welcome',
    'welcome',
    'welcome {player}, pull up a chair',
    'oh welcome {player}, are you hungry?',
  ),
  green(
    'rank',
    'rank',
    'well done {handle}, {skill} suits you',
    'look at {handle} grow, like a good seedling',
  ),
  green('loot', 'loot', 'a {item}! that will cook up nicely', 'save me that {item} for a stew'),
  green('goal', 'goal', 'the pantry is full this week. thank you', 'goal done, time for a feast'),
  green('i1', 'idle', 'dewmint goes well in tea, try it', 'a little salt brings out the berries'),
  green('i2', 'idle', 'who has spare red berries? pie tonight', 'trading bread for herbs'),
  green(
    'i3',
    'idle',
    'the season is turning, plant accordingly',
    'nothing beats a homemade dish before a fight',
  ),
  green('i4', 'idle', 'my grandmother had a recipe for this...', 'slow cooking is the secret'),
  green('i5', 'idle', 'the fields look lovely today', 'millbrook smells of fresh bread'),
  green('n1', 'night', 'late snack anyone?', 'midnight soup is the best soup'),
  green('i6', 'idle', 'remember to share your harvest', 'there is always enough to go around'),
  green('i7', 'idle', 'i burned the bread again', 'oven was too hot, lesson learned'),
];
