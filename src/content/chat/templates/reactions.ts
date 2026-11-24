import type { ChatTemplate } from '../types';

/** Reactions: to the weather and the hour, to a find, a rank, and (later) to the player's deeds. */
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
  cooldownMin: 45,
  ...extra,
});

export const REACTIONS: readonly ChatTemplate[] = [
  // Weather.
  T(
    'weather.rain',
    'weather',
    'state.weather',
    ['rain at {place}', 'raining again', 'it is pouring at {place}'],
    {
      when: { weather: ['rain'] },
    },
  ),
  T(
    'weather.storm',
    'weather',
    'state.weather',
    ['storm coming in, stay inside', 'thunder over {place}. not going out'],
    {
      when: { weather: ['storm'] },
    },
  ),
  T(
    'weather.fog',
    'weather',
    'state.weather',
    ['fog is thick today', 'cannot see past my own feet at {place}'],
    {
      when: { weather: ['fog'] },
    },
  ),
  T(
    'weather.snow',
    'weather',
    'state.weather',
    ['snow! first of the year', 'cold at {place} today'],
    {
      when: { weather: ['snow'] },
    },
  ),
  T(
    'weather.clear',
    'weather',
    'state.weather',
    ['lovely day for it', 'clear skies over {place}', 'not a cloud in the sky'],
    {
      when: { weather: ['clear'] },
    },
  ),
  T('weather.hot', 'weather', 'state.weather', ['warm one today', 'hot out here at {place}'], {
    when: { weather: ['heat'] },
  }),
  T(
    'weather.inside',
    'weather',
    'state.weather',
    ['staying at {place} until it passes', 'waiting out the {weather} at {place}'],
    {
      when: { weather: ['rain', 'storm', 'snow', 'fog'] },
      channel: 'local',
    },
  ),
  T(
    'weather.gather',
    'weather',
    'state.weather',
    ['good weather for gathering', 'perfect for a long gather'],
    {
      when: { weather: ['clear'], archetype: ['Explorer', 'Casual', 'Crafter'] },
    },
  ),
  T(
    'weather.fight',
    'weather',
    'state.weather',
    ['bad weather to be fighting in', 'creatures are harder to see in this {weather}'],
    {
      when: { weather: ['rain', 'storm', 'fog'], archetype: ['Grinder', 'Veteran'] },
    },
  ),
  T(
    'weather.warm',
    'weather',
    'state.weather',
    ['{weather} again. same as yesterday', 'another {weather} day'],
    { weight: 1 },
  ),

  // The hour.
  T(
    'event.dawn',
    'event',
    'state.phase',
    ['good morning', 'up early {time}', 'sun is up at {place}'],
    {
      when: { phase: ['dawn'] },
    },
  ),
  T(
    'event.dusk',
    'event',
    'state.phase',
    ['sun is going down at {place}', 'dusk already', 'lamps are coming on'],
    {
      when: { phase: ['dusk'] },
    },
  ),
  T(
    'event.night',
    'event',
    'state.phase',
    ['dark out {time}', 'night in {place}, careful out there', 'creatures are meaner at night'],
    {
      when: { phase: ['night'] },
    },
  ),
  T('event.day', 'event', 'state.phase', ['busy {time}', 'plenty of people around {place}'], {
    when: { phase: ['day'] },
  }),
  T('event.late', 'event', 'state.phase', ['it is late. one more run', 'way past my bedtime'], {
    when: { phase: ['night'], archetype: ['Grinder', 'Casual', 'Veteran'] },
  }),

  // Boasts: a rank, a find, a craft.
  T(
    'brag.rank',
    'brag',
    'travelerRankUp',
    ['{skill} is rank {rank} now', 'finally, {skill} {rank}', 'rank {rank} in {skill}'],
    { cooldownMin: 20 },
  ),
  T(
    'brag.rank.humble',
    'brag',
    'travelerRankUp',
    ['{skill} {rank}. slow and steady', 'small step, {skill} {rank}'],
    {
      when: { archetype: ['Casual', 'Newbie', 'Socializer'] },
      cooldownMin: 20,
    },
  ),
  T(
    'brag.rank.loud',
    'brag',
    'travelerRankUp',
    ['{skill} {rank}!! come at me', 'rank {rank} {skill}, who is next?'],
    {
      when: { archetype: ['Grinder', 'Veteran', 'Completionist'] },
      cooldownMin: 20,
    },
  ),
  T(
    'brag.rank.local',
    'brag',
    'travelerRankUp',
    ['did you see that? {skill} {rank}', '{skill} just hit {rank}'],
    {
      channel: 'local',
      cooldownMin: 20,
    },
  ),
  T(
    'brag.rank.tally',
    'brag',
    'travelerRankUp',
    ['for the record: {skill} at {rank}', 'logged: {skill} {rank}'],
    {
      when: { archetype: ['Completionist', 'Explorer'] },
      cooldownMin: 20,
    },
  ),
  T(
    'brag.loot',
    'brag',
    'travelerLooted',
    ['finally, a {item}!', 'got a {item} off a {creature}', '{item} dropped!'],
    { weight: 4 },
  ),
  T(
    'brag.loot.loud',
    'brag',
    'travelerLooted',
    ['{item} DROPPED. FINALLY', 'a {item} from a {creature}, call it luck'],
    {
      when: { archetype: ['Grinder', 'Veteran'] },
    },
  ),
  T(
    'brag.loot.local',
    'brag',
    'travelerLooted',
    ['look, a {item}', 'a {creature} dropped a {item}'],
    { channel: 'local' },
  ),
  T(
    'brag.loot.qty',
    'brag',
    'travelerLooted',
    ['{qty} {item} from one {creature}, not bad', 'got {qty} {item} at {place}'],
    {
      when: { archetype: ['Casual', 'Crafter', 'Trader'] },
    },
  ),
  T(
    'brag.craft',
    'brag',
    'travelerCrafted',
    ['made {qty} {item}', '{item} done', 'another {item} off the line'],
    { weight: 2 },
  ),
  T(
    'brag.craft.skill',
    'brag',
    'travelerCrafted',
    ['{skill} work, {item} came out clean', 'good {skill} session, got {item}'],
    {
      when: { archetype: ['Crafter', 'Completionist'] },
    },
  ),
  T(
    'brag.idle',
    'brag',
    'state.idle',
    ['{skill} is rank {rank} and climbing', 'my {skill} is coming along, rank {rank}'],
    {
      when: { archetype: ['Grinder', 'Completionist', 'Veteran'] },
    },
  ),

  // Deaths: said by someone watching.
  T(
    'event.died.watch',
    'event',
    'travelerDied',
    ['o7 to whoever just fell at {place}', 'a {creature} got someone at {place}'],
    {
      channel: 'local',
      weight: 2,
    },
  ),
  T(
    'event.died.kind',
    'event',
    'travelerDied',
    ['are you okay? that {creature} was big', 'ouch, a {creature}. you good?'],
    {
      channel: 'local',
      when: { archetype: ['Socializer', 'Roleplayer'] },
    },
  ),
  T(
    'event.died.warn',
    'event',
    'travelerDied',
    ['careful at {place}, a {creature} is out there', 'watch out for the {creature} near {place}'],
    {
      weight: 2,
    },
  ),

  // The player's public deeds. Lines for the deeds that exist today arrive with POW-M5-15.
  T('deed.generic', 'deed', 'playerDeed', ['well done, {player}', 'nice one, {player}'], {
    weight: 1,
  }),
  T(
    'deed.cheer',
    'deed',
    'playerDeed',
    ['{player} is making a name for themselves', 'everyone is talking about {player}'],
    {
      weight: 1,
      channel: 'local',
    },
  ),
];
