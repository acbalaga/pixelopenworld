import { DIALOGUES } from '../content/dialogue';
import type { DialogueNode, Effect } from '../content/dialogue/types';
import { REQUESTS } from '../content/requests';
import { TRIALS } from '../content/skills';
import { REQUEST_BALANCE as RB } from '../content/balance/requests';
import { holds, startNode } from './journal';
import { getComp, type EntityId } from './kernel/entities';
import { canOfferTrial } from './skills';
import type { SimState } from './state';
import { canStartRequest, requestDefOf } from './systems/requests';
import { carriedFor } from './systems/trials';

/**
 * Who has work for the avatar (POW-M4-22D). A person who would give a Trial or a request now is
 * an `offer`. A person waiting for something the avatar can hand in now is `ready`, and wins
 * when both apply. The walk follows the dialogue the way a player could, so a mark never lies.
 * Teaching, shops and flags alone never make a mark. No DOM, no clock, no random.
 */
export type GiverMark = 'offer' | 'ready';

/** Every node the avatar could reach from the start, with the effects met on the way. */
function reachable(state: SimState, who: EntityId, npc: string): { effects: Effect[] } {
  const d = DIALOGUES[npc];
  const out: Effect[] = [];
  const first = startNode(state, who, npc);
  if (!d || first === null) return { effects: out };
  const seen = new Set<string>();
  const visit = (id: string | null | undefined, depth: number): void => {
    if (!id || depth > RB.giverMarkDepth || seen.has(id)) return;
    const node: DialogueNode | undefined = d.nodes[id];
    if (!node) return;
    seen.add(id);
    out.push(...(node.do ?? []));
    visit(node.next, depth + 1);
    for (const c of node.choices ?? []) {
      if (!holds(state, who, c.if)) continue;
      out.push(...(c.do ?? []));
      visit(c.next, depth + 1);
    }
  };
  visit(first, 0);
  return { effects: out };
}

/** True when a Trial or request under way has a delivery to this person the bag satisfies now. */
function hasDeliveryReady(state: SimState, who: EntityId, npc: string): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  if (!inv) return false;
  const j = getComp(state.entities, who, 'journal');
  for (const [rid, rec] of Object.entries(j?.requests ?? {})) {
    const def = requestDefOf(rec, rid);
    if (!def || rec.state !== 'active') continue;
    for (const sol of def.solutions) {
      const o = sol.steps[rec.prog[sol.id]?.step ?? -1];
      if (o?.kind === 'deliver' && o.to === npc && carriedFor(inv, o) >= o.qty) return true;
    }
  }
  const sk = getComp(state.entities, who, 'skills');
  for (const id of sk?.offered ?? []) {
    const o = TRIALS[id]?.objective;
    if (o?.kind === 'deliver' && o.to === npc && carriedFor(inv, o) >= o.qty) return true;
  }
  return false;
}

/** The mark for one person, or null. */
export function giverMark(state: SimState, who: EntityId, npc: string): GiverMark | null {
  const { effects } = reachable(state, who, npc);
  const j = getComp(state.entities, who, 'journal');
  const ready =
    hasDeliveryReady(state, who, npc) ||
    effects.some((e) => 'turnIn' in e && j?.requests[e.turnIn]?.state === 'ready');
  if (ready) return 'ready';
  const offer = effects.some((e) => {
    if ('offerTrial' in e) return canOfferTrial(state, who, e.offerTrial);
    if ('startRequest' in e) {
      const def = REQUESTS[e.startRequest];
      return !!def && canStartRequest(state, who, def, { ignoreCap: true });
    }
    return false;
  });
  return offer ? 'offer' : null;
}

/** The marks for every person with a dialogue. */
export function giverMarks(state: SimState, who: EntityId): Map<string, GiverMark> {
  const out = new Map<string, GiverMark>();
  for (const npc of Object.keys(DIALOGUES)) {
    const m = giverMark(state, who, npc);
    if (m) out.set(npc, m);
  }
  return out;
}
