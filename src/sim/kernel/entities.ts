/** Entity store: dense component arrays keyed by id. Ids are reused lowest-first. */

/** Entity id. */
export type EntityId = number;

/** The store for a component record type C. Plain data, serializable. */
export interface EntityStore<C extends object> {
  /** One past the highest id ever issued. */
  capacity: number;
  alive: boolean[];
  /** Free ids below capacity, kept ascending. Spawn takes the lowest. */
  free: number[];
  comps: { [K in keyof C]: (C[K] | null)[] };
}

/** Creates an empty store with the given component names. */
export function createStore<C extends object>(keys: readonly (keyof C)[]): EntityStore<C> {
  const comps = {} as EntityStore<C>['comps'];
  for (const k of keys) comps[k] = [];
  return { capacity: 0, alive: [], free: [], comps };
}

/** Creates an entity. Reuses the lowest free id, otherwise issues a new one. */
export function spawn<C extends object>(store: EntityStore<C>): EntityId {
  const reused = store.free.shift();
  if (reused !== undefined) {
    store.alive[reused] = true;
    return reused;
  }
  const id = store.capacity++;
  store.alive[id] = true;
  for (const k of Object.keys(store.comps) as (keyof C)[]) store.comps[k][id] = null;
  return id;
}

/** True if the id is a live entity. */
export function isAlive<C extends object>(store: EntityStore<C>, id: EntityId): boolean {
  return store.alive[id] === true;
}

/** Destroys an entity and clears its components. No-op if already dead. */
export function destroy<C extends object>(store: EntityStore<C>, id: EntityId): void {
  if (!isAlive(store, id)) return;
  store.alive[id] = false;
  for (const k of Object.keys(store.comps) as (keyof C)[]) store.comps[k][id] = null;
  let i = store.free.length;
  while (i > 0 && (store.free[i - 1] as number) > id) i--;
  store.free.splice(i, 0, id);
}

/** Sets a component on a live entity. */
export function setComp<C extends object, K extends keyof C>(
  store: EntityStore<C>,
  id: EntityId,
  key: K,
  value: C[K],
): void {
  if (!isAlive(store, id)) throw new Error(`entity ${id} is not alive`);
  store.comps[key][id] = value;
}

/** Gets a component, or undefined if absent. */
export function getComp<C extends object, K extends keyof C>(
  store: EntityStore<C>,
  id: EntityId,
  key: K,
): C[K] | undefined {
  return store.comps[key][id] ?? undefined;
}

/** Removes one component. */
export function removeComp<C extends object>(
  store: EntityStore<C>,
  id: EntityId,
  key: keyof C,
): void {
  store.comps[key][id] = null;
}

/** Ids of live entities having every listed component, ascending. */
export function query<C extends object>(store: EntityStore<C>, ...keys: (keyof C)[]): EntityId[] {
  const out: EntityId[] = [];
  for (let id = 0; id < store.capacity; id++) {
    if (!store.alive[id]) continue;
    let ok = true;
    for (const k of keys) {
      if (store.comps[k][id] == null) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(id);
  }
  return out;
}

/** Count of live entities. */
export function count<C extends object>(store: EntityStore<C>): number {
  return store.capacity - store.free.length;
}
