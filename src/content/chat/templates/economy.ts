import type { ChatTemplate } from '../types';

/** Trade offers, wants and groups. Every price and item comes from a real sale, craft or recipe. */
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

export const ECONOMY: readonly ChatTemplate[] = [
  // A sale that just happened, said as a note to the market.
  T('trade.sold.basic', 'trade', 'travelerSold', [
    'sold {qty} {item} at {price}c each',
    'just sold {item} x{qty}, {price}c a piece',
  ]),
  T(
    'trade.sold.merchant',
    'trade',
    'travelerSold',
    ['cleared {qty} {item}, fair price {price}c', '{item} moved at {price}c, good trade'],
    { when: { archetype: ['Trader'] } },
  ),
  T(
    'trade.sold.low',
    'trade',
    'travelerSold',
    ['only {price}c for {item}? the shop is robbing us', 'shop paid {price}c for {item}. so low'],
    { when: { archetype: ['Trader', 'Crafter', 'Grinder'] }, weight: 2 },
  ),
  T('trade.sold.plain', 'trade', 'travelerSold', ['sold my {item}', 'shop took the {item}'], {
    weight: 2,
  }),
  T(
    'trade.sold.coin',
    'trade',
    'travelerSold',
    ['{price}c each for {item}, not bad', 'coin for {item}, good enough'],
    {
      when: { archetype: ['Casual', 'Newbie'] },
    },
  ),

  // A craft that just finished, offered for sale.
  T(
    'trade.sell.craft',
    'trade',
    'travelerCrafted',
    [
      'selling {item} x{qty}, whisper me',
      'WTS {item} {qty}x, fair offers',
      '{item} for sale, fresh off the bench',
    ],
    { when: { archetype: ['Crafter', 'Trader'] } },
  ),
  T(
    'trade.sell.local',
    'trade',
    'travelerCrafted',
    ['{item} ready, at {place}', 'made {qty} {item}, come get them'],
    {
      channel: 'local',
      when: { archetype: ['Crafter'] },
    },
  ),
  T(
    'trade.sell.proud',
    'trade',
    'travelerCrafted',
    ['look what i made, {item}', '{item} done. took long enough'],
    {
      when: { archetype: ['Newbie', 'Casual', 'Roleplayer'] },
    },
  ),
  T(
    'trade.sell.bulk',
    'trade',
    'travelerCrafted',
    ['bulk {item}, {qty} on hand', 'selling {item} in bulk, message me'],
    {
      when: { archetype: ['Trader'] },
    },
  ),

  // Loot offered on.
  T(
    'trade.loot.sell',
    'trade',
    'travelerLooted',
    ['selling a {item} that dropped, offers?', '{item} drop up for sale'],
    {
      when: { archetype: ['Trader', 'Grinder', 'Casual'] },
    },
  ),
  T(
    'trade.loot.want',
    'trade',
    'travelerLooted',
    ['anyone need {item}? got spares', 'spare {item}, free to a good home'],
    {
      when: { archetype: ['Socializer', 'Casual', 'Crafter'] },
    },
  ),

  // Wants.
  T(
    'trade.want.item',
    'trade',
    'state.idle',
    ['WTB {item}, paying well', 'looking for {item}, anyone?'],
    {
      when: { archetype: ['Crafter', 'Trader'] },
    },
  ),
  T(
    'trade.want.help',
    'trade',
    'state.idle',
    ['who sells {item}? need a few', 'where do i find {item}?'],
    {
      when: { archetype: ['Newbie', 'Casual'] },
    },
  ),
  T(
    'trade.market',
    'trade',
    'state.idle',
    ['the market at {place} is busy tonight', 'good prices at {place} today'],
    {
      when: { archetype: ['Trader', 'Crafter'] },
    },
  ),

  // Looking for a group.
  T('lfg.basic', 'lfg', 'state.lfg', [
    'LFG {dungeon}',
    'looking for a group for {dungeon}',
    'anyone running {dungeon}?',
  ]),
  T(
    'lfg.tank',
    'lfg',
    'state.lfg',
    ['need a tank for {dungeon}', '{dungeon} run, bring a shield'],
    {
      when: { archetype: ['Grinder', 'Veteran'] },
    },
  ),
  T(
    'lfg.new',
    'lfg',
    'state.lfg',
    [
      'first time in {dungeon}, can someone show me?',
      'newbie here, want to try {dungeon}. any takers?',
    ],
    {
      when: { archetype: ['Newbie', 'Casual'] },
    },
  ),
  T(
    'lfg.speed',
    'lfg',
    'state.lfg',
    ['{dungeon} speed run, serious only', 'timing {dungeon} today. need two'],
    {
      when: { archetype: ['Grinder', 'Completionist', 'Veteran'] },
    },
  ),
  T(
    'lfg.heal',
    'lfg',
    'state.lfg',
    ['healer wanted for {dungeon}', 'anyone with Mending for {dungeon}?'],
    {
      when: { archetype: ['Roleplayer', 'Socializer'] },
    },
  ),
  T(
    'lfg.local',
    'lfg',
    'state.lfg',
    ['heading to {dungeon}, join me', 'who is coming into {dungeon}?'],
    {
      channel: 'local',
    },
  ),
  T(
    'lfg.farm',
    'lfg',
    'state.lfg',
    ['farming {creature}, want company?', 'LF party, {creature} grind'],
    {
      when: { archetype: ['Grinder'] },
    },
  ),
  T(
    'lfg.rest',
    'lfg',
    'state.lfg',
    ['group full, thanks all', 'found a group, good luck everyone'],
    {
      weight: 1,
    },
  ),
  // The market moved (M5-10): a price really rose or fell this hour. `{price}` is the new price.
  T('price.up.n01', 'complaint', 'price.up', [
    '{item} is up to {price}c on the market, who is buying it all',
    'wow, {item} at {price}c now',
  ]),
  T(
    'price.up.n02',
    'complaint',
    'price.up',
    ['{item} went up again. {price}c. ugh', 'who cornered {item}? {price}c each'],
    {
      when: { archetype: ['Crafter', 'Trader', 'Newbie'] },
    },
  ),
  T(
    'price.up.n03',
    'trade',
    'price.up',
    ['good time to sell {item}, market pays {price}c', '{item} at {price}c, selling mine'],
    {
      when: { archetype: ['Trader', 'Grinder', 'Veteran'] },
    },
  ),
  T('price.up.n04', 'complaint', 'price.up', ['{item} prices are silly right now, {price}c'], {
    when: { voice: ['terse', 'dry', 'merchant'] },
  }),
  T('price.down.n01', 'trade', 'price.down', [
    '{item} crashed to {price}c, someone flooded it',
    '{item} down to {price}c on the terminal',
  ]),
  T(
    'price.down.n02',
    'trade',
    'price.down',
    ['stocking up on {item} at {price}c', 'cheap {item} right now, {price}c'],
    {
      when: { archetype: ['Crafter', 'Trader', 'Completionist'] },
    },
  ),
  T(
    'price.down.n03',
    'complaint',
    'price.down',
    ['who dumped all that {item}? {price}c now', 'my {item} is worth {price}c now. great'],
    {
      when: { archetype: ['Grinder', 'Trader', 'Veteran'] },
    },
  ),
  T('price.down.n04', 'trade', 'price.down', ['{item} is a bargain at {price}c'], {
    when: { voice: ['chatty', 'kind', 'excitable'] },
  }),
];
