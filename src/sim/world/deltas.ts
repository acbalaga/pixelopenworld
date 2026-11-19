/**
 * Chunk deltas (M4-03): what the player has changed in a chunk, kept in the save so the chunk file
 * itself never changes. A delta is stored per map object (a chest, a tree, a door, a pushed block)
 * and holds only the components that differ from a freshly placed one, so a chunk the player never
 * touched costs nothing.
 */
import { createStore, getComp } from '../kernel/entities';
import { spawnNode } from '../items';
import { spawnFixture } from '../systems/fixtures';
import { canonical, COMPONENT_KEYS, type Components, type SimState } from '../state';
import { CHUNK_TILES } from './chunk';
import { chunkKey } from './window';

/** Component values that differ from a fresh object. `null` means the component was removed. */
export type ObjectDelta = Partial<Record<keyof Components, unknown>>;

/** The saved changes in one chunk, by object key (see {@link objectKey}). */
export interface ChunkDelta {
  objects: Record<string, ObjectDelta>;
}

/** Saved deltas by chunk key (`window.chunkKey`). */
export type Deltas = Record<string, ChunkDelta>;

/** A map object that persists through deltas: a fixture or a gathering node. */
export type DeltaKind = 'fixture' | 'node';

const TILE = 16;

/** Where a placed object stands, in world tiles, from its saved position. */
export function tileOf(
  type: DeltaKind | 'spawner' | 'camp_pot',
  pos: { x: number; y: number },
): { tx: number; ty: number } {
  // Fixtures stand with feet at the bottom of their tile (y = ty * 16 + 16), the rest at y = ty * 16 + 14.
  const xPx = pos.x / 256;
  const yPx = pos.y / 256;
  return {
    tx: Math.floor(xPx / TILE),
    ty: Math.floor((type === 'fixture' ? yPx - 1 : yPx) / TILE),
  };
}

/** Key of an object within its chunk's delta: kind and tile within the chunk. */
export function objectKey(kind: string, tx: number, ty: number): string {
  const lx = tx - Math.floor(tx / CHUNK_TILES) * CHUNK_TILES;
  const ly = ty - Math.floor(ty / CHUNK_TILES) * CHUNK_TILES;
  return `${kind}@${lx},${ly}`;
}

/** The chunk key of a world tile. */
export function chunkKeyOfTile(tx: number, ty: number): string {
  return chunkKey(Math.floor(tx / CHUNK_TILES), Math.floor(ty / CHUNK_TILES));
}

/** What an object looks like when freshly placed, as components. Built in a scratch store. */
function pristine(type: DeltaKind, kind: string, tx: number, ty: number): Components | null {
  const scratch = { entities: createStore<Components>(COMPONENT_KEYS) } as unknown as SimState;
  const id =
    type === 'fixture'
      ? spawnFixture(scratch, kind, tx, ty)
      : spawnNode(scratch, kind, tx * TILE + 8, ty * TILE + 14);
  const out: Record<string, unknown> = {};
  for (const k of COMPONENT_KEYS) out[k] = getComp(scratch.entities, id, k) ?? null;
  return out as unknown as Components;
}

/**
 * The delta of a live object against a freshly placed one, or null if nothing differs. A node
 * whose respawn has already passed counts as untouched.
 */
export function captureDelta(
  state: SimState,
  id: number,
  type: DeltaKind,
  kind: string,
  tx: number,
  ty: number,
): ObjectDelta | null {
  const fresh = pristine(type, kind, tx, ty) as unknown as Record<string, unknown>;
  const delta: ObjectDelta = {};
  for (const k of COMPONENT_KEYS) {
    let live: unknown = getComp(state.entities, id, k) ?? null;
    if (k === 'node' && live && (live as { readyAt: number }).readyAt <= state.worldTick)
      live = { ...(live as object), readyAt: 0 };
    if (canonical(live) !== canonical(fresh[k] ?? null)) delta[k] = live;
  }
  return Object.keys(delta).length > 0 ? delta : null;
}

/** Writes a delta onto a freshly placed object. */
export function applyDelta(state: SimState, id: number, delta: ObjectDelta): void {
  const comps = state.entities.comps as unknown as Record<string, unknown[]>;
  for (const k of Object.keys(delta)) {
    if (!(COMPONENT_KEYS as readonly string[]).includes(k)) continue;
    const v = delta[k as keyof Components];
    (comps[k] as unknown[])[id] = v === undefined ? null : structuredClone(v);
  }
}

/** Records or clears one object's delta in the saved set. Drops an empty chunk entry. */
export function storeDelta(
  deltas: Deltas,
  key: string,
  object: string,
  delta: ObjectDelta | null,
): void {
  if (delta) {
    (deltas[key] ??= { objects: {} }).objects[object] = delta;
    return;
  }
  const d = deltas[key];
  if (!d) return;
  delete d.objects[object];
  if (Object.keys(d.objects).length === 0) delete deltas[key];
}
