import { emit } from '../kernel/events';
import { query } from '../kernel/entities';
import { DEMO_BOX, type SimState } from '../state';

/** Demo system: entities drift by their velocity and bounce off the box edges. */
export function driftSystem(state: SimState): void {
  const { pos, vel } = state.entities.comps;
  for (const id of query(state.entities, 'pos', 'vel')) {
    const p = pos[id];
    const v = vel[id];
    if (!p || !v) continue;
    p.x += v.x;
    p.y += v.y;
    if (p.x < 0 || p.x > DEMO_BOX.x) {
      v.x = -v.x;
      p.x = Math.min(Math.max(p.x, 0), DEMO_BOX.x);
      emit(state.events, { type: 'bounce', id, axis: 'x' });
    }
    if (p.y < 0 || p.y > DEMO_BOX.y) {
      v.y = -v.y;
      p.y = Math.min(Math.max(p.y, 0), DEMO_BOX.y);
      emit(state.events, { type: 'bounce', id, axis: 'y' });
    }
  }
}
