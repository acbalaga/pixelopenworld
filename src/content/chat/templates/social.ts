import type { ChatTemplate } from '../types';

/** Greetings, farewells, away lines, jokes and complaints: the talk of people with time on their hands. */
const T = (
  id: string,
  category: ChatTemplate['category'],
  trigger: ChatTemplate['trigger'],
  text: string[],
  extra: Partial<ChatTemplate> = {},
): ChatTemplate => ({
  id,
  category,
  channel: 'world',
  trigger,
  text,
  weight: 3,
  cooldownMin: 30,
  ...extra,
});

export const SOCIAL: readonly ChatTemplate[] = [
  // Greetings, on logging in.
  T('greet.login.basic', 'greet', 'travelerLoggedIn', [
    'hello all',
    'hey everyone',
    'back for a bit',
    'evening all',
  ]),
  T('greet.login.place', 'greet', 'travelerLoggedIn', [
    'hello, anyone at {place}?',
    'just logged in at {place}',
  ]),
  T(
    'greet.login.hail',
    'greet',
    'travelerLoggedIn',
    ['hello hello', 'good to be back', 'hi {player}, how goes it?'],
    {
      when: { archetype: ['Socializer', 'Casual', 'Newbie'] },
    },
  ),
  T(
    'greet.login.merchant',
    'greet',
    'travelerLoggedIn',
    ['morning traders, what is moving today?', 'open for business, as ever'],
    {
      when: { archetype: ['Trader', 'Crafter'] },
    },
  ),
  T(
    'greet.login.grind',
    'greet',
    'travelerLoggedIn',
    ['logged in. farming', 'online. who is grouping?'],
    {
      when: { archetype: ['Grinder', 'Veteran'] },
    },
  ),
  T('greet.login.night', 'greet', 'travelerLoggedIn', ['quiet night', 'night owls, report in'], {
    when: { phase: ['night'] },
  }),
  T('greet.arrive.square', 'greet', 'travelerArrived', ['made it to {place}', 'at {place} now'], {
    channel: 'local',
    weight: 1,
    cooldownMin: 60,
  }),
  T('greet.arrive.wave', 'greet', 'travelerArrived', ['hello {place}', 'anyone around?'], {
    channel: 'local',
    weight: 1,
    cooldownMin: 60,
    when: { archetype: ['Socializer', 'Roleplayer'] },
  }),
  T(
    'greet.local.welcome',
    'greet',
    'state.idle',
    ['hello {player}', 'welcome, {player}', 'evening, {player}'],
    {
      channel: 'local',
      weight: 2,
      cooldownMin: 120,
      when: { archetype: ['Socializer', 'Roleplayer', 'Casual'] },
    },
  ),

  // Farewells, on logging out.
  T('farewell.basic', 'farewell', 'travelerLoggedOut', [
    'gotta go',
    'logging off',
    'that is me for today',
    'off for the night',
  ]),
  T('farewell.place', 'farewell', 'travelerLoggedOut', [
    'leaving {place}, see you',
    'logging out at {place}',
  ]),
  T(
    'farewell.kind',
    'farewell',
    'travelerLoggedOut',
    ['take care everyone', 'thanks for the company'],
    {
      when: { archetype: ['Socializer', 'Casual', 'Newbie'] },
    },
  ),
  T('farewell.grind', 'farewell', 'travelerLoggedOut', ['done for the day', 'good session'], {
    when: { archetype: ['Grinder', 'Veteran', 'Completionist'] },
  }),
  T('farewell.sleep', 'farewell', 'travelerLoggedOut', ['bed time', 'work in the morning, bye'], {
    when: { phase: ['night'] },
  }),
  T('farewell.promise', 'farewell', 'travelerLoggedOut', ['back tomorrow', 'see you tomorrow'], {
    weight: 2,
  }),

  // Away lines.
  T('afk.brb', 'afk', 'state.afk', ['brb', 'brb, one minute', 'afk for a bit'], {
    weight: 4,
    cooldownMin: 45,
  }),
  T('afk.kettle', 'afk', 'state.afk', ['kettle is on, back soon', 'making tea, brb']),
  T('afk.door', 'afk', 'state.afk', ['someone at the door, brb', 'phone, back in a sec']),
  T('afk.kid', 'afk', 'state.afk', ['little one is up, back soon', 'brb, bedtime story'], {
    when: { archetype: ['Crafter', 'Socializer'] },
  }),
  T('afk.food', 'afk', 'state.afk', ['dinner is ready, back soon', 'grabbing a snack, afk']),
  T('afk.back', 'afk', 'state.idle', ['back', 'and we are back', 'sorry, back now'], { weight: 1 }),
  T('afk.sleepy', 'afk', 'state.afk', ['so sleepy, might doze here', 'eyes closing, afk'], {
    when: { phase: ['night'] },
  }),
  T('afk.fountain', 'afk', 'state.afk', ['resting by the fountain', 'staring at the water, afk'], {
    channel: 'local',
  }),

  // Jokes.
  T('joke.bread', 'joke', 'state.idle', [
    'i have eaten so much bread this week',
    'bread is the real endgame',
  ]),
  T('joke.dummy', 'joke', 'state.idle', [
    'the dummy in the square has never lost a fight',
    'respect to the dummy, it just stands there and takes it',
  ]),
  T('joke.gather', 'joke', 'state.idle', [
    'i came for one herb and left with forty',
    'one more node. just one more node',
  ]),
  T('joke.coin', 'joke', 'state.idle', [
    'my purse and i are not on speaking terms',
    'coin goes out faster than it comes in',
  ]),
  T('joke.boar', 'joke', 'state.idle', [
    'the boar and i have an understanding. i leave',
    'ran from a boar, no regrets',
  ]),
  T('joke.patch', 'joke', 'state.idle', [
    'still waiting on the patch that fixes my aim',
    'drop rates are a state of mind',
  ]),
  T(
    'joke.weather',
    'joke',
    'state.idle',
    [
      'plan for the weather, they said. i planned to be wet',
      'rain again. the crops are happy, i am not',
    ],
    { when: { weather: ['rain', 'storm'] } },
  ),
  T('joke.skill', 'joke', 'state.idle', [
    'rank {rank} {skill} and still burning dinner',
    'my {skill} is rank {rank} and my confidence is not',
  ]),
  T(
    'joke.inn',
    'joke',
    'state.idle',
    ['the inn has the best seats and the worst chairs', 'sat down at {place} and forgot to get up'],
    {
      when: { archetype: ['Casual', 'Socializer', 'Roleplayer'] },
    },
  ),
  T(
    'joke.dad',
    'joke',
    'state.idle',
    [
      'why did the mossling cross the road? curiosity',
      'a boar walks into the square. nobody stays to hear the end',
    ],
    {
      weight: 2,
    },
  ),

  // Complaints.
  T(
    'complaint.prices',
    'complaint',
    'state.idle',
    ['prices at the shop are a joke', 'Brin will not budge on iron again'],
    {
      when: { archetype: ['Trader', 'Crafter', 'Grinder'] },
    },
  ),
  T(
    'complaint.drops',
    'complaint',
    'state.idle',
    ['forty kills and not one hide', 'drop rates are a lie'],
    {
      when: { archetype: ['Grinder', 'Veteran', 'Completionist'] },
    },
  ),
  T(
    'complaint.burnt',
    'complaint',
    'state.idle',
    ['burnt the whole batch again', 'cooking is harder than it looks'],
    {
      when: { archetype: ['Newbie', 'Casual', 'Crafter'] },
    },
  ),
  T('complaint.lag', 'complaint', 'state.idle', [
    'my connection is awful tonight',
    'lag again. every night, lag',
  ]),
  T('complaint.walk', 'complaint', 'state.idle', [
    'so much walking for so little coin',
    'the walk to {place} gets longer every time',
  ]),
  T(
    'complaint.rain',
    'complaint',
    'state.weather',
    ['this {weather} again', 'i hate {weather} days'],
    {
      when: { weather: ['rain', 'storm', 'snow', 'fog'] },
    },
  ),
  T(
    'complaint.died',
    'complaint',
    'travelerDied',
    ['ugh, {creature} got me at {place}', 'died to a {creature}. do not ask'],
    {
      channel: 'local',
      weight: 4,
    },
  ),
  T(
    'complaint.died2',
    'complaint',
    'travelerDied',
    ['respawned. that went badly', 'one {creature} too many for me'],
    {
      weight: 3,
    },
  ),
  T('complaint.inventory', 'complaint', 'state.idle', [
    'bag is full again',
    'nothing fits in my bag anymore',
  ]),
  T('complaint.quest', 'complaint', 'state.idle', [
    'the board has nothing for me today',
    'every job on the board wants mosslings cleared',
  ]),
];
