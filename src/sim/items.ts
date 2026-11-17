import { ITEMS_BALANCE as B } from '../content/balance/items';
import { WEAPONS } from '../content/combat/attacks';
import { ITEMS } from '../content/items';
import { NODES, RECIPES, recipeFor } from '../content/items/recipes';
import { EQUIP_SLOTS, type EquipSlot } from '../content/items/types';
import type { DropDef } from '../content/creatures/types';
import { destroy, getComp, setComp, spawn, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import type { Command } from './kernel/commands';
import { SUBPX } from './kernel/fixed';
import { int, next, weighted, type Rng } from './kernel/rng';
import { recomputePools } from './skills';
import type { Inventory, ItemStack, SimState } from './state';
import { contextTarget } from './systems/interact';

/** A new bag, with the starter kit worn and carried. */
export function newInventory(): Inventory {
  const inv: Inventory = {
    slots: Array.from({ length: B.inventory.slots }, () => null),
    equipment: { main: null, off: null, head: null, body: null, legs: null, accessory: null },
    recipes: [],
  };
  for (const [slot, item] of Object.entries(B.starter.equipment))
    if ((EQUIP_SLOTS as readonly string[]).includes(slot)) inv.equipment[slot as EquipSlot] = item;
  for (const s of B.starter.bag) addItem(inv, s.item, s.qty);
  return inv;
}

/** Most of an item that fits in one slot. 0 for an unknown item. */
export function stackSize(item: string): number {
  return ITEMS[item]?.stack ?? 0;
}

/**
 * Adds to the bag: tops up existing stacks first, then fills empty slots from the first.
 * Returns how many did not fit.
 */
export function addItem(inv: Inventory, item: string, qty: number): number {
  const max = stackSize(item);
  if (max === 0 || qty <= 0) return Math.max(0, qty);
  let left = qty;
  for (const s of inv.slots) {
    if (left === 0) break;
    if (s && s.item === item && s.qty < max) {
      const put = Math.min(max - s.qty, left);
      s.qty += put;
      left -= put;
    }
  }
  for (let i = 0; i < inv.slots.length && left > 0; i++) {
    if (inv.slots[i] !== null) continue;
    const put = Math.min(max, left);
    inv.slots[i] = { item, qty: put };
    left -= put;
  }
  return left;
}

/** How many of an item are in the bag. */
export function countItem(inv: Inventory, item: string): number {
  let n = 0;
  for (const s of inv.slots) if (s && s.item === item) n += s.qty;
  return n;
}

/** True if the whole of `qty` would fit. */
export function canHold(inv: Inventory, item: string, qty = 1): boolean {
  const max = stackSize(item);
  if (max === 0) return false;
  let room = 0;
  for (const s of inv.slots) {
    if (s === null) room += max;
    else if (s.item === item) room += max - s.qty;
    if (room >= qty) return true;
  }
  return false;
}

/** Takes `qty` of an item from the bag, emptiest stacks first. False (and nothing taken) if short. */
export function removeItem(inv: Inventory, item: string, qty: number): boolean {
  if (countItem(inv, item) < qty) return false;
  let left = qty;
  const order = inv.slots
    .map((s, i) => ({ s, i }))
    .filter((e): e is { s: ItemStack; i: number } => e.s !== null && e.s.item === item)
    .sort((a, b) => a.s.qty - b.s.qty || a.i - b.i);
  for (const { s, i } of order) {
    if (left === 0) break;
    const take = Math.min(s.qty, left);
    s.qty -= take;
    left -= take;
    if (s.qty === 0) inv.slots[i] = null;
  }
  return true;
}

/** What one drop table gives on one roll. Items rolled in table order from the loot stream. */
export function rollDrops(rng: Rng, drops: readonly DropDef[]): { item: string; qty: number }[] {
  const out: { item: string; qty: number }[] = [];
  for (const d of drops) {
    if (next(rng) * 100 >= d.chance) continue;
    out.push({ item: d.item, qty: int(rng, d.min, d.max) });
  }
  return out;
}

/** Leaves an item lying at a feet position (sub-pixel units). It pops out for a few ticks. */
export function spawnPickup(
  state: SimState,
  item: string,
  qty: number,
  x: number,
  y: number,
): EntityId {
  const id = spawn(state.entities);
  setComp(state.entities, id, 'pos', { x, y });
  setComp(state.entities, id, 'pickup', { item, qty, age: 0, blocked: false });
  emit(state.events, { type: 'lootDropped', id, item, qty });
  return id;
}

/** A gathering node standing at a feet position in whole px. */
export function spawnNode(state: SimState, kind: string, xPx: number, yPx: number): EntityId {
  if (!NODES[kind]) throw new Error(`unknown node ${kind}`);
  const id = spawn(state.entities);
  setComp(state.entities, id, 'pos', { x: xPx * SUBPX, y: yPx * SUBPX });
  setComp(state.entities, id, 'interactable', { kind });
  setComp(state.entities, id, 'node', { kind, readyAt: 0 });
  return id;
}

/** A camp pot at a feet position in whole px. Cook here. */
export function spawnCampPot(state: SimState, xPx: number, yPx: number): EntityId {
  const id = spawn(state.entities);
  setComp(state.entities, id, 'pos', { x: xPx * SUBPX, y: yPx * SUBPX });
  setComp(state.entities, id, 'interactable', { kind: 'camp_pot' });
  return id;
}

/** Sets the weapon, power and defense from what is worn. */
export function recomputeGear(state: SimState, who: EntityId): void {
  const inv = getComp(state.entities, who, 'inventory');
  const cb = getComp(state.entities, who, 'combatant');
  if (!inv || !cb) return;
  let defense = 0;
  // Nothing in the main hand means bare hands.
  cb.weapon = 'fists';
  cb.power = WEAPONS.fists?.power ?? cb.power;
  for (const slot of EQUIP_SLOTS) {
    const def = ITEMS[inv.equipment[slot] ?? '']?.equip;
    if (!def) continue;
    defense += def.defense ?? 0;
    if (slot === 'main' && def.weapon && WEAPONS[def.weapon]) {
      cb.weapon = def.weapon;
      cb.power = def.power ?? WEAPONS[def.weapon]?.power ?? cb.power;
    }
  }
  cb.defense = defense;
}

/** Only while standing free of a fight move or a swing. */
function idle(state: SimState, who: EntityId): boolean {
  return getComp(state.entities, who, 'fighter')?.state === 'idle';
}

function feet(state: SimState, who: EntityId): { x: number; y: number } {
  const p = getComp(state.entities, who, 'pos');
  return { x: p?.x ?? 0, y: p?.y ?? 0 };
}

/** Puts an item in the bag. Whatever does not fit is left at the avatar's feet, never lost. */
export function give(state: SimState, who: EntityId, item: string, qty: number): void {
  const inv = getComp(state.entities, who, 'inventory');
  if (!inv) return;
  const left = addItem(inv, item, qty);
  if (left > 0) {
    const f = feet(state, who);
    spawnPickup(state, item, left, f.x, f.y);
    emit(state.events, { type: 'bagFull', id: who, item });
  }
}

/** Wears the gear in a bag slot. What it replaces goes back in that slot. */
export function equip(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const stack = inv?.slots[slot];
  const def = stack ? ITEMS[stack.item]?.equip : undefined;
  if (!inv || !stack || !def || !idle(state, who)) return false;
  const old = inv.equipment[def.slot];
  inv.equipment[def.slot] = stack.item;
  inv.slots[slot] = old ? { item: old, qty: 1 } : null;
  recomputeGear(state, who);
  emit(state.events, { type: 'equipped', id: who, slot: def.slot, item: stack.item });
  return true;
}

/** Takes worn gear off into the bag. An empty main hand fights with bare hands. */
export function unequip(state: SimState, who: EntityId, slot: EquipSlot): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const worn = inv?.equipment[slot];
  if (!inv || !worn || !idle(state, who)) return false;
  if (!canHold(inv, worn)) {
    emit(state.events, { type: 'bagFull', id: who, item: worn });
    return false;
  }
  addItem(inv, worn, 1);
  inv.equipment[slot] = null;
  recomputeGear(state, who);
  emit(state.events, { type: 'unequipped', id: who, slot, item: worn });
  return true;
}

