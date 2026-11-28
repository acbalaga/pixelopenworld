import type { ChatTemplate } from '../types';
import { L } from './helper';

/**
 * Camp meals (POW-M6-04): a party member who was fed by the player's cooking says so. Said in
 * Local, by someone who is standing there, and `{item}` is always the dish that was cooked.
 */
export const MEAL: readonly ChatTemplate[] = [
  L('party.meal.n01', 'banter', 'party.meal', ['{item}! you can cook', 'ty for the {item}'], {
    cooldownMin: 10,
  }),
  L(
    'party.meal.n02',
    'banter',
    'party.meal',
    ['ok that {item} hit the spot', 'best {item} in Dawnmeadow'],
    {
      cooldownMin: 10,
    },
  ),
  L('party.meal.n03', 'banter', 'party.meal', ['fed and ready, lets go', 'nom. buff is up'], {
    cooldownMin: 10,
    when: { archetype: ['Grinder', 'Veteran', 'Completionist'] },
  }),
  L(
    'party.meal.n04',
    'banter',
    'party.meal',
    ['you made {item} for all of us?', 'a party that eats together'],
    {
      cooldownMin: 10,
      when: { archetype: ['Socializer', 'Casual', 'Roleplayer', 'Newbie'] },
    },
  ),
  L(
    'party.meal.n05',
    'banter',
    'party.meal',
    ['what is in the {item}? asking for my recipe book'],
    {
      cooldownMin: 10,
      when: { archetype: ['Crafter', 'Trader'] },
    },
  ),
];
