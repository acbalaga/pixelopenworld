import { CREATURES } from '../content/creatures';
import { territoryOf } from '../sim/combat/temperament';
import { SUBPX } from '../sim/kernel/fixed';
import type { SimState } from '../sim/state';
import { Layer, type Renderer } from './renderer';

/** A territorial creature's warning, as the renderer needs it. Positions and radius in px. */
export interface WarnMarker {
  id: number;
  /** The territory centre: where the creature stands guard. */
  x: number;
  y: number;
  radius: number;
  /** 0 at the start of the warning, 1 when it is about to chase. */
  progress: number;
}

/** Every warning running now. Pure, so it can be tested without a canvas. */
export function warnMarkers(state: SimState): WarnMarker[] {
  const out: WarnMarker[] = [];
  const { ai, pos } = state.entities.comps;
  for (let id = 0; id < state.entities.capacity; id++) {
    const a = ai[id];
    const p = pos[id];
    if (!state.entities.alive[id] || !a || !p || a.state !== 'warn') continue;
    const def = CREATURES[a.creature];
    if (!def) continue;
    const terr = territoryOf(def);
    out.push({
      id,
      x: a.home.x / SUBPX,
      y: a.home.y / SUBPX,
      radius: terr.radius,
      progress: Math.min(1, a.t / terr.warnTicks),
    });
  }
  return out;
}

/** Creatures that have just committed to a chase: they wear a "!" for the notice beat. */
export function committed(state: SimState): { id: number; x: number; y: number }[] {
  const out: { id: number; x: number; y: number }[] = [];
  const { ai, pos, body } = state.entities.comps;
  for (let id = 0; id < state.entities.capacity; id++) {
    const a = ai[id];
    const p = pos[id];
    if (!state.entities.alive[id] || !a || !p || a.state !== 'notice' || a.target === null)
      continue;
    out.push({ id, x: p.x / SUBPX, y: p.y / SUBPX - (body[id]?.h ?? 0) / SUBPX });
  }
  return out;
}

const AMBER = (a: number): string => `rgba(232, 168, 56, ${a.toFixed(2)})`;

/** The ground ring at the territory edge. Drawn under the actors, like the attack telegraphs. */
export function drawWarnings(r: Renderer, state: SimState): void {
  for (const m of warnMarkers(state)) {
    const a = 0.35 + 0.5 * m.progress;
    const n = 72;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2;
      r.drawRect(
        Layer.Detail,
        Math.round(m.x + Math.cos(ang) * m.radius),
        Math.round(m.y - 4 + Math.sin(ang) * m.radius),
        2,
        2,
        AMBER(a),
      );
    }
  }
}

/** The "!" over a creature that commits to a chase. */
export function drawCommitMarks(r: Renderer, state: SimState): void {
  for (const c of committed(state)) {
    const x = Math.round(c.x) - 1;
    const y = Math.round(c.y) - 12;
    r.drawRect(Layer.Overhead, x, y, 2, 6, 'rgba(194, 64, 42, 1)');
    r.drawRect(Layer.Overhead, x, y + 8, 2, 2, 'rgba(194, 64, 42, 1)');
  }
}
