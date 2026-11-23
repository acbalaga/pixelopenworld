import { SKILLS_BALANCE as B } from '../../content/balance/skills';
import { TIME } from '../../content/balance/time';
import { ITEMS } from '../../content/items';
import { roomAt } from '../../content/world/rooms';
import { FIXTURES } from '../../content/world/fixtures';
import { inSettlement } from '../../content/world/settlements';
import { WEAPONS } from '../../content/combat/attacks';
import { TECHNIQUE_LIST } from '../../content/combat/techniques';
import { countInsight } from '../combat/techniques';
import { SKILLS, type XpEvent } from '../../content/skills';
import { getComp, query, type EntityId } from '../kernel/entities';
import { emit, type SimEvent } from '../kernel/events';
import { SUBPX } from '../kernel/fixed';
import type { SimState } from '../state';
import { addXp, challengePct, pointsOf } from '../skills';
import { dayIndex, dayPhase } from '../time';

const TILE = 16;

/** What one happening is worth to skills. `tag` and `subject` pick the rows of the mapping table. */
interface Practice {
  on: XpEvent;
  tag: string | undefined;
  /** Tier of what was fought or gathered, or 0 for no challenge. */
  tier: number;
  /** What the first-time bonus keys on: a creature, an item or a recipe. Null for none. */
  subject: string | null;
  /** The target was a training dummy: it counts toward insight only while the skill is young. */
  dummy?: boolean;
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
      if (amount > 0) insight(state, who, id, p);
    }
  }
}

/** Counts a paid use toward every insight technique of the skill that follows this event. */
function insight(state: SimState, who: EntityId, skill: string, p: Practice): void {
  const s = getComp(state.entities, who, 'skills');
  if (!s) return;
  if (p.dummy && (s.points[skill] ?? 0) >= B.dummyInsightUntil) return;
  for (const t of TECHNIQUE_LIST) {
    if (t.skill !== skill || t.source !== 'insight' || !t.insight) continue;
    if (t.insight.event !== p.on || (t.insight.tag !== undefined && t.insight.tag !== p.tag))
      continue;
    countInsight(state, who, t);
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
  const room = roomAt(
    Math.floor(p.x / SUBPX / TILE),
    Math.floor((p.y / SUBPX - 1) / TILE),
    state.region ?? 'slice',
  );
  if (!room?.outdoors) return;
  s.nightAcc += 1;
  while (s.nightAcc >= TIME.hourTicks) {
    s.nightAcc -= TIME.hourTicks;
    practice(state, who, { on: 'outdoorsNight', tag: undefined, tier: 0, subject: null });
  }
}

/** The event types `skillsSystem` reads. A system that sends one must run before it (see `WORLD_SYSTEMS`). */
export const SKILLS_READS = [
  'damageDealt',
  'statusApplied',
  'sneak',
  'perform',
  'healed',
  'haggleWon',
  'sold',
  'perfectDodge',
  'dodged',
  'blocked',
  'parried',
  'gathered',
  'crafted',
  'repaired',
  'eaten',
  'delved',
  'blockSolved',
  'dungeonCleared',
  'revealed',
  'tabletRead',
  'manualRead',
  'sleptOutdoors',
] as const satisfies readonly SimEvent['type'][];

/** The tile the avatar's feet are on. */
function feetTile(p: { x: number; y: number }): { tx: number; ty: number } {
  return { tx: Math.floor(p.x / SUBPX / TILE), ty: Math.floor((p.y / SUBPX - 1) / TILE) };
}

/**
 * What a tablet's first-time lump keys on (POW-M4-23E): the kind, the tile it stands on and the
 * reader's Deciphering band. A tablet read again in the same band pays nothing, and a new band
 * makes every tablet pay once more. Null when the tablet is not a fixture.
 */
function tabletSubject(state: SimState, who: EntityId, id: EntityId): string | null {
  const f = getComp(state.entities, id, 'fixture');
  if (!f) return null;
  const { tx, ty } = feetTile(f.home);
  const points = getComp(state.entities, who, 'skills')?.points['skill.deciphering'] ?? 0;
  return `${f.kind}@${tx},${ty}#${Math.floor(points / B.deciphering.bandSize)}`;
}

/** Survival: sleeping outdoors pays a lump, at most once an in-game hour. */
function sleepPay(state: SimState, who: EntityId): void {
  const s = getComp(state.entities, who, 'skills');
  if (!s) return;
  const hour = Math.floor(state.worldTick / TIME.hourTicks);
  if (s.camp.sleepHour === hour) return;
  s.camp.sleepHour = hour;
  practice(state, who, { on: 'sleepOutdoors', tag: undefined, tier: 0, subject: null });
}

/** The camp (a `rest` fixture) within `campRadius` tiles of the feet, as its tile key, or null. */
function campNear(state: SimState, tx: number, ty: number): string | null {
  const r = B.survival.campRadius;
  let best: string | null = null;
  let bestD = Infinity;
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const kind = getComp(state.entities, id, 'fixture')?.kind;
    if (!kind || FIXTURES[kind]?.type !== 'rest') continue;
    const q = getComp(state.entities, id, 'pos');
    if (!q) continue;
    const c = feetTile(q);
    const d = Math.hypot(c.tx - tx, c.ty - ty);
    if (d <= r && d < bestD) {
      bestD = d;
      best = `${c.tx},${c.ty}`;
    }
  }
  return best;
}

