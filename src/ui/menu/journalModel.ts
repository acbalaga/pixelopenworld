/**
 * The Chronicle as the journal (POW-M4-22B): what is under way, what is finished, and the recipes
 * the avatar knows. Words only: no position leaves the sim (design/02). Unknown recipes are never
 * listed and no total is given, so discovery is not given away.
 */
import { NPCS } from '../../content/dialogue';
import { ITEMS } from '../../content/items';
import { RECIPES } from '../../content/items/recipes';
import type { Craft } from '../../content/items/stations';
import { SKILLS, TRIALS } from '../../content/skills';
import { fill, TRIAL_STRINGS } from '../../content/strings/skills';
import { UI_STRINGS as S } from '../../content/strings/ui';
import { requestLog, type RequestView } from '../../sim/requestLog';
import type { SimState } from '../../sim/state';
import { trialLog, type TrialLogRow } from './model';
import { ingredientLine, recipeName } from './recipeModel';

export const CRAFT_ORDER: readonly Craft[] = [
  'cooking',
  'smithing',
  'woodworking',
  'tailoring',
  'alchemy',
  'enchanting',
  'tinkering',
];

export interface UnderWayView {
  /** Active and ready, the pinned one first. */
  requests: RequestView[];
  trials: TrialLogRow[];
}

/** Requests and Trials the avatar has in hand. */
export function underWay(state: SimState, who: number): UnderWayView {
  return {
    requests: requestLog(state, who).filter((r) => r.state !== 'done'),
    trials: trialLog(state, who),
  };
}

export interface FinishedRow {
  kind: 'request' | 'trial';
  /** A stable key for the row and its sheet. */
  key: string;
  title: string;
  /** The state line: who gave it. */
  state: string;
  /** The sheet's words: the asker's own words, or the Trial's intro. */
  desc: string;
  /** The reward line, for a request. */
  reward: string;
}

export interface FinishedView {
  requests: FinishedRow[];
  trials: FinishedRow[];
}

/** Finished requests (newest first, then by title) and passed Trials (by skill name, then rank). */
export function finished(state: SimState, who: number): FinishedView {
  const j = state.entities.comps.journal[who];
  const s = state.entities.comps.skills[who];
  const done = requestLog(state, who)
    .filter((r) => r.state === 'done')
    .map((r) => ({ r, day: j?.requests[r.id]?.doneDay ?? -1 }))
    .sort((a, b) => b.day - a.day || a.r.title.localeCompare(b.r.title));
  const requests = done.map(({ r }): FinishedRow => ({
    kind: 'request',
    key: r.id,
    title: r.title,
    state: r.giver,
    desc: r.ask,
    reward: r.reward,
  }));
  const trials: (FinishedRow & { skill: string; threshold: number })[] = [];
  for (const key of s?.passed ?? []) {
    const t = Object.values(TRIALS).find((d) => `${d.skill}@${d.threshold}` === key);
    // A passed key with no matching Trial is skipped.
    if (!t) continue;
    const skill = SKILLS[t.skill]?.name ?? '';
    const giver = 'npc' in t.giver ? (NPCS[t.giver.npc]?.name ?? '') : '';
    trials.push({
      kind: 'trial',
      key: t.id,
      title: fill(S.journal.trialTitle, { skill }),
      state: giver
        ? fill(S.journal.trialState, { n: t.threshold, giver })
        : fill(S.journal.trialStateNoGiver, { n: t.threshold }),
      desc: TRIAL_STRINGS[t.intro] ?? '',
      reward: '',
      skill,
      threshold: t.threshold,
    });
  }
  trials.sort((a, b) => a.skill.localeCompare(b.skill) || a.threshold - b.threshold);
  return { requests, trials };
}

export interface RecipeRow {
  id: string;
  name: string;
  ingredients: string;
  /** The icon of what it makes, or null for an enchant. */
  icon: string | null;
}

export interface RecipeGroup {
  craft: Craft;
  label: string;
  rows: RecipeRow[];
}

/** The recipes the avatar knows, by craft in the fixed order. A craft with none is left out. */
export function knownRecipes(state: SimState, who: number): RecipeGroup[] {
  const known = new Set(state.entities.comps.inventory[who]?.recipes ?? []);
  const out: RecipeGroup[] = [];
  for (const craft of CRAFT_ORDER) {
    const rows = Object.values(RECIPES)
      .filter((r) => r.craft === craft && known.has(r.id))
      .map((r): RecipeRow => ({
        id: r.id,
        name: recipeName(r),
        ingredients: ingredientLine(r),
        icon: r.result ? (ITEMS[r.result]?.icon ?? null) : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (rows.length > 0) out.push({ craft, label: S.journal.crafts[craft] ?? craft, rows });
  }
  return out;
}
