import { FARMING } from '../balance/farming';
import { COOKING } from '../balance/cooking';
import { DISHES } from '../items/dishes';
import { CROP_LIST, CROP_NAMES } from '../farming/crops';

/**
 * Farming words (POW-M6-02): crop and seed names and descriptions, the plot sheet, and Edda's
 * lease. Plain, no lore, no em dashes.
 */

/** One line about each new crop item. Existing items keep their own. */
const CROP_DESC: Readonly<Record<string, string>> = {
  'crop.turnip': 'Round, white and purple at the shoulder. Ready in a day.',
  'crop.radish': 'Small, red and sharp. Spring only.',
  'crop.potato': 'Dug from loose earth. Good in anything.',
  'crop.pea': 'A pod of sweet peas. The vine keeps giving.',
  'crop.leek': 'A long white stem under green flags.',
  'crop.wheat': 'Golden ears. Aldo mills two into flour.',
  'crop.barley': 'Bearded ears of summer barley.',
  'crop.onion': 'Papery skin, and it makes you cry.',
  'crop.carrot': 'Orange and crisp, pulled with the tops on.',
  'crop.cabbage': 'A heavy autumn head, tight as a fist.',
  'crop.tomato': 'Red and warm from the vine.',
  'crop.runner_bean': 'Long green beans from a climbing vine.',
  'crop.strawberry': 'Small and sweet. Spring only.',
  'crop.corn': 'A full cob in its husk.',
  'crop.pumpkin': 'An autumn pumpkin. Some grow very large.',
  'crop.pepper': 'Glossy and hot.',
  'crop.garlic': 'A bulb of cloves. Hesper never has enough.',
  'crop.beet': 'Deep red all the way through.',
  'crop.hops': 'Green cones, bitter and fragrant.',
  'crop.woad': 'A leaf that steeps into blue dye.',
  'crop.melon': 'A sweet summer melon. Some grow very large.',
  'crop.saffron': 'Red threads from a purple flower. Worth its weight.',
  'crop.frost_kale': 'Kale that sweetens in the cold.',
  'crop.frostroot': 'A pale root that only grows under frost.',
  'crop.artichoke': 'A tight green bud, eaten before it flowers.',
  'crop.honeyvine': 'Golden grapes that taste of honey.',
};

/** "spring", "spring and autumn", "spring, summer and autumn". */
const list = (xs: readonly string[]): string =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

const crops: Record<string, string> = {};
for (const c of CROP_LIST) {
  const n = CROP_NAMES[c.id];
  if (!n) continue;
  if (c.value !== undefined) {
    crops[`${c.result}.name`] = n.crop;
    crops[`${c.result}.desc`] = CROP_DESC[c.id] ?? '';
  }
  crops[`${c.seed}.name`] = n.seed;
  crops[`${c.seed}.desc`] =
    `Plant in a tilled plot. Grows in ${c.seasons.length === 4 ? 'any season' : list(c.seasons)}${c.shade ? ', in shade only' : ''}.`;
}

export const FARM_ITEM_STRINGS: Readonly<Record<string, string>> = {
  ...crops,
  'item.compost.name': 'Compost',
  'item.compost.desc': 'Rotted scraps and moss. Feeds tired soil, or a growing crop.',
  'item.hoe.name': 'Hoe',
  'item.hoe.desc': 'Breaks new ground. A plot needs tilling once.',
  'item.watering_can.name': 'Watering Can',
  'item.watering_can.desc': 'Holds ten waterings. Fill it at the well or the river.',
};

const NUM = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** Edda's lease and the seed sellers' doors. */
function leaseStrings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let n = 1; n <= FARMING.plots; n++) {
    out[`dlg.reeve.c_plots_${n}`] = n === 1 ? 'One plot.' : `${NUM[n]} plots.`;
    for (let w = 1; w <= FARMING.lease.maxWeeks; w++)
      out[`dlg.reeve.c_lease_${n}_${w}`] =
        `${NUM[w]} week${w === 1 ? '' : 's'}, ${n * w * FARMING.lease.weekly} coin.`;
  }
  return out;
}

