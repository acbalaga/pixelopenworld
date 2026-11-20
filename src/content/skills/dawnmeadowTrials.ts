import { rootwayPortal, rootwayRoomId } from '../world/dungeons/rootway';
import type { TrialDef, TrialObjective } from './types';

/**
 * Dawnmeadow's rank 15 Trials for the skills the first map did not test (POW-M4-12,
 * regions/01-dawnmeadow section 9). Each is written once here: who gives it, what it asks, what the
 * giver says and the clue the Skills tab shows. `skills/index.ts` adds the defs to `TRIALS`,
 * `strings/skills.ts` adds the words, and `dialogue` adds the giver's offer.
 *
 * Voice: plain, dry, no lore. No em dashes.
 */
export interface AuthoredTrial {
  skill: string;
  giver: string;
  objective: TrialObjective;
  /** What the giver says when they set the test. */
  intro: string;
  /** The Skills tab line: who, and a clue. */
  hint: string;
  /** The player's button in the giver's test menu. */
  button: string;
  estMinutes: number;
}

export const AUTHORED_TRIALS: readonly AuthoredTrial[] = [
  {
    skill: 'skill.shieldcraft',
    giver: 'npc.guard',
    objective: { kind: 'perform', action: 'parry', count: 3, inOneFight: true },
    intro:
      'A shield is for the blow you meant to take. Turn three of them aside in a single fight, and I will say you can use one.',
    hint: 'Orla, at the gate, wants three blows parried in one fight.',
    button: 'The shield test.',
    estMinutes: 6,
  },
  {
    skill: 'skill.bartering',
    giver: 'npc.shopkeeper',
    objective: { kind: 'perform', action: 'haggle', count: 2, inOneFight: false },
    intro:
      'Anyone can pay the price on the tag. Win a better one at my counter, twice, and I will call you a trader.',
    hint: 'Brin wants a better price won at his counter, twice.',
    button: 'The bargaining test.',
    estMinutes: 6,
  },
  {
    skill: 'skill.tailoring',
    giver: 'npc.outfitter',
    objective: { kind: 'craft', recipe: 'recipe.outfit_wayfarer', minQuality: 1 },
    intro:
      'Cut it, stitch it, wear it a day. Make me a wayfarer outfit that is Fine or better and I will know your hands.',
    hint: 'Mara wants a wayfarer outfit made at the loom, Fine or better.',
    button: 'The tailoring test.',
    estMinutes: 8,
  },
  {
    skill: 'skill.alchemy',
    giver: 'npc.herbalist',
    objective: { kind: 'craft', recipe: 'recipe.potion_health_s', minQuality: 1 },
    intro:
      'A good draught is measured, not guessed. Brew me a small health potion that is Fine or better.',
    hint: 'Ilse wants a small health potion brewed, Fine or better.',
    button: 'The brewing test.',
    estMinutes: 6,
  },
  {
    skill: 'skill.enchanting',
    giver: 'npc.scholar',
    objective: { kind: 'craft', recipe: 'recipe.enchant_power_1', minQuality: 0 },
    intro:
      'Runes do what they are told, if you tell them clearly. Work me an enchantment for power.',
    hint: 'Wren wants an enchantment for power worked at the rune stone.',
    button: 'The enchanting test.',
    estMinutes: 8,
  },
  {
    skill: 'skill.deciphering',
    giver: 'npc.scholar',
    objective: { kind: 'perform', action: 'readManual', count: 1 },
    intro:
      'Reading is half the work and understanding the other half. Find a book that teaches something, read it through, and come back.',
    hint: 'Wren wants a manual found and read.',
    button: 'The reading test.',
    estMinutes: 6,
  },
  {
    skill: 'skill.stealth',
    giver: 'npc.pilgrim',
    // The Narrow Crawl is the quiet way through the Rootway: past a sleeping boar, out into the gallery.
    objective: {
      kind: 'reach',
      room: rootwayRoomId('r4'),
      from: rootwayPortal('r2', 'r3b'),
      withinTicks: 240 * 30,
    },
    intro:
      'There is a cave under the oak with a way that is narrow and quiet. Take it from the fork to the dark beyond without waking what sleeps there.',
    hint: 'The Pilgrim wants the Narrow Crawl passed, fork to the dark gallery, within four minutes.',
    button: 'The quiet test.',
    estMinutes: 6,
  },
  {
    skill: 'skill.woodworking',
    giver: 'npc.carpenter',
    objective: { kind: 'craft', recipe: 'recipe.shield_buckler', minQuality: 1 },
    intro:
      'Joints that hold are the whole trade. Make me a buckler that is Fine or better, and no glue.',
    hint: 'Pell wants a buckler made at the workbench, Fine or better.',
    button: 'The joinery test.',
    estMinutes: 8,
  },
  {
    skill: 'skill.logging',
    giver: 'npc.carpenter',
    objective: { kind: 'gather', item: 'item.oak_log', count: 4 },
    intro:
      'A tree falls where you tell it or where it likes. Bring down oak for me: four logs, cleanly.',
    hint: 'Pell wants four oak logs felled.',
    button: 'The felling test.',
    estMinutes: 5,
  },
  {
    skill: 'skill.tinkering',
    giver: 'npc.tinker',
    objective: { kind: 'craft', recipe: 'recipe.lantern', minQuality: 1 },
    intro:
      'Anything can be made to work if you stop arguing with it. Build me a lantern that is Fine or better.',
    hint: 'Juniper wants a lantern built at the tinker bench, Fine or better.',
    button: 'The tinkering test.',
    estMinutes: 8,
  },
  {
    skill: 'skill.fishing',
    giver: 'npc.fisher',
    objective: { kind: 'gather', item: 'item.fish_river', count: 3 },
    intro:
      'Patience, and then a little more patience. Land three river fish and I will believe you have both.',
    hint: 'Nessa wants three river fish landed.',
    button: 'The fishing test.',
    estMinutes: 6,
  },
  {
    skill: 'skill.mining',
    giver: 'npc.foreman',
    objective: { kind: 'gather', item: 'item.iron_ore', count: 3 },
    intro:
      'Stone gives up what it holds, but only to someone who keeps hitting it. Bring me three iron ore.',
    hint: 'Garrick wants three iron ore mined.',
    button: 'The mining test.',
    estMinutes: 6,
  },
  {
    skill: 'skill.survival',
    giver: 'npc.hermit',
    objective: { kind: 'perform', action: 'sleepOutdoors', count: 2 },
    intro:
      'The land does not care whether you are comfortable. Sleep out under the sky, two nights, and see.',
    hint: 'Old Fen wants two nights slept outdoors.',
    button: 'The survival test.',
    estMinutes: 6,
  },
  {
    skill: 'skill.cartography',
    giver: 'npc.hermit',
    objective: { kind: 'explore', blocks: 120 },
    intro:
      'A map is a promise that someone went there. Walk the country until you have drawn a good piece of it.',
    hint: 'Old Fen wants a good stretch of country walked and drawn on the map.',
    button: 'The mapping test.',
    estMinutes: 8,
  },
];

const skillName = (skill: string): string => skill.replace(/^skill\./, '');

/** The Trial defs the table makes. */
export function authoredTrialDefs(): Record<string, TrialDef> {
  const out: Record<string, TrialDef> = {};
  for (const t of AUTHORED_TRIALS) {
    const id = `trial.${skillName(t.skill)}.15`;
    out[id] = {
      id,
      skill: t.skill,
      threshold: 15,
      giver: { npc: t.giver },
      intro: `${id}.intro`,
      hint: `${id}.hint`,
      objective: t.objective,
      estMinutes: t.estMinutes,
    };
  }
  return out;
}

/** The strings the table makes: the giver's words, the clue and the player's button. */
export function authoredTrialStrings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of AUTHORED_TRIALS) {
    const id = `trial.${skillName(t.skill)}.15`;
    out[`${id}.intro`] = t.intro;
    out[`${id}.hint`] = t.hint;
    out[`dlg.rq.t_${skillName(t.skill)}`] = t.button;
  }
  out['dlg.c_tests'] = 'Could you test me?';
  out['dlg.rq.tests'] = 'Which test did you have in mind?';
  return out;
}
