import { ITEMS_BALANCE as B } from '../content/balance/items';
import { WEAPONS } from '../content/combat/attacks';
import { ITEMS } from '../content/items';
import type { StatusId } from '../content/combat/statuses';
import { NODES, RECIPES } from '../content/items/recipes';
import { EQUIP_SLOTS, type EquipSlot, type ItemDef, type Quality } from '../content/items/types';
import type { DropDef } from '../content/creatures/types';
import { destroy, getComp, query, setComp, spawn, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import type { Command } from './kernel/commands';
import { SUBPX } from './kernel/fixed';
import { hasShield } from './combat/guard';
import { learnedFlag, syncSignature } from './combat/knowledge';
import { learnTechnique } from './combat/techniques';
import { int, next, type Rng } from './kernel/rng';
import { recomputePools } from './skills';
import { applyStatus, clearStatus, statusesOf } from './statuses';
import { useGadget } from './gadgets';
import type { Inventory, ItemStack, SimState, Storage } from './state';
import { activeMods, applyMods, modPct, stackMods } from './mods';
import { contextTarget } from './systems/interact';
import { pressGather, startGather } from './gathering';
import { crafting, holdStep, repair, startCraft, tapStep, tracePoint } from './crafting';
import { STATIONS } from '../content/items/stations';
import { FIXTURES } from '../content/world/fixtures';
import { earnCoin, madeItems, type ItemSource } from './ledger';

/** What a stack can carry besides its item and count. */
export interface StackExtra {
  q?: Quality;
  mark?: 1;
  affixes?: string[];
}

/**
 * A stack of `qty`. Gear and tools start with full durability. Quality 0 (Common) and an empty
 * affix list are left off, so every stack has one canonical shape and merge checks stay simple.
 */
export function newStack(item: string, qty: number, extra: StackExtra = {}): ItemStack {
  const def = ITEMS[item];
  const s: ItemStack = { item, qty };
  if (extra.q) s.q = extra.q;
  if (def?.durability !== undefined) s.dur = def.durability;
  if (extra.mark) s.mark = 1;
  if (extra.affixes && extra.affixes.length > 0) s.affixes = [...extra.affixes];
  return s;
}

/** The part of a stack that is not its item or count, to carry it from one place to another. */
export function extraOf(s: ItemStack): StackExtra {
  const out: StackExtra = {};
  if (s.q) out.q = s.q;
  if (s.mark) out.mark = 1;
  if (s.affixes && s.affixes.length > 0) out.affixes = [...s.affixes];
  return out;
}

/** Two stacks merge only if every field except `qty` is equal. */
export function sameStack(a: ItemStack, b: ItemStack): boolean {
  return (
    a.item === b.item &&
    (a.q ?? 0) === (b.q ?? 0) &&
    a.dur === b.dur &&
    (a.mark ?? 0) === (b.mark ?? 0) &&
    (a.affixes ?? []).join(',') === (b.affixes ?? []).join(',')
  );
}

/** A new bag, with the starter kit worn and carried. */
export function newInventory(): Inventory {
  const inv: Inventory = {
    slots: Array.from({ length: B.inventory.slots }, () => null),
    equipment: { main: null, off: null, head: null, body: null, legs: null, accessory: null },
    // The recipes a new avatar already knows (learn: 'start').
    recipes: Object.values(RECIPES)
      .filter((r) => r.learn === 'start')
      .map((r) => r.id),
    wear: { hits: 0, taken: 0, uses: 0 },
  };
  for (const [slot, item] of Object.entries(B.starter.equipment))
    if ((EQUIP_SLOTS as readonly string[]).includes(slot))
      inv.equipment[slot as EquipSlot] = newStack(item, 1);
  for (const s of B.starter.bag) addItem(inv, s.item, s.qty);
  return inv;
}

/** An empty storage chest. */
export function newStorage(): Storage {
  return { slots: Array.from({ length: B.storage.slots }, () => null) };
}

/** Most of an item that fits in one slot. 0 for an unknown item. */
export function stackSize(item: string): number {
  return ITEMS[item]?.stack ?? 0;
}

/**
 * Adds a stack to a slot list: tops up equal stacks first, then fills empty slots from the first.
 * Returns how many did not fit. A stack with durability never merges, so it takes its own slot.
 */
export function addStack(slots: (ItemStack | null)[], add: ItemStack): number {
  const max = stackSize(add.item);
  if (max === 0 || add.qty <= 0) return Math.max(0, add.qty);
  let left = add.qty;
  for (const s of slots) {
    if (left === 0) break;
    if (s && s.qty < max && sameStack(s, add)) {
      const put = Math.min(max - s.qty, left);
      s.qty += put;
      left -= put;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i] !== null) continue;
    const put = Math.min(max, left);
    slots[i] = { ...add, qty: put, ...(add.affixes ? { affixes: [...add.affixes] } : {}) };
    left -= put;
  }
  return left;
}