/** Drops a whole bag slot at the avatar's feet. It cannot be picked up again for a moment. */
export function dropFromBag(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const stack = inv?.slots[slot];
  if (!inv || !stack || getComp(state.entities, who, 'fighter')?.state === 'dead') return false;
  inv.slots[slot] = null;
  const f = feet(state, who);
  const id = spawnPickup(state, stack.item, stack.qty, f.x, f.y);
  const pk = getComp(state.entities, id, 'pickup');
  if (pk) pk.age = -B.loot.dropGraceTicks;
  return true;
}

/** Eats food from a bag slot: restores pools and starts a Fed buff that replaces any other. */
export function eat(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const pools = getComp(state.entities, who, 'pools');
  const stack = inv?.slots[slot];
  const food = stack ? ITEMS[stack.item]?.food : undefined;
  if (!inv || !pools || !stack || !food) return false;
  if (getComp(state.entities, who, 'fighter')?.state === 'dead') return false;
  const item = stack.item;
  stack.qty--;
  if (stack.qty === 0) inv.slots[slot] = null;
  pools.hp = Math.min(pools.hpMax, pools.hp + food.hp);
  pools.sta = Math.min(pools.staMax, pools.sta + food.sta);
  pools.foc = Math.min(pools.focMax, pools.foc + food.foc);
  emit(state.events, { type: 'eaten', id: who, item });
  if (food.fed) {
    const old = getComp(state.entities, who, 'fed');
    setComp(state.entities, who, 'fed', {
      item,
      until: state.tick + food.fed.ticks,
      hpMax: food.fed.hpMax,
      staMax: food.fed.staMax,
      focMax: food.fed.focMax,
    });
    recomputePools(state, who);
    emit(state.events, { type: 'fedStarted', id: who, item, replaced: old?.item ?? null });
  }
  return true;
}

