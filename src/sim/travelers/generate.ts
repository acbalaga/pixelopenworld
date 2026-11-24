import { CREATURES } from '../../content/creatures';
import { NPCS } from '../../content/dialogue';
import { PLACES } from '../../content/people/places';
import { SKILLS } from '../../content/skills';
import {
  MAIN_HANDS,
  randomDoll,
  type DollSpec,
  type HairColor,
  type HairStyle,
  type MainHand,
} from '../../content/dolls/parts';
import {
  ARCHETYPE_WEIGHTS,
  ARMED_CHANCE,
  CULTURE_WEIGHTS,
  FOCUS_COUNT_MAX,
  FOCUS_COUNT_MIN,
  FOCUS_WEIGHTS,
  GUILD_AFFINITY,
  GUILD_START_SHARE,
  HAND_TUNED_COUNT,
  HANDLE_REROLLS,
  HOME_WEIGHTS,
  PACE_RANGE,
  PHASE_SHIFT_MAX,
  PHASE_SHIFT_MIN,
  PLATEAU_RANGE,
  SCHEDULE_WEIGHTS,
  START_COIN,
  START_POINTS,
  TEMPER_WEIGHTS,
  TIE_CHANCE,
  TIE_KIND_WEIGHTS,
  TIE_MAX,
  TRAVELER_COUNT,
  VOICE_AFFINITY,
} from '../../content/balance/travelers';
import { isBlocked } from '../../content/travelers/blocklist';
import { HAND_TUNED } from '../../content/travelers/handTuned';
import * as N from '../../content/travelers/names';
import type { Tie } from '../../content/travelers/types';
import { type Culture } from '../../content/travelers/names';
import { ACTIVITIES } from '../../content/travelers/types';
import { chance, createStream, int, next, pick, weighted, type Rng } from '../kernel/rng';
import { PLACE_LIST, SKILL_LIST, skillIdx } from './lists';
import type { TravelerIdentity, TravelerLife } from './types';

/**
 * Traveler identities and starting lives (POW-M5-02, design/12). Everything here is a pure
 * function of the world seed and the slot. The table is built once per seed, in slot order,
 * because a handle must be unique against the slots before it. All randomness comes from the
 * `travelers` stream family, never the save's own streams.
 */

/** Handle comparison form: lowercase, `_`, `.` and `-` removed, and padding `x` trimmed. */
export function normalizeHandle(handle: string): string {
  const s = handle.toLowerCase().replace(/[_.-]/g, '');
  const trimmed = s.replace(/^x+|x+$/g, '');
  return trimmed.length >= 3 ? trimmed : s;
}

/** Names the game already uses, in comparison form. A handle may not equal any of them. */
let contentNames: Set<string> | null = null;
function reservedNames(): Set<string> {
  if (contentNames) return contentNames;
  const out = new Set<string>();
  const add = (s: string): void => {
    out.add(normalizeHandle(s));
  };
  for (const n of Object.values(NPCS)) add(n.name);
  for (const c of Object.values(CREATURES)) add(c.name);
  for (const s of Object.values(SKILLS)) add(s.name);
  for (const id of Object.keys(PLACES)) add((id.split('.').pop() ?? id).replace(/_/g, ' '));
  contentNames = out;
  return out;
}

const cap = (s: string): string => (s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1));

function mixSeed(seed: number, slot: number): number {
  return (seed ^ Math.imul(slot + 1, 0x9e3779b1)) >>> 0;
}

/** The stream for one slot. Hand-tuned Travelers use a fixed seed so they look the same in every save. */
function slotStream(seed: number, slot: number, salt = 0): Rng {
  return createStream(mixSeed((seed ^ salt) >>> 0, slot), 'travelers');
}

const digits = (r: Rng): string => String(int(r, 2, 99));