/**
 * Adds to the bag: tops up existing stacks first, then fills empty slots from the first.
 * Returns how many did not fit.
 */
export function addItem(inv: Inventory, item: string, qty: number, extra: StackExtra = {}): number {
  return addStack(inv.slots, newStack(item, qty, extra));
}

/** How many of an item are in the bag, of any quality. */
export function countItem(inv: Inventory, item: string): number {
  let n = 0;
  for (const s of inv.slots) if (s && s.item === item) n += s.qty;
  return n;
}

/** True if the whole of `qty` of a plain stack of `item` would fit. */
export function canHold(
  inv: Inventory | Storage,
  item: string,
  qty = 1,
  extra?: StackExtra,
): boolean {
  const max = stackSize(item);
  if (max === 0) return false;
  const probe = newStack(item, 1, extra);
  let room = 0;
  for (const s of inv.slots) {
    if (s === null) room += max;
    else if (s.qty < max && sameStack(s, probe)) room += max - s.qty;
    if (room >= qty) return true;
  }
  return false;
}

/**
 * Takes `qty` of an item from the bag. Lowest quality goes first, then the emptiest stack. False
 * (and nothing taken) if short.
 */
export function removeItem(inv: Inventory, item: string, qty: number): boolean {
  if (countItem(inv, item) < qty) return false;
  let left = qty;
  const order = inv.slots
    .map((s, i) => ({ s, i }))
    .filter((e): e is { s: ItemStack; i: number } => e.s !== null && e.s.item === item)
    .sort((a, b) => (a.s.q ?? 0) - (b.s.q ?? 0) || a.s.qty - b.s.qty || a.i - b.i);
  for (const { s, i } of order) {
    if (left === 0) break;
    const take = Math.min(s.qty, left);
    s.qty -= take;
    left -= take;
    if (s.qty === 0) inv.slots[i] = null;
  }
  return true;
}

/** True if an item has no durability left. Items that do not wear are never broken. */
export function isBroken(stack: ItemStack): boolean {
  const max = ITEMS[stack.item]?.durability;
  return max !== undefined && (stack.dur ?? max) <= 0;
}

/**
 * Power and defense of one piece of gear (design/05). The base is multiplied by the quality
 * percent, and by the broken percent at 0 durability. The item's own affixes then change it
 * through `applyMods`, the one path every bonus takes.
 */