/**
 * Cooks at the camp pot in front. Takes the ingredients, then makes the matching recipe or a
 * burnt mess. The first cook of a recipe the avatar does not know is a discovery: it is then
 * known for good. Returns false, taking nothing, if there is no pot or the bag is short.
 */
export function cook(state: SimState, who: EntityId, items: readonly string[]): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const target = contextTarget(state, who);
  const pot = target === null ? null : getComp(state.entities, target, 'interactable');
  if (!inv || pot?.kind !== 'camp_pot' || !idle(state, who)) return false;
  const need = new Map<string, number>();
  for (const i of items) need.set(i, (need.get(i) ?? 0) + 1);
  for (const [i, n] of need) if (countItem(inv, i) < n) return false;
  for (const [i, n] of need) removeItem(inv, i, n);
  const recipe = recipeFor(items);
  if (!recipe) {
    give(state, who, 'item.burnt_mess', 1);
    emit(state.events, { type: 'cookFailed', id: who });
    return true;
  }
  if (!inv.recipes.includes(recipe.id)) {
    inv.recipes.push(recipe.id);
    emit(state.events, { type: 'recipeDiscovered', id: who, recipe: recipe.id });
  }
  give(state, who, recipe.result, 1);
  emit(state.events, {
    type: 'cooked',
    id: who,
    tag: 'cooking',
    recipe: recipe.id,
    tier: recipe.tier,
  });
  return true;
}

/** Teaches a recipe, for example from an NPC. Returns false if already known or unknown. */
export function learnRecipe(state: SimState, who: EntityId, recipeId: string): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  if (!inv || !RECIPES[recipeId] || inv.recipes.includes(recipeId)) return false;
  inv.recipes.push(recipeId);
  return true;
}

/** Ends a gather: picks the yield, pays it, and starts the node's respawn. */
export function resolveGather(state: SimState, who: EntityId, sweet: boolean): void {
  const g = getComp(state.entities, who, 'gather');
  const node = g ? getComp(state.entities, g.node, 'node') : null;
  const def = node ? NODES[node.kind] : undefined;
  state.entities.comps.gather[who] = null;
  if (!g || !node || !def) return;
  const item = weighted(
    state.rng.loot,
    def.yields.map((y) => [y.item, y.weight] as const),
  );
  const qty =
    int(state.rng.loot, B.gather.baseMin, B.gather.baseMax) + (sweet ? B.gather.sweetBonus : 0);
  node.readyAt = state.tick + def.respawn;
  emit(state.events, { type: 'gatherResolved', id: who, node: g.node, sweet, item, qty });
  give(state, who, item, qty);
  emit(state.events, { type: 'gathered', id: who, tag: def.tag, item, tier: def.tier });
}

/** The context button: starts a gather on a ready node, or lands the timing press. */
function interact(state: SimState, who: EntityId): void {
  const g = getComp(state.entities, who, 'gather');
  if (g) {
    resolveGather(state, who, g.t >= B.gather.sweetFrom && g.t <= B.gather.sweetTo);
    return;
  }
  if (!idle(state, who)) return;
  const target = contextTarget(state, who);
  const node = target === null ? null : getComp(state.entities, target, 'node');
  if (target === null || !node || state.tick < node.readyAt) return;
  setComp(state.entities, who, 'gather', { node: target, t: 0 });
  emit(state.events, { type: 'gatherStarted', id: who, node: target });
}

/** Applies an item command to the avatar `who`. */
export function applyItemCommand(state: SimState, who: EntityId, c: Command): void {
  switch (c.type) {
    case 'interact':
      return interact(state, who);
    case 'equip':
      equip(state, who, c.slot);
      return;
    case 'unequip':
      unequip(state, who, c.slot as EquipSlot);
      return;
    case 'use':
      eat(state, who, c.slot);
      return;
    case 'drop':
      dropFromBag(state, who, c.slot);
      return;
    case 'cook':
      cook(state, who, c.items);
      return;
    default:
  }
}

/** Takes a pickup into the bag. Returns true if it was all taken. */
export function collect(state: SimState, who: EntityId, pickupId: EntityId): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const a = getComp(state.entities, who, 'avatar');
  const p = getComp(state.entities, pickupId, 'pickup');
  if (!inv || !a || !p) return false;
  if (p.item === 'item.coin') {
    a.coin += p.qty;
    emit(state.events, { type: 'itemPickedUp', id: who, item: p.item, qty: p.qty });
    destroy(state.entities, pickupId);
    return true;
  }
  const left = addItem(inv, p.item, p.qty);
  const took = p.qty - left;
  if (took > 0) emit(state.events, { type: 'itemPickedUp', id: who, item: p.item, qty: took });
  if (left === 0) {
    destroy(state.entities, pickupId);
    return true;
  }
  p.qty = left;
  if (!p.blocked) {
    p.blocked = true;
    emit(state.events, { type: 'bagFull', id: who, item: p.item });
  }
  return false;
}
