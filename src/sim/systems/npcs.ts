import { REQUEST_BALANCE as RB } from '../../content/balance/requests';
import { DIALOGUES, SHOPS } from '../../content/dialogue';
import { REQUESTS } from '../../content/requests';
import type { Effect } from '../../content/dialogue/types';
import { countItem, give, learnRecipe, removeItem } from '../items';
import { learnTechnique } from '../combat/techniques';
import { hearRumor } from './map';
import { holds } from '../journal';
import { destroy, getComp, query, setComp, spawn, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { px } from '../kernel/fixed';
import { offerTrial } from '../skills';
import { addRenown } from '../renown';
import { onTalk, startRequest, turnIn } from './requests';
import { deliverTrials } from './trials';
import type { SimState } from '../state';
import { contextTarget } from './interact';
import { dayIndex } from '../time';
import { near, newNpc } from '../trade';

export { learnTechnique } from '../combat/techniques';
export { buy, buyback, haggle, mend, sell, shopPurse, tradeSystem } from '../trade';
export { buyPrice, sellPrice } from '../economy';

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
    onTalk(state, who, n.id);
    emit(state.events, { type: 'talkStarted', who, npc: n.id });
  }
}

export function applyEffect(state: SimState, who: EntityId, e: Effect): void {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return;
  if ('setFlag' in e) {
    if (!j.flags.includes(e.setFlag)) j.flags.push(e.setFlag);
  } else if ('give' in e) give(state, who, e.give, e.qty, 'dialogue');
  else if ('learnRecipe' in e) learnRecipe(state, who, e.learnRecipe);
  else if ('offerTrial' in e) offerTrial(state, who, e.offerTrial);
  else if ('startRequest' in e) {
    const def = REQUESTS[e.startRequest];
    if (def) startRequest(state, who, def);
  } else if ('turnIn' in e) turnIn(state, who, e.turnIn);
  else if ('learnTechnique' in e) learnTechnique(state, who, e.learnTechnique);
  else if ('openShop' in e && SHOPS[e.openShop])
    emit(state.events, { type: 'shopOpened', who, shop: e.openShop });
  else if ('renown' in e) addRenown(state, who, RB.homeRegion, e.renown);
  else if ('rumor' in e) hearRumor(state, who, e.rumor);
  else if ('takeItem' in e) {
    const inv = getComp(state.entities, who, 'inventory');
    if (inv && countItem(inv, e.takeItem) >= e.qty) removeItem(inv, e.takeItem, e.qty);
  }
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

/** Removes every NPC. For reloading a map. */
export function clearNpcs(state: SimState): void {
  for (const id of query(state.entities, 'npc')) destroy(state.entities, id);
}