/** One handle in the style of a naming culture (design/12 section 2). */
function draw(culture: Culture, r: Rng): string {
  switch (culture) {
    case 'plain':
      return pick(r, N.PLAIN_NAMES);
    case 'gamer': {
      const k = int(r, 0, 3);
      if (k === 0) return pick(r, N.GAMER_WORDS) + digits(r);
      if (k === 1) {
        const w = pick(r, N.GAMER_WORDS);
        return `x${w}x`;
      }
      if (k === 2)
        return pick(r, N.GAMER_PREFIX) + pick(r, N.GAMER_SUFFIX_WORD) + pick(r, N.GAMER_TAILS);
      return pick(r, N.GAMER_WORDS) + pick(r, N.GAMER_TAILS);
    }
    case 'lowercase': {
      const k = int(r, 0, 2);
      if (k === 0) return pick(r, N.LOWER_PREFIX) + pick(r, N.LOWER_NOUN);
      if (k === 1) return `${pick(r, N.LOWER_NOUN)}_`;
      return `${pick(r, N.LOWER_PREFIX)}_${pick(r, N.LOWER_NOUN)}`;
    }
    case 'silly': {
      const k = int(r, 0, 2);
      if (k === 0) return pick(r, N.SILLY_FOOD) + pick(r, N.SILLY_TITLE);
      if (k === 1) return `${pick(r, N.SILLY_LOWER_TITLE)}_${pick(r, N.SILLY_FOOD).toLowerCase()}`;
      return `${pick(r, N.SILLY_TITLE)}Of${pick(r, N.SILLY_FOOD)}`;
    }
    case 'fantasy': {
      const mid = chance(r, 0.5) ? pick(r, N.FANTASY_MID) : '';
      return cap(pick(r, N.FANTASY_START).toLowerCase() + mid + pick(r, N.FANTASY_END));
    }
    case 'compound': {
      if (chance(r, 0.35)) return `${pick(r, N.COMPOUND_WORDS)}And${pick(r, N.COMPOUND_WORDS)}`;
      return pick(r, N.COMPOUND_WORDS) + pick(r, N.COMPOUND_WORDS);
    }
  }
}

const FALLBACK_WORDS = ['Wanderer', 'Wayfarer', 'Roamer', 'Pilgrim', 'Drifter', 'Rambler'];

/**
 * A handle for a slot, unique by normalized comparison against `taken`, outside the blocklist and
 * clear of the game's own names. After the bounded rerolls a fallback pattern is used: a plain word
 * and the slot number, which is always safe and always unique.
 */
export function pickHandle(r: Rng, slot: number, taken: ReadonlySet<string>): string {
  const reserved = reservedNames();
  const ok = (h: string): boolean =>
    h.length >= 3 &&
    h.length <= 16 &&
    /^[A-Za-z0-9_.-]+$/.test(h) &&
    !taken.has(normalizeHandle(h)) &&
    !reserved.has(normalizeHandle(h)) &&
    !isBlocked(h);
  for (let i = 0; i < HANDLE_REROLLS; i++) {
    const h = draw(weighted(r, CULTURE_WEIGHTS), r);
    if (ok(h)) return h;
  }
  for (const w of FALLBACK_WORDS) {
    const h = `${w}${slot}`;
    if (ok(h)) return h;
  }
  return `Traveler${slot}`;
}

const rangeInt = (r: Rng, [lo, hi]: readonly [number, number]): number => int(r, lo, hi);
const rangeFloat = (r: Rng, [lo, hi]: readonly [number, number]): number =>
  Math.round((lo + next(r) * (hi - lo)) * 100) / 100;

/** Weapon hands a focus skill suggests. */
const HANDS_FOR: Record<string, readonly MainHand[]> = {
  'skill.blades': ['sword', 'dagger'],
  'skill.heavy_arms': ['maul'],
  'skill.polearms': ['spear'],
  'skill.archery': ['bow'],
  'skill.unarmed': ['wraps'],
  'skill.ember': ['staff'],
  'skill.tide': ['staff'],
  'skill.gale': ['staff'],
  'skill.stone': ['staff'],
  'skill.mending': ['staff'],
  'skill.hexing': ['staff'],
};

function weightedDistinct(
  r: Rng,
  table: readonly (readonly [string, number])[],
  count: number,
): string[] {
  const left = [...table];
  const out: string[] = [];
  while (out.length < count && left.length > 0) {
    const pickIdx = ((): number => {
      const total = left.reduce((a, [, w]) => a + w, 0);
      let x = next(r) * total;
      for (let i = 0; i < left.length; i++) {
        x -= left[i]![1];
        if (x < 0) return i;
      }
      return left.length - 1;
    })();
    out.push(left[pickIdx]![0]);
    left.splice(pickIdx, 1);
  }
  return out;
}

