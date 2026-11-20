import { TECHNIQUES } from '../../content/combat/techniques';
import { FIXTURES } from '../../content/world/fixtures';
import { TRIALS } from '../../content/skills';
import type { TrialObjective } from '../../content/skills/types';
import { fightId, trackFight } from '../fight';
import { countItem, removeItem } from '../items';
import { getComp, query, type EntityId } from '../kernel/entities';
import type { SimEvent } from '../kernel/events';
import { SUBPX } from '../kernel/fixed';
import { offerTrial, passTrial } from '../skills';
import type { SimState, TrialProgress } from '../state';
import { dayPhase } from '../time';

/**
 * Trials (M3-03). A Trial is a short authored manual test that gates a rank threshold. This
 * system advances the Trials the avatar has been given, reading the tick's events, and passes
 * them. It runs before skills so a pass releases banked XP in the same tick.
 *
 * Only manual play counts (M3 rule 9). `advanceTrials` takes the acting source, and an event from
 * anything but `manual` changes nothing. M7 adds the `routine` source.
 */
export type ActingSource = 'manual' | 'routine';

/** How close the avatar must be to a fixture to touch it, px. */
const TOUCH_PX = 20;

type Objective<K extends TrialObjective['kind']> = Extract<TrialObjective, { kind: K }>;

/**
 * One objective being tracked, with its progress and what to do when it is met. Trials and
 * requests (M3-11) both track objectives this way, so the rules below are written once.
 */
export interface Tracked {
  o: TrialObjective;
  p: TrialProgress;
  done: () => void;
  /** False once something else has already met this objective, so a delivery takes nothing. */
  live?: () => boolean;
}

/** The Trials that are offered to `who` and not passed, as trackers. */
function trialTrackers(state: SimState, who: EntityId): Tracked[] {
  const s = getComp(state.entities, who, 'skills');
  if (!s) return [];
  const out: Tracked[] = [];
  for (const id of [...s.offered].sort()) {
    const def = TRIALS[id];
    if (!def) continue;
    out.push({
      o: def.objective,
      p: (s.trial[id] ??= { n: 0, t0: 0 }),
      done: () => void passTrial(state, who, def.id),
    });
  }
  return out;
}

function finish(t: Tracked, count: number): void {
  if (t.p.n >= count) t.done();
}

/** Resets the streak of every `inARow` or `untouched` Trial. */
function breakStreaks(list: readonly Tracked[]): void {
  for (const { o, p } of list) if (o.kind === 'defeat' && (o.inARow || o.untouched)) p.n = 0;
}

function onDamageDealt(
  state: SimState,
  who: EntityId,
  e: Extract<SimEvent, { type: 'damageDealt' }>,
  list: readonly Tracked[],
): void {
  if (e.dst === who) {
    if (e.amount > 0) breakStreaks(list);
    return;
  }
  if (e.src !== who) return;
  const target = getComp(state.entities, e.dst, 'combatant');
  const dead = getComp(state.entities, e.dst, 'fighter')?.state === 'dead';
  for (const t of list) {
    const { o, p } = t;
    if (o.kind !== 'defeat') continue;
    const by = o.only;
    if (by && (by.weapon !== undefined ? e.tag !== by.weapon : e.tag !== by.element)) {
      p.bad = [...new Set([...(p.bad ?? []), e.dst])];
    }
    if (!dead) continue;
    if (o.phases && !o.phases.includes(dayPhase(state.worldTick))) continue;
    const tainted = p.bad?.includes(e.dst) ?? false;
    if (p.bad) p.bad = p.bad.filter((x) => x !== e.dst);
    if (tainted || (o.creature !== undefined && target?.kind !== o.creature)) continue;
    if (o.withinTicks !== undefined && p.n > 0 && state.tick - p.t0 > o.withinTicks) p.n = 0;
    if (p.n === 0) p.t0 = state.tick;
    p.n++;
    finish(t, o.count);
  }
}

function onGathered(
  state: SimState,
  e: Extract<SimEvent, { type: 'gathered' }>,
  list: readonly Tracked[],
): void {
  for (const t of list) {
    const { o, p } = t;
    if (o.kind !== 'gather') continue;
    if (o.item !== undefined && o.item !== e.item) continue;
    if (o.tag !== undefined && o.tag !== e.tag) continue;
    if (o.phases && !o.phases.includes(dayPhase(state.worldTick))) continue;
    p.n++;
    finish(t, o.count);
  }
}

/** A `perform` objective counts one action. `inOneFight` ones start over when a new fight begins. */
function perform(
  state: SimState,
  who: EntityId,
  list: readonly Tracked[],
  action: Objective<'perform'>['action'],
  attack?: string,
): void {
  for (const t of list) {
    const { o, p } = t;
    if (o.kind !== 'perform' || o.action !== action) continue;
    if (action === 'technique') {
      // A technique with no attack of its own (a song) counts when it finishes, not when it starts.
      if (o.technique && !TECHNIQUES[o.technique]?.attack) continue;
      const want = o.technique ? TECHNIQUES[o.technique]?.attack : undefined;
      if (want ? attack !== want : !attack?.startsWith('technique.')) continue;
    }
    if (o.inOneFight) {
      const f = fightId(state, who);
      if (p.t0 !== f) {
        p.n = 0;
        p.t0 = f;
      }
    }
    p.n++;
    finish(t, o.count);
  }
}

/**
 * Applies one sim event to a list of tracked objectives. Trials and requests both call this, so
 * the rules for what counts are written once.
 */
