/**
 * Entity streaming (M4-03). The map's objects (fixtures, gathering nodes, spawners, camp pots) are
 * entities only while their chunk is inside the loaded window around the avatar. When a chunk
 * leaves the window its objects are folded into `state.deltas` (what the player changed) and
 * removed. When it enters, they are placed again from the chunk file and the delta is applied.
 *
 * Creatures are simulated only in the active window. In the loaded ring they are frozen.
 *
 * All of it is a function of the avatar's chunk and the chunks present in `state.world`, so it is
 * deterministic for a given sequence of chunk arrivals. Without `state.stream` (tests and demos
 * with a fixed map) nothing here runs and every entity is simulated.
 */
import { destroy, getComp, query } from '../kernel/entities';
import { findAvatar } from '../../shared/summary';
import type { SimState } from '../state';
import { removeSpawner } from '../systems/spawner';
import { CHUNK_TILES, type Chunk } from './chunk';
import {
  applyDelta,
  captureDelta,
  chunkKeyOfTile,
  objectKey,
  storeDelta,
  tileOf,
  type DeltaKind,
} from './deltas';
import { populateMap, type MapObject } from './populate';
import { dayIndex } from '../time';
import {
  ACTIVE_RADIUS,
  LOADED_RADIUS,
  chunkKey,
  chunkOfPx,
  inWindow,
  windowChunks,
} from './window';

/** Transient streaming state. Never saved. */
export interface StreamState {
  /** Where chunk data comes from: the resident tile world. */
  source: { chunk(cx: number, cy: number): Chunk | undefined };
  /** Chunk keys whose map objects are entities now. */
  live: Set<string>;
  /** Existing entities have been assigned to chunks (after a load or a migration). */
  adopted: boolean;
  /** The avatar's chunk as of the last check, and whether any wanted chunk was still missing. */
  ax: number;
  ay: number;
  pending: boolean;
  /** Creature spawners are placed when a chunk goes live. Off for `?foes=0`. */
  spawners: boolean;
  /** Chunks materialized and dematerialized since creation, for tests and the debug line. */
  placed: number;
  removed: number;
}

export function newStream(source: StreamState['source'], spawners: boolean): StreamState {
  return {
    source,
    live: new Set(),
    adopted: false,
    ax: Number.NaN,
    ay: Number.NaN,
    pending: true,
    spawners,
    placed: 0,
    removed: 0,
  };
}

type MapType = DeltaKind | 'spawner' | 'camp_pot';

interface MapEntity {
  id: number;
  type: MapType;
  kind: string;
  tx: number;
  ty: number;
}

/** Every map-placed entity (fixtures, nodes, spawners, camp pots) with where it stands. */
function mapEntities(state: SimState): MapEntity[] {
  const out: MapEntity[] = [];
  const c = state.entities.comps;
  for (const id of query(state.entities, 'pos')) {
    const pos = c.pos[id];
    if (!pos) continue;
    const f = c.fixture[id];
    const n = c.node[id];
    const s = c.spawner[id];
    if (f && !f.temp) {
      // A fixture belongs where it was placed, so a pushed block stays with its chunk.
      const at = tileOf('fixture', f.home);
      out.push({ id, type: 'fixture', kind: f.kind, ...at });
    } else if (n) out.push({ id, type: 'node', kind: n.kind, ...tileOf('node', pos) });
    else if (s) out.push({ id, type: 'spawner', kind: s.kind, ...tileOf('spawner', pos) });
    else if (c.interactable[id]?.kind === 'camp_pot')
      out.push({ id, type: 'camp_pot', kind: 'camp_pot', ...tileOf('camp_pot', pos) });
  }
  return out;
}

/** Temporary fixtures (an Earth Wall) are never saved. They go when their chunk does. */
function tempFixtures(state: SimState): number[] {
  return query(state.entities, 'fixture').filter(
    (id) => getComp(state.entities, id, 'fixture')?.temp === true,
  );
}