export function gearStats(def: ItemDef, stack: ItemStack): { power: number; defense: number } {
  const e = def.equip;
  if (!e) return { power: 0, defense: 0 };
  const q = B.qualityPct[stack.q ?? 0] ?? 100;
  const broken = isBroken(stack) ? B.brokenPct : 100;
  const scale = (base: number): number => Math.floor((base * q * broken) / 10_000);
  const mods = stackMods(stack);
  const basePower = e.power ?? (e.weapon ? (WEAPONS[e.weapon]?.power ?? 0) : 0);
  return {
    power: basePower > 0 ? applyMods(scale(basePower), 'power', mods) : 0,
    defense: applyMods(scale(e.defense ?? 0), 'defense', mods),
  };
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
  stack?: ItemStack,
): EntityId {
  const id = spawn(state.entities);
  setComp(state.entities, id, 'pos', { x, y });
  setComp(state.entities, id, 'pickup', {
    item,
    qty,
    age: 0,
    blocked: false,
    ...(stack ? { stack: { ...stack, qty: 1 } } : {}),
  });
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

/** Sets the weapon, power and defense from what is worn, and the pool maxima its affixes change. */
export function recomputeGear(state: SimState, who: EntityId): void {
  const inv = getComp(state.entities, who, 'inventory');
  const cb = getComp(state.entities, who, 'combatant');
  if (!inv || !cb) return;
  let defense = 0;
  // Nothing in the main hand means bare hands.
  cb.weapon = 'fists';
  cb.power = WEAPONS.fists?.power ?? cb.power;
  for (const slot of EQUIP_SLOTS) {
    const stack = inv.equipment[slot];
    const def = stack ? ITEMS[stack.item] : undefined;
    if (!stack || !def?.equip) continue;
    const stats = gearStats(def, stack);
    defense += stats.defense;
    if (slot === 'main' && def.equip.weapon && WEAPONS[def.equip.weapon]) {
      cb.weapon = def.equip.weapon;
      cb.power = stats.power || cb.power;
    }
  }
  cb.defense = defense;
  // Slot 1 is the band 0 technique of whatever is held, once it is known (M4-15).
  const fighter = getComp(state.entities, who, 'fighter');
  if (fighter) syncSignature(state, who);
  // No shield, no guard.
  if (fighter && !hasShield(state, who)) fighter.guard = false;
  recomputePools(state, who);
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
export function give(
  state: SimState,
  who: EntityId,
  item: string,
  qty: number,
  source: ItemSource,
  extra: StackExtra = {},
): void {
  const inv = getComp(state.entities, who, 'inventory');
  if (!inv) return;
  madeItems(state, source, item, qty);
  const left = addItem(inv, item, qty, extra);
  if (left > 0) {
    const f = feet(state, who);
    spawnPickup(state, item, left, f.x, f.y, newStack(item, 1, extra));
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
  inv.equipment[def.slot] = { ...stack, qty: 1 };
  inv.slots[slot] = old;
  recomputeGear(state, who);
  emit(state.events, { type: 'equipped', id: who, slot: def.slot, item: stack.item });
  return true;
}

/** Takes worn gear off into the bag. An empty main hand fights with bare hands. */
export function unequip(state: SimState, who: EntityId, slot: EquipSlot): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const worn = inv?.equipment[slot];
  if (!inv || !worn || !idle(state, who)) return false;
  if (!canHold(inv, worn.item, 1, extraOf(worn)) && inv.slots.every((s) => s !== null)) {
    emit(state.events, { type: 'bagFull', id: who, item: worn.item });
    return false;
  }
  if (addStack(inv.slots, worn) > 0) {
    emit(state.events, { type: 'bagFull', id: who, item: worn.item });
    return false;
  }
  inv.equipment[slot] = null;
  recomputeGear(state, who);
  emit(state.events, { type: 'unequipped', id: who, slot, item: worn.item });
  return true;
}

/** Drops a whole bag slot at the avatar's feet. It cannot be picked up again for a moment. */
export function dropFromBag(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const stack = inv?.slots[slot];
  if (!inv || !stack || getComp(state.entities, who, 'fighter')?.state === 'dead') return false;
  inv.slots[slot] = null;
  const f = feet(state, who);
  const id = spawnPickup(state, stack.item, stack.qty, f.x, f.y, stack);
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
  // Wild Eater: raw forage restores more.
  const gift = activeMods(state, who);
  const more = (n: number): number => (food.raw ? applyMods(n, 'rawFoodPct', gift) : n);
  pools.hp = Math.min(pools.hpMax, pools.hp + more(food.hp));
  pools.sta = Math.min(pools.staMax, pools.sta + more(food.sta));
  pools.foc = Math.min(pools.focMax, pools.foc + more(food.foc));
  emit(state.events, { type: 'eaten', id: who, item, raw: food.raw === true });
  // Remedies clear statuses and some leave one.
  const cure = ITEMS[item]?.status;
  for (const id of cure?.clear ?? []) clearStatus(state, who, id as StatusId);
  if (cure?.apply)
    applyStatus(state, who, cure.apply.status as StatusId, -1, { ticks: cure.apply.ticks });
  if (food.fed) {
    // One Fed at a time: a new meal replaces the old one, and the pool bonuses come from its mods.
    const old = statusesOf(state, who).find((s) => s.id === 'fed');
    const replaced = old?.item ?? null;
    applyStatus(state, who, 'fed', -1, {
      ticks: applyMods(food.fed.ticks, 'fedTicksPct', gift),
      item,
    });
    emit(state.events, { type: 'fedStarted', id: who, item, replaced });
  }
  return true;
}

/** Reads a recipe scroll from a bag slot: learns its recipe and uses the scroll up. */
export function readScroll(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const stack = inv?.slots[slot];
  const teaches = stack ? ITEMS[stack.item]?.teaches : undefined;
  if (!inv || !stack || !teaches) return false;
  if (getComp(state.entities, who, 'fighter')?.state === 'dead') return false;
  if (!learnRecipe(state, who, teaches)) return false;
  stack.qty--;
  if (stack.qty === 0) inv.slots[slot] = null;
  emit(state.events, { type: 'recipeDiscovered', id: who, recipe: teaches });
  return true;
}

/**
 * Reads a manual from a bag slot (M4-15): awakens its skill, learns its technique and uses it up.
 * A manual whose technique is already known is kept, and the avatar is told.
 */
export function readManual(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const stack = inv?.slots[slot];
  const manual = stack ? ITEMS[stack.item]?.manual : undefined;
  if (!inv || !stack || !manual) return false;
  if (getComp(state.entities, who, 'fighter')?.state === 'dead') return false;
  const j = getComp(state.entities, who, 'journal');
  if (j?.flags.includes(learnedFlag(manual.technique))) {
    emit(state.events, { type: 'manualKnown', who, item: stack.item, technique: manual.technique });
    return true;
  }
  const item = stack.item;
  stack.qty--;
  if (stack.qty === 0) inv.slots[slot] = null;
  learnTechnique(state, who, manual.technique, 'manual');
  emit(state.events, { type: 'manualRead', who, item, technique: manual.technique });
  return true;
}

/** Teaches a recipe, for example from an NPC. Returns false if already known or unknown. */
export function learnRecipe(state: SimState, who: EntityId, recipeId: string): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  if (!inv || !RECIPES[recipeId] || inv.recipes.includes(recipeId)) return false;
  inv.recipes.push(recipeId);
  return true;
}

/** The context button: starts a gather on a ready node, or lands the timing press. */
function interact(state: SimState, who: EntityId): void {
  const g = getComp(state.entities, who, 'gather');
  // While a craft's manual step runs, the context button is the tap.
  if (crafting(state, who)) {
    tapStep(state, who);
    return;
  }
  if (g) {
    pressGather(state, who);
    return;
  }
  if (!idle(state, who)) return;
  const target = contextTarget(state, who);
  if (target === null) return;
  const kind = getComp(state.entities, target, 'interactable')?.kind;
  if (kind && STATIONS[kind]) {
    emit(state.events, { type: 'stationOpened', id: target, who, station: kind });
    return;
  }
  startGather(state, who, target);
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
      if (
        !eat(state, who, c.slot) &&
        !readScroll(state, who, c.slot) &&
        !readManual(state, who, c.slot)
      )
        useGadget(state, who, c.slot);
      return;
    case 'drop':
      dropFromBag(state, who, c.slot);
      return;
    case 'store':
      moveStorage(state, who, c.dir, c.slot);
      return;
    case 'craft':
      startCraft(state, who, c.items);
      return;
    case 'cook':
      startCraft(state, who, c.items, { skipStep: true });
      return;
    case 'craftStep':
      tapStep(state, who);
      return;
    case 'craftPoint':
      tracePoint(state, who, c.x, c.y);
      return;
    case 'craftHold':
      holdStep(state, who, c.on);
      return;
    case 'repair':
      repair(state, who, c.slot);
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
    earnCoin(state, who, p.qty, 'loot');
    emit(state.events, { type: 'itemPickedUp', id: who, item: p.item, qty: p.qty });
    destroy(state.entities, pickupId);
    return true;
  }
  const left = addStack(inv.slots, {
    ...(p.stack ?? newStack(p.item, 1)),
    item: p.item,
    qty: p.qty,
  });
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

/**
 * Moves a whole stack between the bag and the storage chest the avatar is facing. Whatever does
 * not fit stays where it was. Items are never created or lost here, so the ledger is untouched.
 */
export function moveStorage(
  state: SimState,
  who: EntityId,
  dir: 'in' | 'out',
  slot: number,
): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const store = getComp(state.entities, who, 'storage');
  const target = contextTarget(state, who);
  const kind = target === null ? null : getComp(state.entities, target, 'fixture')?.kind;
  if (!inv || !store || !kind || FIXTURES[kind]?.type !== 'storage' || !idle(state, who))
    return false;
  const from = dir === 'in' ? inv.slots : store.slots;
  const to = dir === 'in' ? store.slots : inv.slots;
  const stack = from[slot];
  if (!stack) return false;
  const left = addStack(to, stack);
  const moved = stack.qty - left;
  if (moved === 0) return false;
  if (left === 0) from[slot] = null;
  else stack.qty = left;
  emit(state.events, { type: 'storageMoved', who, item: stack.item, qty: moved, dir });
  return true;
}

