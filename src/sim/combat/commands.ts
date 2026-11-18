import { COMBAT as C } from '../../content/balance/combat';
import { ATTACKS, WEAPONS } from '../../content/combat/attacks';
import { isAimed, TECHNIQUES } from '../../content/combat/techniques';
import type { Command } from '../kernel/commands';
import { emit } from '../kernel/events';
import { getComp, type EntityId } from '../kernel/entities';
import { dirStep, SUBPX, type Direction } from '../kernel/fixed';
import type { SimState } from '../state';
import { centerPx, foes, spend, startAttack } from './fighter';
import { fireTechnique } from './techniques';
import { len } from './geometry';
import { setGuard } from './guard';
import { applyMods, hasStatus, statusMods } from '../mods';

/** World point of the target a swing should face: the lock if there is one. */
export function lockPoint(state: SimState, who: EntityId): { x: number; y: number } | null {
  const f = getComp(state.entities, who, 'fighter');
  if (!f || f.lock === null) return null;
  return centerPx(state, f.lock);
}

/** Dodge direction: explicit, else the held stick, else back from facing. */
function dodgeDir(state: SimState, who: EntityId, dir: Direction | null): Direction {
  const a = getComp(state.entities, who, 'avatar');
  return dir ?? a?.intent ?? a?.facing ?? 4;
}

/** Handles the combat commands for the player's fighter. Move is handled by the avatar. */
export function applyFighterCommand(state: SimState, who: EntityId, c: Command): void {
  const e = state.entities;
  const f = getComp(e, who, 'fighter');
  const cb = getComp(e, who, 'combatant');
  const pools = getComp(e, who, 'pools');
  if (!f || !cb || !pools || f.state === 'dead') return;

  switch (c.type) {
    case 'scheme':
      f.scheme = c.scheme;
      f.combo = 0;
      f.queued = false;
      return;

    case 'guard':
      setGuard(state, who, c.on);
      return;

    case 'attack': {
      if (f.scheme !== 'classic' || f.guard) return;
      const w = WEAPONS[cb.weapon];
      if (!w) return;
      if (f.state === 'attack') {
        // Press during the tail of a swing queues the next combo step.
        const def = f.atk ? ATTACKS[f.atk] : undefined;
        if (def && f.t >= def.windup + def.active + def.recover - w.chainWindow) f.queued = true;
        return;
      }
      if (f.state !== 'idle') return;
      startComboStep(state, who);
      return;
    }

    case 'dodge': {
      if (f.state !== 'idle' && f.state !== 'attack') return;
      if (hasStatus(state, who, 'rooted')) return;
      if (!spend(state, who, 'sta', applyMods(C.dodge.cost, 'dodgeCost', statusMods(state, who))))
        return;
      const d = dirStep(dodgeDir(state, who, c.dir));
      const l = len(d);
      const step = (C.dodge.distance * SUBPX) / C.dodge.ticks / l;
      f.state = 'dodge';
      f.t = 0;
      f.atk = null;
      f.hit = [];
      f.casting = null;
      f.queued = false;
      f.dv = { x: Math.round(d.x * step), y: Math.round(d.y * step) };
      f.invuln = C.dodge.iframes;
      f.dodgeStart = state.tick;
      emit(state.events, { type: 'dodgeStarted', id: who });
      return;
    }

    case 'lock': {
      let best: EntityId | null = null;
      let bestD: number = C.lock.tapRadius;
      for (const id of foes(state, f.team)) {
        const p = centerPx(state, id);
        if (!p) continue;
        const d = len({ x: p.x - c.x, y: p.y - c.y });
        if (d <= bestD) {
          best = id;
          bestD = d;
        }
      }
      if (best !== f.lock) {
        f.lock = best;
        emit(state.events, { type: 'lockChanged', id: who, target: best });
      }
      return;
    }

    case 'technique': {
      const techId = f.slots[c.slot];
      const tech = techId ? TECHNIQUES[techId] : undefined;
      if (!tech) return;
      const fire = (): void => fireTechnique(state, who, c.slot, c.aim);
      if (c.phase === 'press') {
        f.aiming = -1;
        fire();
      } else if (c.phase === 'aim') {
        if (isAimed(tech)) f.aiming = c.slot;
        else fire();
      } else if (f.aiming === c.slot) {
        f.aiming = -1;
        fire();
      }
      return;
    }
    default:
      return;
  }
}

/** Starts the next Classic combo step. */
export function startComboStep(state: SimState, who: EntityId): void {
  const f = getComp(state.entities, who, 'fighter');
  const cb = getComp(state.entities, who, 'combatant');
  const w = cb ? WEAPONS[cb.weapon] : undefined;
  if (!f || !w) return;
  const step = f.combo % 3;
  if (startAttack(state, who, w.combo[step] as string, lockPoint(state, who))) {
    f.combo = (step + 1) % 3;
  }
}
