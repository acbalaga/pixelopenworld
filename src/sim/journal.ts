import { isAwake } from './skills';
import { DIALOGUES } from '../content/dialogue';
import type { Cond } from '../content/dialogue/types';
import { TRIALS } from '../content/skills';
import { countItem } from './items';
import { renownIn } from './renown';
import { trialPassed } from './skills';
import { currentWeather, dayPhase, seasonOf } from './time';
import { getComp, type EntityId } from './kernel/entities';
import type { Journal, SimState } from './state';

/** A fresh journal. */
export function newJournal(): Journal {
  return {
    flags: [],
    learnedVia: {},
    hints: [],
    hint: null,
    requests: {},
    renown: {},
    tradeCoin: {},
    pinned: null,
    singulars: {},
  };
}

/** State of a request for the avatar: `none` if never taken. */
export function requestState(j: Journal, id: string): 'none' | 'active' | 'ready' | 'done' {
  return j.requests[id]?.state ?? 'none';
}

/** True if every condition holds for `who`. */
export function holds(state: SimState, who: EntityId, conds: readonly Cond[] | undefined): boolean {
  if (!conds) return true;
  const j = getComp(state.entities, who, 'journal');
  const inv = getComp(state.entities, who, 'inventory');
  const sk = getComp(state.entities, who, 'skills');
  if (!j) return false;
  return conds.every((c) => {
    if ('flag' in c) return j.flags.includes(c.flag) !== (c.not === true);
    if ('item' in c) return (inv ? countItem(inv, c.item) : 0) >= c.atLeast;
    if ('skill' in c) return (sk?.points[c.skill] ?? 0) >= c.atLeast;
    if ('awake' in c) return sk ? isAwake(sk, c.awake) : false;
    if ('trial' in c) {
      const t = TRIALS[c.trial];
      const on =
        c.is === 'offered'
          ? sk?.offered.includes(c.trial)
          : t && sk
            ? trialPassed(sk, t.skill, t.threshold)
            : false;
      return (on === true) !== (c.not === true);
    }
    if ('pathWorn' in c)
      return (
        (getComp(state.entities, who, 'paths')?.worn.includes(c.pathWorn) === true) !==
        (c.not === true)
      );
    if ('pathEarned' in c)
      return (
        (getComp(state.entities, who, 'paths')?.earned.includes(c.pathEarned) === true) !==
        (c.not === true)
      );
    if ('renown' in c) return renownIn(state, who, c.renown.region) >= c.renown.atLeast;
    if ('phase' in c) return c.phase.includes(dayPhase(state.worldTick));
    if ('season' in c) return c.season.includes(seasonOf(state.worldTick));
    if ('weather' in c) return c.weather.includes(currentWeather(state));
    return requestState(j, c.request) === c.is;
  });
}

/** The node a talk with `npc` starts at for `who`: the first entry whose conditions hold. */
export function startNode(state: SimState, who: EntityId, npc: string): string | null {
  const d = DIALOGUES[npc];
  if (!d) return null;
  return d.entries.find((e) => holds(state, who, e.if))?.node ?? null;
}