/** Folds the objects of the given chunks into deltas and removes their entities. */
function dematerialize(state: SimState, keys: ReadonlySet<string>): void {
  if (keys.size === 0) return;
  for (const e of mapEntities(state)) {
    const key = chunkKeyOfTile(e.tx, e.ty);
    if (!keys.has(key)) continue;
    if (e.type === 'fixture' || e.type === 'node') {
      storeDelta(
        state.deltas,
        key,
        objectKey(e.kind, e.tx, e.ty),
        captureDelta(state, e.id, e.type, e.kind, e.tx, e.ty),
      );
      destroy(state.entities, e.id);
    } else if (e.type === 'spawner') {
      // A daily spawner that was cleared today stays cleared while its chunk is away.
      const sp = getComp(state.entities, e.id, 'spawner');
      const cleared =
        sp?.clearedDay !== undefined && dayIndex(state.worldTick) <= sp.clearedDay
          ? { spawner: { kind: sp.kind, timer: 0, members: [], clearedDay: sp.clearedDay } }
          : null;
      storeDelta(state.deltas, key, objectKey(e.kind, e.tx, e.ty), cleared);
      removeSpawner(state, e.id);
    } else destroy(state.entities, e.id);
  }
  for (const id of tempFixtures(state)) {
    const p = getComp(state.entities, id, 'pos');
    if (p && keys.has(chunkKey(chunkOfPx(p.x / 256), chunkOfPx(p.y / 256))))
      destroy(state.entities, id);
  }
}

/** Places a chunk's objects and applies what the player changed there. */
function materialize(state: SimState, chunk: Chunk, spawners: boolean): void {
  const key = chunkKey(chunk.cx, chunk.cy);
  const objects: MapObject[] = chunk.objects.map((o) => ({
    kind: o.kind,
    tx: chunk.cx * CHUNK_TILES + o.x,
    ty: chunk.cy * CHUNK_TILES + o.y,
  }));
  const delta = state.deltas[key]?.objects;
  populateMap(state, objects, {
    spawners,
    onlyMissing: true,
    onSpawn: (id, o) => {
      const d = delta?.[objectKey(o.kind, o.tx, o.ty)];
      if (d) applyDelta(state, id, d);
    },
  });
}

/** The avatar's chunk, or null if it has none. */
function avatarChunk(state: SimState): { cx: number; cy: number } | null {
  const who = findAvatar(state);
  const p = who === null ? undefined : getComp(state.entities, who, 'pos');
  return p ? { cx: chunkOfPx(p.x / 256), cy: chunkOfPx(p.y / 256) } : null;
}

/**
 * First system of the tick. Keeps the set of live chunks equal to the loaded window around the
 * avatar (among the chunks that have arrived) and records the active window for the creature
 * systems.
 */
export function streamSystem(state: SimState): void {
  const s = state.stream;
  if (!s || !state.world) return;
  const at = avatarChunk(state);
  if (!at) return;
  if (!s.adopted) {
    // Entities that came with a save belong to the chunks they stand in.
    for (const e of mapEntities(state)) s.live.add(chunkKeyOfTile(e.tx, e.ty));
    s.adopted = true;
    s.pending = true;
  }
  const moved = at.cx !== s.ax || at.cy !== s.ay;
  if (!moved && !s.pending) return;
  s.ax = at.cx;
  s.ay = at.cy;
  const want = windowChunks(at.cx, at.cy, LOADED_RADIUS);
  const wantKeys = new Set(want.map((c) => chunkKey(c.cx, c.cy)));
  const leaving = new Set<string>();
  for (const k of s.live) if (!wantKeys.has(k)) leaving.add(k);
  dematerialize(state, leaving);
  for (const k of leaving) s.live.delete(k);
  s.removed += leaving.size;
  let missing = false;
  for (const c of want) {
    const k = chunkKey(c.cx, c.cy);
    if (s.live.has(k)) continue;
    const chunk = s.source.chunk(c.cx, c.cy);
    if (!chunk) {
      missing = true;
      continue;
    }
    materialize(state, chunk, s.spawners);
    s.live.add(k);
    s.placed++;
  }
  s.pending = missing;
}

/** True if a creature or spawner at this position (sub-pixel units) should not be simulated. */
export function frozenAt(state: SimState, x: number, y: number): boolean {
  const s = state.stream;
  if (!s || Number.isNaN(s.ax)) return false;
  return !inWindow(chunkOfPx(x / 256), chunkOfPx(y / 256), s.ax, s.ay, ACTIVE_RADIUS);
}
