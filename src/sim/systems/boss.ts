/**
 * Boss runtime (M4-08): phases, scripted attack patterns, hazards, health gates and the
 * non-combat objective route. All of it reads `content/creatures/bosses`. A boss is an ordinary
 * creature with a `boss` component, so every combat rule still applies to it.
 */
import { BOSSES } from '../../content/creatures/bosses';
import type { BossDef, ObjectiveDone } from '../../content/creatures/bosses/types';
import { centerPx, kill, startAttack } from '../combat/fighter';
import { len } from '../combat/geometry';
import { spawnCreature } from '../combat/enemy';
import { getComp, query, setComp, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { SUBPX } from '../kernel/fixed';
import { drain } from '../statuses';
import { countItem } from '../items';
import type { SimState } from '../state';

const TILE = 16;

/** Places a boss and its creature at a feet position in whole px. */
export function spawnBoss(state: SimState, bossId: string, xPx: number, yPx: number): EntityId {
  const def = BOSSES[bossId];
  if (!def) throw new Error(`unknown boss ${bossId}`);
  const id = spawnCreature(state, def.creature, xPx, yPx);
  setComp(state.entities, id, 'boss', {
    id: bossId,
    phase: 0,
    step: 0,
    wait: 0,
    phaseTick: state.tick,
    hazardHit: false,
    events: [],
    done: [],
  });
  return id;
}

/** True while a boss's phase has a pattern, so the creature's own attack choice stands aside. */
export function patternDriven(state: SimState, id: EntityId): boolean {
  const b = getComp(state.entities, id, 'boss');
  const def = b ? BOSSES[b.id] : undefined;
  return !!b && !!def && (def.phases[b.phase]?.pattern.length ?? 0) > 0;
}

/** Fixture kinds that switched on, were pressed, broke or opened this tick. */
function eventKinds(state: SimState): string[] {
  const out: string[] = [];
  for (const e of state.events.list) {
    let id: number | null = null;
    if (e.type === 'switchChanged' && e.on) id = e.id;
    else if (e.type === 'plateChanged' && e.pressed) id = e.id;
    else if (e.type === 'wallBroken' || e.type === 'gateOpened') id = e.id;
    const kind = id === null ? undefined : getComp(state.entities, id, 'fixture')?.kind;
    if (kind) out.push(kind);
  }
  return out;
}

function stepDone(state: SimState, done: ObjectiveDone, who: EntityId | null): boolean {
  if ('fixtureOpen' in done) {
    for (const id of query(state.entities, 'fixture'))
      if (getComp(state.entities, id, 'fixture')?.kind === done.fixtureOpen)
        if (getComp(state.entities, id, 'fixture')?.open) return true;
    return false;
  }
  if ('flag' in done) {
    for (const j of state.entities.comps.journal) if (j?.flags.includes(done.flag)) return true;
    return false;
  }
  const inv = who === null ? undefined : getComp(state.entities, who, 'inventory');
  return !!inv && countItem(inv, done.item) >= done.qty;
}

/** Marks the hazards' tiles that hurt now, and hurts an avatar standing on one. */
function hazards(state: SimState, id: EntityId, def: BossDef, bossHome: { x: number; y: number }) {
  const b = getComp(state.entities, id, 'boss');
  if (!b) return;
  const phase = def.phases[b.phase];
  if (!phase?.hazards) return;
  for (const h of phase.hazards) {
    const t = (state.tick - b.phaseTick) % h.period;
    if (t < h.telegraph) b.hazardHit = false;
    if (t < h.telegraph || t >= h.telegraph + h.active) continue;
    if (b.hazardHit) continue;
    for (const a of query(state.entities, 'avatar', 'pos')) {
      if (getComp(state.entities, a, 'fighter')?.state === 'dead') continue;
      const c = centerPx(state, a);
      if (!c) continue;
      for (const [tx, ty] of h.tiles) {
        const cx = bossHome.x + tx * TILE;
        const cy = bossHome.y + ty * TILE;
        if (Math.abs(c.x - cx) <= TILE / 2 && Math.abs(c.y - cy) <= TILE / 2) {
          drain(state, a, h.damage, id, 'hazard');
          b.hazardHit = true;
        }
      }
    }
  }
}

/** Once per tick, after fixtures and before the dungeon system. */
export function bossSystem(state: SimState): void {
  const seen = eventKinds(state);
  for (const id of query(state.entities, 'boss', 'fighter', 'pos', 'pools')) {
    const b = getComp(state.entities, id, 'boss');
    const f = getComp(state.entities, id, 'fighter');
    const pools = getComp(state.entities, id, 'pools');
    const def = b ? BOSSES[b.id] : undefined;
    if (!b || !f || !pools || !def) continue;
    if (b.resolved) continue;
    if (f.state === 'dead') {
      b.resolved = 'fight';
      emit(state.events, { type: 'bossResolved', id, boss: def.id, how: 'fight' });
      continue;
    }
    for (const k of seen) if (!b.events.includes(k)) b.events.push(k);

    // A health gate holds Health at its floor until its event has been seen. It acts before the
    // phase is worked out, so a burst cannot carry Health through the floor into the next phase.
    const gated = def.phases[b.phase]?.gate;
    if (gated && !b.events.includes(gated.until)) {
      const floor = Math.ceil((pools.hpMax * gated.holdHpPct) / 100);
      if (pools.hp < floor) pools.hp = floor;
    }

    // Phases only move forward: the highest one whose trigger has been met.
    const hpPct = (pools.hp * 100) / pools.hpMax;
    let target = b.phase;
    def.phases.forEach((p, i) => {
      const met = 'hpPct' in p.enter ? hpPct <= p.enter.hpPct : b.events.includes(p.enter.event);
      if (met && i > target) target = i;
    });
    if (target !== b.phase) {
      b.phase = target;
      b.step = 0;
      b.wait = 0;
      b.phaseTick = state.tick;
      b.hazardHit = false;
      emit(state.events, { type: 'bossPhase', id, boss: def.id, phase: target });
    }
    const phase = def.phases[b.phase];
    if (!phase) continue;

    // The scripted pattern: one attack, a wait, the next, around.
    if (phase.pattern.length > 0 && f.state === 'idle' && f.hitstop === 0) {
      if (b.wait > 0) b.wait--;
      else {
        const me = centerPx(state, id);
        let aim: { x: number; y: number } | null = null;
        let best = Infinity;
        for (const a of query(state.entities, 'avatar', 'pos')) {
          if (getComp(state.entities, a, 'fighter')?.state === 'dead') continue;
          const c = centerPx(state, a);
          if (!c || !me) continue;
          const d = len({ x: c.x - me.x, y: c.y - me.y });
          if (d < best && d <= 400) {
            best = d;
            aim = c;
          }
        }
        const step = phase.pattern[b.step % phase.pattern.length];
        if (aim && step && startAttack(state, id, step.attack, aim)) {
          b.wait = step.wait;
          b.step = (b.step + 1) % phase.pattern.length;
        }
      }
    }

    const home = getComp(state.entities, id, 'ai')?.home ?? getComp(state.entities, id, 'pos');
    if (home) hazards(state, id, def, { x: home.x / SUBPX, y: home.y / SUBPX });

    // The other way out: every step of the objective graph, in order.
    if (def.objective) {
      const who = query(state.entities, 'avatar')[0] ?? null;
      for (const s of def.objective.steps) {
        if (b.done.includes(s.id) || !s.requires.every((r) => b.done.includes(r))) continue;
        if (stepDone(state, s.done, who)) {
          b.done.push(s.id);
          emit(state.events, { type: 'bossObjective', id, boss: def.id, step: s.id });
        }
      }
      if (def.objective.steps.every((s) => b.done.includes(s.id))) {
        b.resolved = 'objective';
        // The same death path as a fight, so the reward table, the ledger and any way this boss
        // keeps shut all work as they do for a kill. Only the line it is announced with differs.
        kill(state, id);
        emit(state.events, { type: 'bossResolved', id, boss: def.id, how: 'objective' });
      }
    }
  }
}
