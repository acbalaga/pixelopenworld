import { createStore, spawn, setComp, type EntityStore } from './kernel/entities';
import { createEventQueue, type EventQueue } from './kernel/events';
import { createStreams, int, type RngStreams } from './kernel/rng';
import { px, type Vec } from './kernel/fixed';

/** Components. The demo uses two; real ones arrive with real systems. */
export interface Components {
  pos: Vec;
  vel: Vec;
}

/** Everything that is saved. Plain, serializable data. */
export interface SimState {
  /** Master seed the sim started from. */
  seed: number;
  tick: number;
  rng: RngStreams;
  entities: EntityStore<Components>;
  /** Transient. Excluded from serialization and hashing. */
  events: EventQueue;
}

/** Demo box size in sub-pixel units. */
export const DEMO_BOX: Vec = { x: px(1024), y: px(1024) };

/** Creates a demo state with `entityCount` entities drifting in the box. */
export function createDemoState(seed: number, entityCount: number): SimState {
  const state: SimState = {
    seed: seed >>> 0,
    tick: 0,
    rng: createStreams(seed),
    entities: createStore<Components>(['pos', 'vel']),
    events: createEventQueue(),
  };
  for (let i = 0; i < entityCount; i++) {
    const id = spawn(state.entities);
    setComp(state.entities, id, 'pos', {
      x: int(state.rng.world, 0, DEMO_BOX.x),
      y: int(state.rng.world, 0, DEMO_BOX.y),
    });
    setComp(state.entities, id, 'vel', {
      x: int(state.rng.world, -128, 128),
      y: int(state.rng.world, -128, 128),
    });
  }
  return state;
}

function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(',')}}`;
}

function persistent(state: SimState): Omit<SimState, 'events'> {
  return {
    seed: state.seed,
    tick: state.tick,
    rng: state.rng,
    entities: state.entities,
  };
}

/** Canonical string form of the saved state. Key order is sorted, so it is stable. */
export function serializeState(state: SimState): string {
  return canonical(persistent(state));
}

/** Rebuilds a state from {@link serializeState} output. Round trip is exact. */
export function deserializeState(text: string): SimState {
  const raw = JSON.parse(text) as Omit<SimState, 'events'>;
  if (
    typeof raw?.tick !== 'number' ||
    typeof raw.seed !== 'number' ||
    !raw.rng ||
    !raw.entities?.comps
  ) {
    throw new Error('malformed sim state');
  }
  return { ...raw, events: createEventQueue() };
}

/** Stable 53-bit hash of the saved state, as 14 hex chars. For tests and save checks. */
export function hashState(state: SimState): string {
  const s = serializeState(state);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