/**
 * Survival: standing still at a camp, outdoors and outside every settlement, pays
 * `campXpPerMinute` for each full minute, up to `campMinutesPerDay` a day for each camp. A move,
 * a hit or a death drops the partial minute. `eventCount` is how many events of this tick came
 * before the ones this system sent.
 */
function camping(state: SimState, who: EntityId, eventCount: number): void {
  const s = getComp(state.entities, who, 'skills');
  const p = getComp(state.entities, who, 'pos');
  const a = getComp(state.entities, who, 'avatar');
  if (!s || !p || !a) return;
  const stop = (): void => {
    s.camp.at = null;
    s.camp.acc = 0;
  };
  const hurt = state.events.list
    .slice(0, eventCount)
    .some((e) => e.type === 'damageDealt' && e.dst === who && e.amount > 0);
  if (getComp(state.entities, who, 'fighter')?.state !== 'idle' || a.intent !== null || hurt)
    return stop();
  const { tx, ty } = feetTile(p);
  const region = state.region ?? 'slice';
  if (!roomAt(tx, ty, region)?.outdoors || inSettlement(region, tx, ty)) return stop();
  const camp = campNear(state, tx, ty);
  if (camp === null) return stop();
  const day = dayIndex(state.worldTick);
  const used = (s.camp.used[camp] ??= { day, min: 0 });
  if (used.day !== day) {
    used.day = day;
    used.min = 0;
  }
  if (used.min >= B.survival.campMinutesPerDay) return stop();
  if (s.camp.at !== camp) {
    s.camp.at = camp;
    s.camp.acc = 0;
    emit(state.events, { type: 'campSettled', who });
  }
  s.camp.acc += 1;
  if (s.camp.acc < TIME.ticksPerMinute) return;
  s.camp.acc = 0;
  used.min += 1;
  practice(state, who, { on: 'camp', tag: undefined, tier: 0, subject: null });
  if (used.min >= B.survival.campMinutesPerDay) {
    emit(state.events, { type: 'campSpent', who });
    s.camp.at = null;
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
          dummy: target?.kind === 'creature.training_dummy',
        });
      } else if (e.type === 'statusApplied' && e.src === who && e.id !== who) {
        const target = getComp(state.entities, e.id, 'combatant');
        practice(state, who, {
          on: 'statusApplied',
          tag: e.status,
          tier: target?.tier ?? 0,
          subject: target?.kind ?? null,
        });
      } else if (e.type === 'sneak' && e.who === who) {
        practice(state, who, {
          on: 'sneak',
          tag: undefined,
          tier: 0,
          subject: getComp(state.entities, e.creature, 'combatant')?.kind ?? null,
        });
      } else if (e.type === 'perform' && e.who === who) {
        practice(state, who, { on: 'perform', tag: undefined, tier: 0, subject: e.technique });
      } else if (e.type === 'healed' && e.src === who && e.tag === 'mending') {
        practice(state, who, { on: 'heal', tag: undefined, tier: 0, subject: null });
      } else if (e.type === 'haggleWon' && e.who === who) {
        practice(state, who, { on: 'haggle', tag: undefined, tier: 0, subject: e.shop });
      } else if (e.type === 'sold' && e.who === who) {
        practice(state, who, { on: 'sale', tag: undefined, tier: 0, subject: null });
      } else if (e.type === 'perfectDodge' && e.id === who) {
        // A perfect dodge pays no XP of its own. It only counts toward Light Feet.
        for (const t of TECHNIQUE_LIST)
          if (t.source === 'insight' && t.insight?.event === 'perfectDodge')
            countInsight(state, who, t);
      } else if (e.type === 'dodged' && e.dst === who) {
        const attacker = getComp(state.entities, e.src, 'combatant');
        practice(state, who, {
          on: 'dodge',
          tag: undefined,
          tier: attacker?.tier ?? 0,
          subject: null,
        });
      } else if ((e.type === 'blocked' || e.type === 'parried') && e.who === who) {
        const attacker = getComp(state.entities, e.src, 'combatant');
        practice(state, who, {
          on: e.type === 'blocked' ? 'block' : 'parry',
          tag: undefined,
          tier: attacker?.tier ?? 0,
          subject: null,
        });
      } else if (e.type === 'gathered' && e.id === who) {
        practice(state, who, { on: 'gather', tag: e.tag, tier: e.tier, subject: e.item });
      } else if (e.type === 'crafted' && e.id === who) {
        // Every craft sends the craft event with its own tag (cooking, smithing, ...).
        practice(state, who, { on: 'craft', tag: e.tag, tier: e.tier, subject: e.recipe });
      } else if (e.type === 'repaired' && e.id === who) {
        practice(state, who, { on: 'repair', tag: undefined, tier: e.tier, subject: null });
      } else if (e.type === 'eaten' && e.id === who && ITEMS[e.item]?.food?.raw) {
        practice(state, who, { on: 'eatRaw', tag: undefined, tier: 0, subject: null });
      } else if (e.type === 'delved' && e.who === who) {
        practice(state, who, { on: 'delveRoom', tag: undefined, tier: 0, subject: e.room });
      } else if (e.type === 'blockSolved') {
        const f = getComp(state.entities, e.id, 'fixture');
        practice(state, who, {
          on: 'delveBlock',
          tag: undefined,
          tier: 0,
          subject: f ? `${f.kind}@${f.home.x},${f.home.y}` : null,
        });
      } else if (e.type === 'dungeonCleared' && e.who === who) {
        practice(state, who, { on: 'delveClear', tag: undefined, tier: 0, subject: e.dungeon });
      } else if (e.type === 'revealed' && e.who === who) {
        for (let n = 0; n < e.blocks; n++)
          practice(state, who, { on: 'reveal', tag: undefined, tier: 0, subject: null });
      } else if (e.type === 'sleptOutdoors' && e.who === who) {
        sleepPay(state, who);
      } else if (e.type === 'tabletRead' && e.who === who) {
        practice(state, who, {
          on: 'tabletRead',
          tag: undefined,
          tier: 0,
          subject: tabletSubject(state, who, e.id),
        });
      } else if (e.type === 'manualRead' && e.who === who) {
        practice(state, who, { on: 'manualRead', tag: undefined, tier: 0, subject: e.item });
      }
    }
    sprint(state, who);
    outdoorsNight(state, who);
    camping(state, who, count);
    syncWeaponRank(state, who);
  }
}