export function advanceTracked(
  state: SimState,
  who: EntityId,
  e: SimEvent,
  list: readonly Tracked[],
): void {
  switch (e.type) {
    case 'damageDealt':
      return onDamageDealt(state, who, e, list);
    case 'died':
      if (e.id === who) breakStreaks(list);
      return;
    case 'gathered':
      if (e.id === who) onGathered(state, e, list);
      return;
    case 'perfectDodge':
      if (e.id === who) perform(state, who, list, 'perfectDodge');
      return;
    case 'attackStarted':
      if (e.id === who) perform(state, who, list, 'technique', e.attack);
      return;
    case 'crafted':
      if (e.id !== who) return;
      for (const t of list) {
        const { o, p } = t;
        if (o.kind !== 'craft' || o.recipe !== e.recipe || e.quality < o.minQuality) continue;
        p.n = 1;
        finish(t, 1);
      }
      return;
    case 'parried':
      if (e.who === who) perform(state, who, list, 'parry');
      return;
    case 'haggleWon':
      if (e.who === who) perform(state, who, list, 'haggle');
      return;
    case 'sleptOutdoors':
      if (e.who === who) perform(state, who, list, 'sleepOutdoors');
      return;
    case 'manualRead':
      if (e.who === who) perform(state, who, list, 'readManual');
      return;
    case 'revealed':
      if (e.who !== who) return;
      for (const t of list) {
        const { o, p } = t;
        if (o.kind !== 'explore') continue;
        p.n += e.blocks;
        finish(t, o.blocks);
      }
      return;
    case 'creatureFed':
      if (e.who !== who) return;
      for (const t of list) {
        const { o, p } = t;
        if (o.kind !== 'feed' || (o.creature !== undefined && o.creature !== e.kind)) continue;
        p.n++;
        finish(t, o.count);
      }
      return;
    case 'techniqueUsed':
      // A self technique with no attack and no song to finish (Mend) counts when it is cast.
      if (e.who !== who) return;
      for (const t of list) {
        const { o, p } = t;
        if (o.kind !== 'perform' || o.action !== 'technique' || o.technique !== e.technique)
          continue;
        const tech = TECHNIQUES[o.technique];
        if (!tech || tech.attack || tech.channel) continue;
        p.n++;
        finish(t, o.count);
      }
      return;
    case 'perform':
      // A song finished. It counts for the objective that names it.
      if (e.who !== who) return;
      for (const t of list) {
        const { o, p } = t;
        if (o.kind !== 'perform' || o.action !== 'technique' || o.technique !== e.technique)
          continue;
        if (TECHNIQUES[o.technique]?.attack) continue;
        p.n++;
        finish(t, o.count);
      }
      return;
    default:
  }
}

/**
 * Applies one sim event to the Trials of `who`, if the acting source is manual.
 */
export function advanceTrials(
  state: SimState,
  who: EntityId,
  e: SimEvent,
  source: ActingSource = 'manual',
): void {
  if (source !== 'manual') return;
  advanceTracked(state, who, e, trialTrackers(state, who));
}

/** Gives the Trials a fixture offers when the avatar uses it. */
export function offerFromFixture(state: SimState, who: EntityId, kind: string): void {
  for (const def of Object.values(TRIALS))
    if ('fixture' in def.giver && def.giver.fixture === kind) offerTrial(state, who, def.id);
}

/**
 * Turns in the `deliver` objectives whose `to` is this person: takes the items if the bag holds
 * enough of the quality asked, and meets the objective. Called when a talk starts.
 */
export function deliverTracked(
  state: SimState,
  who: EntityId,
  npc: string,
  list: readonly Tracked[],
): void {
  const inv = getComp(state.entities, who, 'inventory');
  if (!inv) return;
  for (const t of list) {
    const o = t.o;
    if (o.kind !== 'deliver' || o.to !== npc || (t.live && !t.live())) continue;
    const have = inv.slots.reduce(
      (n, st) => n + (st && st.item === o.item && (st.q ?? 0) >= (o.minQuality ?? 0) ? st.qty : 0),
      0,
    );
    if (have < o.qty || countItem(inv, o.item) < o.qty) continue;
    removeItem(inv, o.item, o.qty);
    t.done();
  }
}

/** The `deliver` Trials whose `to` is this person. Called when a talk starts. */
export function deliverTrials(state: SimState, who: EntityId, npc: string): void {
  deliverTracked(state, who, npc, trialTrackers(state, who));
}

/** Reach objectives: the clock starts on touching the `from` fixture, and the room must follow in time. */
export function reachTracked(
  state: SimState,
  who: EntityId,
  events: readonly SimEvent[],
  list: readonly Tracked[],
): void {
  const pos = getComp(state.entities, who, 'pos');
  if (!pos) return;
  for (const t of list) {
    const { o, p } = t;
    if (o.kind !== 'reach') continue;
    if (p.t0 > 0 && state.tick - p.t0 > o.withinTicks) p.t0 = 0;
    if (p.t0 > 0) {
      if (events.some((e) => e.type === 'roomChanged' && e.who === who && e.to === o.room))
        t.done();
      continue;
    }
    for (const id of query(state.entities, 'fixture', 'pos')) {
      if (getComp(state.entities, id, 'fixture')?.kind !== o.from || !FIXTURES[o.from]) continue;
      const q = getComp(state.entities, id, 'pos');
      if (q && Math.hypot(q.x - pos.x, q.y - pos.y) / SUBPX <= TOUCH_PX) p.t0 = state.tick;
    }
  }
}

/** Once a tick, before skills. */
export function trialsSystem(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'skills')) {
    trackFight(state, who);
    const events = [...state.events.list];
    for (const e of events) advanceTrials(state, who, e, 'manual');
    reachTracked(state, who, events, trialTrackers(state, who));
  }
}
