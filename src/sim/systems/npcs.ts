import { TECHNIQUES } from '../../content/combat/attacks';
import { DIALOGUES, REQUESTS, SHOPS } from '../../content/dialogue';
import type { Effect } from '../../content/dialogue/types';
import { give, learnRecipe } from '../items';
import { holds, requestState } from '../journal';
import { destroy, getComp, query, setComp, spawn, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { px } from '../kernel/fixed';
import { offerTrial } from '../skills';
import { deliverTrials } from './trials';
import type { SimState } from '../state';
import { contextTarget } from './interact';
import { dayIndex } from '../time';
import { near, newNpc } from '../trade';

export { buy, buyback, haggle, mend, sell, shopPurse, tradeSystem } from '../trade';
export { buyPrice, sellPrice } from '../economy';
import { earnCoin } from '../ledger';

const TILE = 16;

/** Places a person on a tile. They stand still; the dialogue is what they do. */
export function spawnNpc(state: SimState, id: string, tx: number, ty: number): EntityId {
  const e = spawn(state.entities);
  setComp(state.entities, e, 'pos', { x: px(tx * TILE + 8), y: px(ty * TILE + 14) });
  setComp(state.entities, e, 'npc', newNpc(id, dayIndex(state.worldTick)));
  setComp(state.entities, e, 'body', { w: px(12), h: px(8), solid: true });
  setComp(state.entities, e, 'interactable', { kind: id });
  return e;
}

/** The context button on a person: starts the talk. The UI reads `talkStarted`. */
export function interactNpc(state: SimState, who: EntityId): void {
  if (getComp(state.entities, who, 'fighter')?.state !== 'idle') return;
  const t = contextTarget(state, who);
  const n = t === null ? undefined : getComp(state.entities, t, 'npc');
  if (n) {
    deliverTrials(state, who, n.id);
    emit(state.events, { type: 'talkStarted', who, npc: n.id });
  }
}

function applyEffect(state: SimState, who: EntityId, e: Effect): void {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return;
  if ('setFlag' in e) {
    if (!j.flags.includes(e.setFlag)) j.flags.push(e.setFlag);
  } else if ('give' in e) give(state, who, e.give, e.qty, 'dialogue');
  else if ('learnRecipe' in e) learnRecipe(state, who, e.learnRecipe);
  else if ('offerTrial' in e) offerTrial(state, who, e.offerTrial);
  else if ('startRequest' in e) {
    if (REQUESTS[e.startRequest] && requestState(j, e.startRequest) === 'none') {
      j.requests[e.startRequest] = { state: 'active', progress: 0 };
      emit(state.events, { type: 'requestStarted', who, request: e.startRequest });
    }
  } else if ('turnIn' in e) turnIn(state, who, e.turnIn);
  else if ('learnTechnique' in e) learnTechnique(state, who, e.learnTechnique);
  else if ('openShop' in e && SHOPS[e.openShop])
    emit(state.events, { type: 'shopOpened', who, shop: e.openShop });
}

/** Teaches a technique: it takes the first free slot after the weapon's lunge. Known ones are skipped. */
export function learnTechnique(state: SimState, who: EntityId, technique: string): void {
  const f = getComp(state.entities, who, 'fighter');
  if (!f || !TECHNIQUES[technique] || f.slots.includes(technique)) return;
  const free = f.slots.findIndex((s, i) => i > 0 && s === null);
  if (free < 0) return;
  f.slots[free] = technique;
  emit(state.events, { type: 'techniqueLearned', who, technique });
}

/** Pays a finished request, once. */
function turnIn(state: SimState, who: EntityId, requestId: string): void {
  const j = getComp(state.entities, who, 'journal');
  const a = getComp(state.entities, who, 'avatar');
  const def = REQUESTS[requestId];
  if (!j || !a || !def || requestState(j, requestId) !== 'ready') return;
  j.requests[requestId] = { state: 'done', progress: def.goal.count };
  earnCoin(state, who, def.reward.coin, 'request');
  for (const r of def.reward.items) give(state, who, r.item, r.qty, 'request');
  for (const t of def.reward.techniques ?? []) learnTechnique(state, who, t);
  emit(state.events, { type: 'requestCompleted', who, request: requestId });
}

/** A talk command. Only real nodes and real, currently allowed choices do anything. */
export function talk(
  state: SimState,
  who: EntityId,
  c: { npc: string; node: string; choice: number },
): void {
  const d = DIALOGUES[c.npc];
  const node = d?.nodes[c.node];
  if (!d || !node || !near(state, who, c.npc)) return;
  if (c.choice === -1) {
    for (const e of node.do ?? []) applyEffect(state, who, e);
    return;
  }
  const choice = node.choices?.[c.choice];
  if (!choice || !holds(state, who, choice.if)) return;
  for (const e of choice.do ?? []) applyEffect(state, who, e);
}

/** Counts kills toward active requests and marks them ready. Runs after combat. */
export function requestsSystem(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'journal')) {
    const j = getComp(state.entities, who, 'journal');
    if (!j) continue;
    for (const ev of state.events.list) {
      if (ev.type !== 'died' || ev.team !== 1) continue;
      // Credit a kill when the avatar landed a blow on it this tick.
      const hit = state.events.list.some(
        (x) => x.type === 'damageDealt' && x.dst === ev.id && x.src === who,
      );
      const kind = getComp(state.entities, ev.id, 'combatant')?.kind;
      if (!hit || !kind) continue;
      for (const [rid, r] of Object.entries(j.requests)) {
        const def = REQUESTS[rid];
        if (!def || r.state !== 'active' || def.goal.kill !== kind) continue;
        r.progress = Math.min(def.goal.count, r.progress + 1);
        emit(state.events, { type: 'requestProgress', who, request: rid, progress: r.progress });
        if (r.progress >= def.goal.count) {
          r.state = 'ready';
          emit(state.events, { type: 'requestReady', who, request: rid });
        }
      }
    }
  }
}

/** Removes every NPC. For reloading a map. */
export function clearNpcs(state: SimState): void {
  for (const id of query(state.entities, 'npc')) destroy(state.entities, id);
}
