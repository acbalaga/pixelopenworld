import { PATHS_BALANCE as B } from '../balance/paths';
import type { Mod } from '../items/affixes';

/**
 * Paths (M3-08): an identity the world recognizes. Earned, never chosen. `requires` holds skill
 * points, deed counts and days since a deed was last reset; every entry must hold. The gift is
 * a list of mods that apply only while the Path is worn.
 */
export interface PathDef {
  id: string;
  /** String keys in `content/strings/paths.ts`: the title shown over the avatar, how NPCs address you, the gift line and the hint. */
  nameKey: string;
  titleKey: string;
  addressKey: string;
  giftKey: string;
  hintKey: string;
  /** Never shown, and never hinted at, until earned. */
  hidden: boolean;
  requires: {
    skills?: Readonly<Record<string, number>>;
    deeds?: Readonly<Record<string, number>>;
    daysSinceReset?: Readonly<Record<string, number>>;
  };
  gift: readonly Mod[];
  /** The Path that plays opposite. It points back. */
  opposite: string;
}

const key = (id: string) => ({
  nameKey: `${id}.name`,
  titleKey: `${id}.title`,
  addressKey: `${id}.address`,
  giftKey: `${id}.gift`,
  hintKey: `${id}.hint`,
});

const LIST: readonly PathDef[] = [
  {
    id: 'path.duelist',
    ...key('path.duelist'),
    hidden: false,
    requires: {
      skills: { 'skill.blades': B.duelist.skill },
      deeds: {
        'deed.kills_onehand': B.duelist.kills,
        'deed.untouched_fights': B.duelist.untouched,
      },
    },
    gift: [{ stat: 'critPct', add: B.duelist.critPct }],
    opposite: 'path.bulwark',
  },
  {
    id: 'path.bulwark',
    ...key('path.bulwark'),
    hidden: false,
    requires: {
      skills: { 'skill.shieldcraft': B.bulwark.skill },
      deeds: { 'deed.parries': B.bulwark.parries },
    },
    gift: [{ stat: 'blockStaPct', pct: B.bulwark.blockStaPct }],
    opposite: 'path.duelist',
  },
  {
    id: 'path.emberhand',
    ...key('path.emberhand'),
    hidden: false,
    requires: {
      skills: { 'skill.ember': B.emberhand.skill },
      deeds: { 'deed.ember_damage': B.emberhand.damage },
    },
    gift: [{ stat: 'emberFocPct', pct: B.emberhand.emberFocPct }],
    opposite: 'path.tidecaller',
  },
  {
    id: 'path.tidecaller',
    ...key('path.tidecaller'),
    hidden: false,
    requires: {
      skills: { 'skill.tide': B.tidecaller.skill },
      deeds: { 'deed.wet_applied': B.tidecaller.wet },
    },
    gift: [{ stat: 'wetTicksPct', pct: B.tidecaller.wetTicksPct }],
    opposite: 'path.emberhand',
  },
  {
    id: 'path.forager',
    ...key('path.forager'),
    hidden: false,
    requires: {
      skills: { 'skill.foraging': B.forager.skill },
      deeds: { 'deed.forage': B.forager.gathered },
    },
    gift: [{ stat: 'gatherYield', add: B.forager.yield, arg: 'foraging' }],
    opposite: 'path.prospector',
  },
  {
    id: 'path.prospector',
    ...key('path.prospector'),
    hidden: false,
    requires: {
      skills: { 'skill.mining': B.prospector.skill },
      deeds: { 'deed.ore': B.prospector.gathered },
    },
    gift: [{ stat: 'durabilityLossPct', pct: B.prospector.durabilityLossPct, arg: 'mining' }],
    opposite: 'path.forager',
  },
  {
    id: 'path.anvil_hand',
    ...key('path.anvil_hand'),
    hidden: false,
    requires: {
      skills: { 'skill.smithing': B.anvilHand.skill },
      deeds: { 'deed.metal_crafted': B.anvilHand.crafted, 'deed.repairs': B.anvilHand.repairs },
    },
    gift: [{ stat: 'repairMaterialFree', add: 1 }],
    opposite: 'path.quick_needle',
  },
  {
    id: 'path.quick_needle',
    ...key('path.quick_needle'),
    hidden: false,
    requires: {
      skills: { 'skill.tailoring': B.quickNeedle.skill },
      deeds: { 'deed.cloth_crafted': B.quickNeedle.crafted },
    },
    gift: [{ stat: 'dodgeRecoverTicks', add: B.quickNeedle.dodgeRecoverTicks }],
    opposite: 'path.anvil_hand',
  },
  {
    id: 'path.hearth_cook',
    ...key('path.hearth_cook'),
    hidden: false,
    requires: {
      skills: { 'skill.cooking': B.hearthCook.skill },
      deeds: { 'deed.dishes': B.hearthCook.dishes, 'deed.dish_recipes': B.hearthCook.recipes },
    },
    gift: [{ stat: 'fedTicksPct', pct: B.hearthCook.fedTicksPct }],
    opposite: 'path.wild_eater',
  },
  {
    id: 'path.wild_eater',
    ...key('path.wild_eater'),
    hidden: false,
    requires: {
      skills: { 'skill.survival': B.wildEater.skill },
      deeds: { 'deed.raw_eaten': B.wildEater.raw },
    },
    gift: [{ stat: 'rawFoodPct', pct: B.wildEater.rawFoodPct }],
    opposite: 'path.hearth_cook',
  },
  {
    id: 'path.haggler',
    ...key('path.haggler'),
    hidden: false,
    requires: {
      skills: { 'skill.bartering': B.haggler.skill },
      deeds: { 'deed.haggles_won': B.haggler.won },
    },
    gift: [{ stat: 'buyPct', pct: B.haggler.buyPct }],
    opposite: 'path.fair_dealer',
  },
  {
    id: 'path.fair_dealer',
    ...key('path.fair_dealer'),
    hidden: false,
    requires: { deeds: { 'deed.plain_sales': B.fairDealer.sales } },
    gift: [{ stat: 'purseRegenPct', pct: B.fairDealer.purseRegenPct }],
    opposite: 'path.haggler',
  },
  {
    id: 'path.busker',
    ...key('path.busker'),
    hidden: false,
    requires: {
      skills: { 'skill.performance': B.busker.skill },
      deeds: { 'deed.songs': B.busker.songs },
    },
    gift: [{ stat: 'songTicksPct', pct: B.busker.songTicksPct }],
    opposite: 'path.shadow',
  },
  {
    id: 'path.shadow',
    ...key('path.shadow'),
    hidden: false,
    requires: {
      skills: { 'skill.stealth': B.shadow.skill },
      deeds: { 'deed.sneaks': B.shadow.sneaks },
    },
    gift: [{ stat: 'hideSpeedPct', add: B.shadow.hideSpeedPct }],
    opposite: 'path.busker',
  },
  {
    id: 'path.mossfriend',
    ...key('path.mossfriend'),
    hidden: true,
    requires: {
      deeds: { 'deed.mossling_meets': B.mossfriend.meets },
      daysSinceReset: { 'deed.mossling_meets': B.mossfriend.days },
    },
    gift: [{ stat: 'noAggroCreature', add: 1, arg: 'creature.mossling' }],
    opposite: 'path.pestward',
  },
  {
    id: 'path.pestward',
    ...key('path.pestward'),
    hidden: true,
    requires: { deeds: { 'deed.mossling_kills': B.pestward.kills } },
    gift: [{ stat: 'tierDamagePct', pct: B.pestward.tierDamagePct, arg: '1' }],
    opposite: 'path.mossfriend',
  },
];

export const PATHS: Readonly<Record<string, PathDef>> = Object.fromEntries(
  LIST.map((p) => [p.id, p]),
);
export const PATH_LIST: readonly PathDef[] = LIST;