const pairKey = (hair: string, color: string): string => `${hair}|${color}`;

interface Build {
  ids: TravelerIdentity[];
  pairUse: Map<string, number>;
}

function handTunedIdentity(seed: number, slot: number): TravelerIdentity {
  const def = HAND_TUNED[slot]!;
  // The look comes from a stream that ignores the world seed: the same person in every save.
  const lr = slotStream(0, slot, 0x00c0ffee);
  const doll = randomDoll(() => next(lr));
  const look: DollSpec = {
    ...doll,
    hair: def.look.hair as HairStyle,
    hairColor: def.look.hairColor as HairColor,
  };
  const r = slotStream(seed, slot);
  return {
    slot,
    handle: def.handle,
    look,
    archetype: def.archetype,
    focus: [...def.focus],
    voice: def.voice,
    schedule: def.schedule,
    phase: int(r, PHASE_SHIFT_MIN, PHASE_SHIFT_MAX),
    home: def.home,
    guild: def.guild,
    pace: def.pace ?? rangeFloat(r, PACE_RANGE[def.archetype]),
    temper: def.temper,
    plateau: def.plateau ?? rangeInt(r, PLATEAU_RANGE[def.archetype]),
    ties: def.ties.map((t) => ({ ...t })),
  };
}

function generatedIdentity(
  seed: number,
  slot: number,
  taken: ReadonlySet<string>,
  b: Build,
): TravelerIdentity {
  const r = slotStream(seed, slot);
  const archetype = weighted(r, ARCHETYPE_WEIGHTS);
  const focusCount = int(r, FOCUS_COUNT_MIN, FOCUS_COUNT_MAX);
  const focus = weightedDistinct(r, FOCUS_WEIGHTS[archetype], focusCount);
  const handle = pickHandle(r, slot, taken);

  // The look: the lightest-used hair pair out of a few draws, so the crowd reads varied.
  let best: DollSpec | null = null;
  let bestUse = Infinity;
  for (let i = 0; i < 6; i++) {
    const d = randomDoll(() => next(r));
    const use = b.pairUse.get(pairKey(d.hair, d.hairColor)) ?? 0;
    if (use < bestUse) {
      best = d;
      bestUse = use;
    }
  }
  const look: DollSpec = { ...best! };
  const armed = chance(r, ARMED_CHANCE[archetype]);
  const hands = focus.flatMap((f) => HANDS_FOR[f] ?? []);
  look.mainHand = armed
    ? hands.length > 0
      ? pick(r, hands)
      : pick(
          r,
          MAIN_HANDS.filter((h) => h !== 'none'),
        )
    : 'none';
  if (look.mainHand === 'none' && look.offHand === 'shield') look.offHand = 'none';
  b.pairUse.set(pairKey(look.hair, look.hairColor), bestUse + 1);

  const voice = weighted(r, VOICE_AFFINITY[archetype]);
  const schedule = weighted(r, SCHEDULE_WEIGHTS);
  const home = weighted(r, HOME_WEIGHTS);
  const guild = chance(r, GUILD_START_SHARE) ? weighted(r, GUILD_AFFINITY[archetype]) : 0;
  return {
    slot,
    handle,
    look,
    archetype,
    focus,
    voice,
    schedule,
    phase: int(r, PHASE_SHIFT_MIN, PHASE_SHIFT_MAX),
    home,
    guild,
    pace: rangeFloat(r, PACE_RANGE[archetype]),
    temper: weighted(r, TEMPER_WEIGHTS[archetype]),
    plateau: rangeInt(r, PLATEAU_RANGE[archetype]),
    ties: [],
  };
}