export const FARM_DIALOGUE_STRINGS: Readonly<Record<string, string>> = {
  ...leaseStrings(),
  // Cooking (M6-04): the teachers' pages and Aldo's mill.
  ...Object.fromEntries(
    DISHES.filter((d) => d.learn === 'teach').map((d) => [`dlg.cook.t_${d.key}`, `${d.name}.`]),
  ),
  'dlg.cook.c_teach': 'Could you teach me a dish?',
  'dlg.cook.teach': 'Which one? Watch the first time, and the rest is yours.',
  'dlg.cook.taught': 'Like that. Now you know it.',
  'dlg.miller.c_mill': `Mill some wheat for me (${COOKING.mill.wheat} wheat, ${COOKING.mill.fee} coin).`,
  'dlg.miller.milled': 'There. Mind the sack, it splits.',
  'dlg.reeve.c_field': 'About the field past the east gate.',
  'dlg.reeve.field': `Six plots past the east gate, the first by the road. ${FARMING.lease.weekly} coin a plot for a week, paid ahead. Let it lapse and nothing is touched, it just stops growing until you pay. How many?`,
  'dlg.reeve.weeks': 'How far ahead do you want to pay?',
  'dlg.reeve.leased':
    'Done. The ground wants breaking first. Brin sells a hoe, and a can for the watering.',
  'dlg.miller.c_shop': 'Do you sell seed grain?',
  'dlg.farmer.c_shop': 'Have you seeds to spare?',
  'dlg.hermit.c_shop': 'What grows up here?',
  'dlg.hesper.c_shop': 'Any seeds from the kitchen garden?',
};

/** The plot sheet and the field's messages. `{x}` marks are filled in by the sheet. */
export const FARM_STRINGS = {
  title: 'Plot {n}',
  unleased: 'Not leased. Edda, the reeve, leases these plots by the week.',
  leasedFor: 'Leased for {d} more days.',
  leasedHours: 'Leased for less than a day more.',
  lapsed: 'The lease has run out. Nothing grows until it is paid. Nothing is taken.',
  untilled: 'The ground is hard. A hoe breaks it.',
  empty: 'Tilled and empty.',
  soil: ['Soil: worn out', 'Soil: fair', 'Soil: good', 'Soil: rich'] as readonly string[],
  stage: ['just planted', 'sprouting', 'growing', 'ripe'] as readonly string[],
  crop: '{crop}, {stage}.',
  wet: 'Watered.',
  dry: 'Dry. It grows at half speed.',
  rain: 'The rain is watering it.',
  fed: 'Fed with compost.',
  waiting: 'Out of season. It waits.',
  giant: 'A giant {crop}!',
  water: 'Can: {n} of {max} waterings.',
  plantHead: 'Plant',
  noSeeds: 'No seeds for this season in the bag.',
  till: 'Till',
  waterBtn: 'Water',
  fertilize: 'Fertilize',
  harvest: 'Harvest',
  refused: {
    lease: 'This plot is not leased. Ask Edda in the square.',
    hoe: 'You need a hoe to break this ground.',
    can: 'You need a watering can.',
    empty: 'The can is empty. Fill it at the well or the river.',
    compost: 'You have no compost.',
    cannot: 'That will not grow here, now, or yet by your hand.',
  } as Readonly<Record<string, string>>,
  filled: 'The can is full.',
  learned: 'The pod grew into {crop}. You know its seed now.',
  giantGrew: 'Something in the field has grown very large.',
} as const;

/** Cooking words (M6-04): the card's chip and the toasts. */
export const COOK_STRINGS = {
  shareFood: 'Share food',
  shared: 'You share {item} with {handle}.',
  campMeal: 'Your party eats with you.',
  milled: 'Aldo hands you a sack of flour.',
} as const;
