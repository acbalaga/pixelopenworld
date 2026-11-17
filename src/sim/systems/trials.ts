import { TECHNIQUES } from '../../content/combat/attacks';
import { FIXTURES } from '../../content/world/fixtures';
import { TRIALS } from '../../content/skills';
import type { TrialDef, TrialObjective } from '../../content/skills/types';
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

/** The Trials that are offered to `who` and not passed, with their progress records. */
function active(state: SimState, who: EntityId): { def: TrialDef; p: TrialProgress }[] {
  const s = getComp(state.entities, who, 'skills');
  if (!s) return [];
  const out: { def: TrialDef; p: TrialProgress }[] = [];
  for (const id of [...s.offered].sort()) {
    const def = TRIALS[id];
    if (!def) continue;
    out.push({ def, p: (s.trial[id] ??= { n: 0, t0: 0 }) });
  }
  return out;
}

function finish(
  state: SimState,
  who: EntityId,
  def: TrialDef,
  p: TrialProgress,
  count: number,
): void {
  if (p.n >= count) passTrial(state, who, def.id);
}

/** Resets the streak of every `inARow` or `untouched` Trial. */
function breakStreaks(state: SimState, who: EntityId): void {
  for (const { def, p } of active(state, who)) {
    const o = def.objective;
    if (o.kind === 'defeat' && (o.inARow || o.untouched)) p.n = 0;
  }
}

function onDamageDealt(
  state: SimState,
  who: EntityId,
  e: Extract<SimEvent, { type: 'damageDealt' }>,
): void {
  if (e.dst === who) {
    if (e.amount > 0) breakStreaks(state, who);
    return;
  }
  if (e.src !== who) return;
  const target = getComp(state.entities, e.dst, 'combatant');
  const dead = getComp(state.entities, e.dst, 'fighter')?.state === 'dead';
  for (const { def, p } of active(state, who)) {
    const o = def.objective;
    if (o.kind !== 'defeat') continue;
    const by = o.only;
    if (by && (by.weapon !== undefined ? e.tag !== by.weapon : e.tag !== by.element)) {
      p.bad = [...new Set([...(p.bad ?? []), e.dst])];
    }
    if (!dead) continue;
    const tainted = p.bad?.includes(e.dst) ?? false;
    if (p.bad) p.bad = p.bad.filter((x) => x !== e.dst);
    if (tainted || (o.creature !== undefined && target?.kind !== o.creature)) continue;
    if (o.withinTicks !== undefined && p.n > 0 && state.tick - p.t0 > o.withinTicks) p.n = 0;
    if (p.n === 0) p.t0 = state.tick;
    p.n++;
    finish(state, who, def, p, o.count);
  }
}

function onGathered(
  state: SimState,
  who: EntityId,
  e: Extract<SimEvent, { type: 'gathered' }>,
): void {
  for (const { def, p } of active(state, who)) {
    const o = def.objective as TrialObjective;
    if (o.kind !== 'gather') continue;
    if (o.item !== undefined && o.item !== e.item) continue;
    if (o.tag !== undefined && o.tag !== e.tag) continue;
    if (o.phases && !o.phases.includes(dayPhase(state.worldTick))) continue;
    p.n++;
    finish(state, who, def, p, o.count);
  }
}

/** A `perform` Trial counts one action. `inOneFight` ones start over when a new fight begins. */
function perform(
  state: SimState,
  who: EntityId,
  action: Objective<'perform'>['action'],
  attack?: string,
): void {
  for (const { def, p } of active(state, who)) {
    const o = def.objective;
    if (o.kind !== 'perform' || o.action !== action) continue;
    if (action === 'technique') {
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
    finish(state, who, def, p, o.count);
  }
}

/**
 * Applies one sim event to the Trials of `who`, if the acting source is manual. Craft quality is carried by the craft events of M3-07, so until then a
 * craft counts at Common.
 */
export function advanceTrials(
  state: SimState,
  who: EntityId,
  e: SimEvent,
  source: ActingSource = 'manual',
): void {
  if (source !== 'manual') return;
  switch (e.type) {
    case 'damageDealt':
      return onDamageDealt(state, who, e);
    case 'died':
      if (e.id === who) breakStreaks(state, who);
      return;
    case 'gathered':
      if (e.id === who) onGathered(state, who, e);
      return;
    case 'perfectDodge':
      if (e.id === who) perform(state, who, 'perfectDodge');
      return;
    case 'attackStarted':
      if (e.id === who) perform(state, who, 'technique', e.attack);
      return;
    case 'cooked':
      if (e.id !== who) return;
      for (const { def, p } of active(state, who)) {
        const o = def.objective;
        if (o.kind !== 'craft' || o.recipe !== e.recipe || o.minQuality > 0) continue;
        p.n = 1;
        finish(state, who, def, p, 1);
      }
      return;
    case 'parried':
      if (e.who === who) perform(state, who, 'parry');
      return;
    default:
  }
}

/** Gives the Trials a fixture offers when the avatar uses it. */
export function offerFromFixture(state: SimState, who: EntityId, kind: string): void {
  for (const def of Object.values(TRIALS))
    if ('fixture' in def.giver && def.giver.fixture === kind) offerTrial(state, who, def.id);
}

/**
 * Turns in the `deliver` Trials whose `to` is this person: takes the items if the bag holds
 * enough of the quality asked, and passes the Trial. Called when a talk starts.
 */
export function deliverTrials(state: SimState, who: EntityId, npc: string): void {
  const inv = getComp(state.entities, who, 'inventory');
  if (!inv) return;
  for (const { def } of active(state, who)) {
    const o = def.objective;
    if (o.kind !== 'deliver' || o.to !== npc) continue;
    const have = inv.slots.reduce(
      (n, st) => n + (st && st.item === o.item && (st.q ?? 0) >= (o.minQuality ?? 0) ? st.qty : 0),
      0,
    );
    if (have < o.qty || countItem(inv, o.item) < o.qty) continue;
    removeItem(inv, o.item, o.qty);
    passTrial(state, who, def.id);
  }
}

/** Reach Trials: the clock starts on touching the `from` fixture, and the room must follow in time. */
function reachClock(state: SimState, who: EntityId, events: readonly SimEvent[]): void {
  const pos = getComp(state.entities, who, 'pos');
  if (!pos) return;
  for (const { def, p } of active(state, who)) {
    const o = def.objective;
    if (o.kind !== 'reach') continue;
    if (p.t0 > 0 && state.tick - p.t0 > o.withinTicks) p.t0 = 0;
    if (p.t0 > 0) {
      if (events.some((e) => e.type === 'roomChanged' && e.who === who && e.to === o.room))
        passTrial(state, who, def.id);
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
    reachClock(state, who, events);
  }
}