/** Takes durability off a stack, never below 0 (an item is never destroyed). */
function loseDurability(stack: ItemStack, amount: number): void {
  const max = ITEMS[stack.item]?.durability;
  if (max === undefined) return;
  stack.dur = Math.max(0, (stack.dur ?? max) - amount);
}

/**
 * Wear from play (design/05). Weapons lose 1 per `weaponHits` hits landed, armor 1 per
 * `armorHits` hits taken, and every worn item loses `deathPct` of its maximum on death. Counters
 * live on the inventory so they survive a save. Reads the tick's events, like skills do.
 */
export function wearSystem(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'inventory')) {
    const inv = getComp(state.entities, who, 'inventory');
    if (!inv) continue;
    let changed = false;
    for (const e of state.events.list) {
      if (e.type === 'damageDealt' && e.src === who) {
        if (++inv.wear.hits >= B.wear.weaponHits) {
          inv.wear.hits = 0;
          if (inv.equipment.main) loseDurability(inv.equipment.main, 1);
          changed = true;
        }
      } else if (e.type === 'damageDealt' && e.dst === who) {
        if (++inv.wear.taken >= B.wear.armorHits) {
          inv.wear.taken = 0;
          for (const slot of ['off', 'head', 'body', 'legs'] as const) {
            const s = inv.equipment[slot];
            if (s) loseDurability(s, 1);
          }
          changed = true;
        }
      } else if (e.type === 'died' && e.id === who) {
        for (const slot of EQUIP_SLOTS) {
          const s = inv.equipment[slot];
          const max = s ? ITEMS[s.item]?.durability : undefined;
          if (s && max !== undefined) loseDurability(s, Math.ceil((max * B.wear.deathPct) / 100));
        }
        changed = true;
      }
    }
    if (changed) recomputeGear(state, who);
  }
}

/**
 * One gather made with a tool counts toward its wear: 1 durability per `toolUses` uses. M3-06
 * calls this for the tool it picked. Returns true if the tool lost a point.
 */
export function useTool(state: SimState, who: EntityId, slot: number, tag?: string): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const stack = inv?.slots[slot];
  if (!inv || !stack || ITEMS[stack.item]?.tool === undefined) return false;
  // Prospector: a pick wears more slowly on veins, so it takes more uses to lose a point.
  const uses = Math.ceil(
    (B.wear.toolUses * 100) /
      Math.max(10, 100 + modPct(activeMods(state, who), 'durabilityLossPct', tag)),
  );
  if (++inv.wear.uses < uses) return false;
  inv.wear.uses = 0;
  loseDurability(stack, 1);
  return true;
}
