// Stand-in creature behavior for the combat demo until Enemy AI v1 (M1-03): walk at the avatar
// and swing with a telegraph. It only calls the sim's public functions.
import { centerPx, startAttack } from '../sim/combat/fighter';
import { len } from '../sim/combat/geometry';
import { query } from '../sim/kernel/entities';
import type { SimState } from '../sim/state';
import { nudge } from '../sim/systems/movement';

const SWIPE = 'attack.creature_swipe';
const SPEED = 0.9 * 256;
const SWING_RANGE = 24;
const COOLDOWN_TICKS = 40;

/** Per-creature timers. */
export function createBrain(): { cooldown: Map<number, number> } {
  return { cooldown: new Map() };
}

/** One tick of behavior for every living creature, toward the avatar `target`. */
export function brainTick(
  state: SimState,
  brain: { cooldown: Map<number, number> },
  target: number,
): void {
  const t = centerPx(state, target);
  if (!t) return;
  const tf = state.entities.comps.fighter[target];
  for (const id of query(state.entities, 'fighter', 'pos')) {
    const f = state.entities.comps.fighter[id];
    if (!f || f.team !== 1 || f.state !== 'idle' || f.hitstop > 0) continue;
    const me = centerPx(state, id);
    if (!me || !tf || tf.state === 'dead') continue;
    const cd = Math.max(0, (brain.cooldown.get(id) ?? 0) - 1);
    brain.cooldown.set(id, cd);
    const d = { x: t.x - me.x, y: t.y - me.y };
    const dist = len(d);
    if (dist > 140) continue;
    f.aim = d;
    if (dist <= SWING_RANGE && cd === 0) {
      startAttack(state, id, SWIPE, t);
      brain.cooldown.set(id, COOLDOWN_TICKS);
    } else if (dist > SWING_RANGE - 4) {
      nudge(state, id, Math.round((d.x / dist) * SPEED), Math.round((d.y / dist) * SPEED));
    }
  }
}
