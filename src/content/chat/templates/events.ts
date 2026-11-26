import type { ChatTemplate } from '../types';
import { L, T } from './helper';

/** World events (POW-M5-11): said when a raid, an invasion or a market day really begins or ends. */
export const EVENTS: readonly ChatTemplate[] = [
  T('world.raid.n01', 'event', 'world.raid', [
    'RAID at {place}! mustering at the north gate',
    'field raid up near {place}, who is in',
  ]),
  T(
    'world.raid.n02',
    'event',
    'world.raid',
    ['raid time. north gate, now', 'raid at {place}, bring food'],
    {
      when: { archetype: ['Veteran', 'Grinder', 'Completionist'] },
    },
  ),
  T(
    'world.raid.n03',
    'event',
    'world.raid',
    ['ooh a raid, can i come even if i am low?', 'first raid for me, {place}?'],
    {
      when: { archetype: ['Newbie', 'Casual'] },
    },
  ),
  T('world.raid.n04', 'event', 'world.raid', ['zerg at {place}! everyone go'], {
    when: { voice: ['shouty', 'excitable', 'jokey'] },
  }),
  T('world.invasion.n01', 'event', 'world.invasion', [
    'creatures at the gates of Hearthford!',
    'invasion! defend the town',
  ]),
  T(
    'world.invasion.n02',
    'event',
    'world.invasion',
    ['they are coming in at every gate, help', 'hold the gates everyone'],
    {
      when: { archetype: ['Veteran', 'Socializer', 'Grinder'] },
    },
  ),
  T(
    'world.invasion.n03',
    'event',
    'world.invasion',
    ['a boar is in the market street, i repeat, a boar'],
    {
      when: { voice: ['jokey', 'chatty', 'excitable'] },
    },
  ),
  T('world.market.n01', 'event', 'world.market', [
    'market day! the terminal is packed',
    'market day, best time to sell',
  ]),
  T(
    'world.market.n02',
    'event',
    'world.market',
    ['market day, i have stock to move', 'prices are lively, market day'],
    {
      when: { archetype: ['Trader', 'Crafter'] },
    },
  ),
  T('world.raidWon.n01', 'event', 'world.raidWon', [
    'raid down at {place}! gg all',
    'we got it! gg raid',
  ]),
  T('world.raidWon.n02', 'event', 'world.raidWon', ['clean raid, good work', 'raid cleared, o7'], {
    when: { voice: ['terse', 'veteran'] },
  }),
  T('world.raidLost.n01', 'event', 'world.raidLost', [
    'raid boss got away at {place}. next time',
    'we lost the raid, oof',
  ]),
];

void L;
