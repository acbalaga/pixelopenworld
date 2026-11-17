import type { AttackDef } from '../../content/combat/attacks';
import { dealDamage, centerPx, foes } from '../combat/fighter';
import { len } from '../combat/geometry';
import { destroy, getComp, query, setComp, spawn, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { SUBPX } from '../kernel/fixed';
import type { SimState } from '../state';

/** Bolt radius in px: how close to a body center counts as a hit. */
const HIT_RADIUS = 6;

/** Spawns a projectile from `owner` along its aim. */
export function launchProjectile(
  state: SimState,
  owner: EntityId,
  def: AttackDef,
  proj: NonNullable<AttackDef['projectile']>,
): void {
  const f = getComp(state.entities, owner, 'fighter');
  const cb = getComp(state.entities, owner, 'combatant');
  const p = getComp(state.entities, owner, 'pos');
  const b = getComp(state.entities, owner, 'body');
  if (!f || !cb || !p) return;
  const l = len(f.aim);
  const id = spawn(state.entities);
  setComp(state.entities, id, 'pos', { x: p.x, y: p.y - (b ? b.h >> 1 : 0) });
  setComp(state.entities, id, 'projectile', {
    owner,
    team: f.team,
    vx: Math.round((f.aim.x / l) * proj.speed * SUBPX),
    vy: Math.round((f.aim.y / l) * proj.speed * SUBPX),
    ttl: proj.ttl,
    power: cb.power,
    mult: def.mult,
    stagger: def.stagger,
    knock: def.knock,
    element: proj.element,
  });
  emit(state.events, { type: 'projectileLaunched', id, owner });
}

/** Moves projectiles, ends them on walls or range, and hits the first foe they reach. */
export function projectileSystem(state: SimState): void {
  for (const id of query(state.entities, 'projectile', 'pos')) {
    const pr = getComp(state.entities, id, 'projectile');
    const p = getComp(state.entities, id, 'pos');
    if (!pr || !p) continue;
    p.x += pr.vx;
    p.y += pr.vy;
    pr.ttl--;
    const tile = state.world?.solidAt(Math.floor(p.x / SUBPX / 16), Math.floor(p.y / SUBPX / 16));
    if (pr.ttl <= 0 || (tile !== undefined && tile !== 0 && tile !== 3)) {
      destroy(state.entities, id);
      continue;
    }
    const here = { x: Math.round(p.x / SUBPX), y: Math.round(p.y / SUBPX) };
    for (const target of foes(state, pr.team)) {
      const c = centerPx(state, target);
      if (!c || len({ x: c.x - here.x, y: c.y - here.y }) > HIT_RADIUS) continue;
      const owner = getComp(state.entities, pr.owner, 'combatant');
      dealDamage(state, target, {
        src: pr.owner,
        from: here,
        power: pr.power,
        rank: owner?.skillRank ?? 0,
        mult: pr.mult,
        stagger: pr.stagger,
        knock: pr.knock,
        element: 100,
        heavy: false,
        tag: pr.element,
      });
      destroy(state.entities, id);
      break;
    }
  }
}