/** Adds a few ties between generated Travelers, symmetric, after every identity exists. */
function assignTies(seed: number, ids: TravelerIdentity[]): void {
  const r = createStream((seed ^ 0x71e5) >>> 0, 'travelers');
  const ties = ids.map((t) => [...t.ties] as Tie[]);
  for (let slot = HAND_TUNED_COUNT; slot < ids.length; slot++) {
    if (ties[slot]!.length >= TIE_MAX || !chance(r, TIE_CHANCE)) continue;
    const me = ids[slot]!;
    const pool: number[] = [];
    for (let o = HAND_TUNED_COUNT; o < ids.length; o++) {
      if (o === slot || ties[o]!.length >= TIE_MAX) continue;
      if (ties[slot]!.some((t) => t.slot === o)) continue;
      const other = ids[o]!;
      if ((me.guild !== 0 && other.guild === me.guild) || other.home === me.home) pool.push(o);
    }
    if (pool.length === 0) continue;
    const o = pick(r, pool);
    const kind = weighted(r, TIE_KIND_WEIGHTS);
    ties[slot]!.push({ slot: o, kind });
    ties[o]!.push({ slot, kind });
  }
  for (let i = 0; i < ids.length; i++) ids[i] = { ...ids[i]!, ties: ties[i]! };
}

function buildAll(seed: number): TravelerIdentity[] {
  const b: Build = { ids: [], pairUse: new Map() };
  const taken = new Set<string>();
  for (let slot = 0; slot < TRAVELER_COUNT; slot++) {
    const id =
      slot < HAND_TUNED_COUNT
        ? handTunedIdentity(seed, slot)
        : generatedIdentity(seed, slot, taken, b);
    taken.add(normalizeHandle(id.handle));
    if (slot < HAND_TUNED_COUNT) {
      const k = pairKey(id.look.hair, id.look.hairColor);
      b.pairUse.set(k, (b.pairUse.get(k) ?? 0) + 1);
    }
    b.ids.push(id);
  }
  assignTies(seed, b.ids);
  return b.ids;
}

const cache = new Map<number, readonly TravelerIdentity[]>();
const CACHE_MAX = 4;

/** All 240 identities for a world seed. Pure; the result is memoized and must not be mutated. */
export function identitiesOf(worldSeed: number): readonly TravelerIdentity[] {
  const seed = worldSeed >>> 0;
  const hit = cache.get(seed);
  if (hit) return hit;
  const built = buildAll(seed);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as number);
  cache.set(seed, built);
  return built;
}

/** One Traveler's identity. Pure and deterministic in the seed and slot. */
export function identityOf(worldSeed: number, slot: number): TravelerIdentity {
  const all = identitiesOf(worldSeed);
  const t = all[slot];
  if (!t) throw new Error(`no traveler in slot ${slot}`);
  return t;
}

function hashText(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Where a Traveler waits before the first schedule tick, as weights. */
const START_PLACES: readonly (readonly [string, number])[] = [
  ['hearthford.square', 3],
  ['hearthford.inn', 3],
  ['hearthford.market_street', 2],
  ['hearthford.smithy', 1],
  ['hearthford.guard_yard', 1],
  ['millbrook.fields', 1],
  ['reedmouth.jetty', 1],
  ['stonecrop.quarry', 1],
];

/** The life a Traveler has when the save begins. Pure in the identity. */
export function initialLife(t: TravelerIdentity): TravelerLife {
  const r = createStream(
    (hashText(t.handle) ^ Math.imul(t.slot + 1, 0x85ebca6b)) >>> 0,
    'travelers',
  );
  const build: [number, number][] = [];
  for (const skill of t.focus) {
    const i = skillIdx(skill);
    if (i < 0) throw new Error(`unknown focus skill ${skill}`);
    const pts = Math.min(t.plateau, rangeInt(r, START_POINTS[t.archetype]));
    if (pts > 0) build.push([i, pts]);
  }
  build.sort((a, b) => a[0] - b[0]);
  const place = PLACE_LIST.indexOf(weighted(r, START_PLACES));
  return {
    build,
    paths: 0,
    coin: rangeInt(r, START_COIN[t.archetype]),
    place: Math.max(0, place),
    activity: ACTIVITIES.indexOf('social'),
    subject: 0,
    guild: t.guild,
    regardTier: 0,
    regardPts: 0,
    flags: 0,
    memory: [],
    lastSeen: 0,
    lineCursor: 0,
  };
}

/** The 240 starting lives for a world seed. */
export function initialLives(worldSeed: number): TravelerLife[] {
  return identitiesOf(worldSeed).map(initialLife);
}

export { SKILL_LIST, PLACE_LIST };
