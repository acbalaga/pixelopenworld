import { SKILLS_BALANCE as B } from '../../content/balance/skills';
import { TIME } from '../../content/balance/time';
import { ITEMS } from '../../content/items';
import { roomAt } from '../../content/world/rooms';
import { WEAPONS } from '../../content/combat/attacks';
import { SKILLS, TRIALS, type XpEvent } from '../../content/skills';
import { getComp, query, type EntityId } from '../kernel/entities';
import { SUBPX } from '../kernel/fixed';
import type { SimState } from '../state';
import { addXp, challengePct, passTrial, pointsOf } from '../skills';
import { dayPhase } from '../time';

const TILE = 16;

/** What one happening is worth to skills. `tag` and `subject` pick the rows of the mapping table. */
interface Practice {
  on: XpEvent;
  tag: string | undefined;
  /** Tier of what was fought or gathered, or 0 for no challenge. */
  tier: number;
  /** What the first-time bonus keys on: a creature, an item or a recipe. Null for none. */
  subject: string | null;
}

/** Pays every skill whose table rows match `p`. Skills are visited in id order. */
function practice(state: SimState, who: EntityId, p: Practice): void {
  const s = getComp(state.entities, who, 'skills');
  if (!s) return;
  for (const id of Object.keys(SKILLS).sort()) {
    const def = SKILLS[id];
    if (!def) continue;
    for (const src of def.sources) {
      if (src.on !== p.on || (src.tag !== undefined && src.tag !== p.tag)) continue;
      const pct = src.scaled === false ? 100 : challengePct(p.tier, s.points[id] ?? 0);
      let amount = Math.floor((src.base * pct) / 100);
      if (src.firstTime && p.subject !== null) {
        const key = `${id}:${p.on}:${p.subject}`;
        if (!s.seen.includes(key)) {
          s.seen.push(key);
          amount += src.firstTime;
        }
      }
      addXp(state, who, id, amount);
    }
  }
}

/** Keeps the avatar's weapon rank in step with the points of the skill that backs its weapon. */
function syncWeaponRank(state: SimState, who: EntityId): void {
  const cb = getComp(state.entities, who, 'combatant');
  const family = cb ? WEAPONS[cb.weapon]?.family : undefined;
  if (!cb) return;
  cb.skillRank = 0;
  if (!family) return;
  for (const id of Object.keys(SKILLS).sort()) {
    if (SKILLS[id]?.weapon === family) {
      cb.skillRank = pointsOf(state, who, id);
      return;
    }
  }
}

/** Passes a Trial that was offered and asks for the item just gathered, at the right time of day. */
function checkTrials(state: SimState, who: EntityId, item: string): void {
  const s = getComp(state.entities, who, 'skills');
  if (!s) return;
  for (const id of Object.keys(TRIALS).sort()) {
    const t = TRIALS[id];
    if (!t || !s.offered.includes(id) || t.gather.item !== item) continue;
    if (t.gather.phases.includes(dayPhase(state.worldTick))) passTrial(state, who, id);
  }
}

/** Distance run while sprinting, paid in steps. Teleports and respawns are ignored. */
function sprint(state: SimState, who: EntityId): void {
  const s = getComp(state.entities, who, 'skills');
  const a = getComp(state.entities, who, 'avatar');
  const p = getComp(state.entities, who, 'pos');
  if (!s || !a || !p) return;
  const dx = Math.abs(p.x - s.stride.x);
  const dy = Math.abs(p.y - s.stride.y);
  s.stride.x = p.x;
  s.stride.y = p.y;
  if (!a.sprinting) return;
  // Integer estimate of the length: exact on the axes, within 3% on diagonals.
  const dist = Math.max(dx, dy) + ((Math.min(dx, dy) * 3) >> 3);
  if (dist === 0 || dist > B.sprintMaxStepPx * SUBPX) return;
  s.stride.acc += dist;
  const step = B.sprintPx * SUBPX;
  while (s.stride.acc >= step) {
    s.stride.acc -= step;
    practice(state, who, { on: 'sprint', tag: undefined, tier: 0, subject: null });
  }
}

/**
 * Survival: one payment for each in-game hour of night spent in a room marked outdoors. Time is
 * counted a tick at a time, so an hour is the sum of visits, not one moment on a boundary.
 */
function outdoorsNight(state: SimState, who: EntityId): void {
  const s = getComp(state.entities, who, 'skills');
  const p = getComp(state.entities, who, 'pos');
  if (!s || !p || getComp(state.entities, who, 'fighter')?.state === 'dead') return;
  if (dayPhase(state.worldTick) !== 'night') return;
  const room = roomAt(Math.floor(p.x / SUBPX / TILE), Math.floor((p.y / SUBPX - 1) / TILE));
  if (!room?.outdoors) return;
  s.nightAcc += 1;
  while (s.nightAcc >= TIME.hourTicks) {
    s.nightAcc -= TIME.hourTicks;
    practice(state, who, { on: 'outdoorsNight', tag: undefined, tier: 0, subject: null });
  }
}

/**
 * Turns this tick's sim events into skill XP for each avatar. Runs last, so it sees everything
 * the other systems sent. Events it sends itself are appended after the ones it reads.
 */
export function skillsSystem(state: SimState): void {
  const count = state.events.list.length;
  for (const who of query(state.entities, 'avatar', 'skills')) {
    for (let i = 0; i < count; i++) {
      const e = state.events.list[i];
      if (!e) continue;
      if (e.type === 'damageDealt' && e.src === who) {
        const target = getComp(state.entities, e.dst, 'combatant');
        const dead = getComp(state.entities, e.dst, 'fighter')?.state === 'dead';
        practice(state, who, {
          on: 'damage',
          tag: e.tag,
          tier: target?.tier ?? 0,
          subject: dead ? (target?.kind ?? null) : null,
        });
      } else if (e.type === 'dodged' && e.dst === who) {
        const attacker = getComp(state.entities, e.src, 'combatant');
        practice(state, who, {
          on: 'dodge',
          tag: undefined,
          tier: attacker?.tier ?? 0,
          subject: null,
        });
      } else if (e.type === 'gathered' && e.id === who) {
        practice(state, who, { on: 'gather', tag: e.tag, tier: e.tier, subject: e.item });
        checkTrials(state, who, e.item);
      } else if (e.type === 'cooked' && e.id === who) {
        // Cooking is the craft event with tag `cooking`.
        practice(state, who, { on: 'craft', tag: e.tag, tier: e.tier, subject: e.recipe });
      } else if (e.type === 'eaten' && e.id === who && ITEMS[e.item]?.food?.raw) {
        practice(state, who, { on: 'eatRaw', tag: undefined, tier: 0, subject: null });
      } else if (e.type === 'tabletRead' && e.who === who) {
        const kind = getComp(state.entities, e.id, 'fixture')?.kind ?? null;
        practice(state, who, { on: 'tabletRead', tag: undefined, tier: 0, subject: kind });
      }
    }
    sprint(state, who);
    outdoorsNight(state, who);
    syncWeaponRank(state, who);
  }
}
