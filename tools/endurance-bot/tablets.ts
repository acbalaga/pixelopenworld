/**
 * Deciphering route model (POW-M4-23E). Reads every tablet and every manual chest on the baked
 * Dawnmeadow, the walking time between them over the real geometry with portals, and plays the
 * reading plan against the real curve and the shipped tunables: one tour through every tablet and
 * manual, then tablet tours until the skill has 14 points and a full bar.
 *
 *   npx tsx tools/endurance-bot/tablets.ts [--band 2] [--tablet 120] [--manual 100]
 */
import { MOVEMENT } from '../../src/content/balance/movement';
import { SKILLS_BALANCE } from '../../src/content/balance/skills';
import { DAWNMEADOW_WAKE_POINTS } from '../../src/content/world/wake';
import { FIXTURES } from '../../src/content/world/fixtures';
import { xpToNext } from '../../src/sim/skills';
import { loadDawnmeadow, walkable } from './world';

const arg = (n: string): number | undefined => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? Number(process.argv[i + 1]) : undefined;
};
const D = SKILLS_BALANCE.deciphering;
const BAND = arg('--band') ?? D.bandSize;
const TABLET_XP = arg('--tablet') ?? D.tabletXp;
const MANUAL_XP = arg('--manual') ?? D.manualXp;
const TPS = 30;
const WALK = (MOVEMENT.walkSpeed / 256 / 16) * TPS;
/** Seconds spent reading or opening a chest at each stop. */
const STOP_S = 3;

const L = loadDawnmeadow();
const g = L.grid;
const W = L.w;
const H = L.h;
const idx = (x: number, y: number): number => y * W + x;

// Portals: standing on one lands the avatar beside its partner (the same model as map.ts).
const byKind = new Map<string, { x: number; y: number }>();
for (const o of L.objects)
  if (FIXTURES[o.kind]?.type === 'portal' || FIXTURES[o.kind]?.type === 'arrival')
    byKind.set(o.kind, o);
const jump = new Map<number, number>();
for (const p of L.portals) {
  if (p.locked) continue;
  const d = byKind.get(p.to) ?? FIXTURES[p.to]?.at;
  if (!d) continue;
  const off = FIXTURES[p.to]?.arrive ?? [0, 0];
  let ax = Math.floor((d.x * 16 + 8 + off[0]) / 16);
  let ay = Math.floor((d.y * 16 + 8 + off[1] - 1) / 16);
  if (!walkable(g, ax, ay))
    search: for (let r = 1; r <= 2; r++)
      for (let oy = -r; oy <= r; oy++)
        for (let ox = -r; ox <= r; ox++)
          if (walkable(g, ax + ox, ay + oy)) {
            ax += ox;
            ay += oy;
            break search;
          }
  jump.set(idx(p.x, p.y), idx(ax, ay));
}

/** Tiles walked from (sx, sy) to every tile, taking portals. -1 where it cannot be reached. */
function dist(sx: number, sy: number): Int32Array {
  const d = new Int32Array(W * H).fill(-1);
  const q = new Int32Array(W * H);
  let h = 0;
  let t = 0;
  const s = idx(sx, sy);
  d[s] = 0;
  q[t++] = s;
  while (h < t) {
    const c = q[h++]!;
    const x = c % W;
    const j = jump.get(c);
    const nb = j !== undefined && c !== s ? [j] : [c - W, c + 1, c + W, c - 1];
    for (const n of nb) {
      if (n < 0 || n >= W * H || d[n] !== -1) continue;
      const nx = n % W;
      if (n !== j && Math.abs(nx - x) > 1) continue;
      if (!walkable(g, nx, (n - nx) / W)) continue;
      d[n] = d[c]! + 1;
      q[t++] = n;
    }
  }
  return d;
}

/** The nearest open tile beside an object, which stands on a solid tile. */
function near(d: Int32Array, o: { x: number; y: number }): number {
  let best = -1;
  for (const [ox, oy] of [
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -1],
    [0, 0],
  ] as const) {
    const v = d[idx(o.x + ox, o.y + oy)] ?? -1;
    if (v >= 0 && (best < 0 || v < best)) best = v;
  }
  return best;
}

export interface Stop {
  kind: 'tablet' | 'manual';
  name: string;
  x: number;
  y: number;
}

export const STOPS: Stop[] = L.objects.flatMap<Stop>((o) =>
  FIXTURES[o.kind]?.type === 'tablet'
    ? [{ kind: 'tablet', name: o.kind, x: o.x, y: o.y }]
    : o.kind.startsWith('fixture.chest_manual')
      ? [{ kind: 'manual', name: o.kind, x: o.x, y: o.y }]
      : [],
);

const wake = DAWNMEADOW_WAKE_POINTS['w3'];
const from = new Map<string, Int32Array>();
const key = (s: { x: number; y: number }): string => `${s.x},${s.y}`;
from.set('wake', dist(wake.x, wake.y));
for (const s of STOPS) from.set(key(s), dist(s.x, s.y + 1));
const walkTiles = (a: string, b: Stop): number => near(from.get(a)!, b);

/** Nearest-neighbour tour over `stops` from `start`. Returns tiles walked and the unreached. */
function tour(startKey: string, stops: Stop[]): { tiles: number; last: string; missed: Stop[] } {
  const left = [...stops];
  let cur = startKey;
  let tiles = 0;
  const missed: Stop[] = [];
  while (left.length) {
    let bi = -1;
    let bd = Infinity;
    left.forEach((s, i) => {
      const v = walkTiles(cur, s);
      if (v >= 0 && v < bd) {
        bd = v;
        bi = i;
      }
    });
    if (bi < 0) {
      missed.push(...left);
      break;
    }
    tiles += bd;
    const s = left.splice(bi, 1)[0]!;
    cur = key(s);
  }
  return { tiles, last: cur, missed };
}

export function plan() {
  const tablets = STOPS.filter((s) => s.kind === 'tablet');
  const manuals = STOPS.filter((s) => s.kind === 'manual');
  const first = tour('wake', STOPS);
  const again = tour(first.last, tablets);
  const minutes = (tiles: number, stops: number): number => (tiles / WALK + stops * STOP_S) / 60;

  // Play the plan. Points rise as XP pays; a tablet pays once per band, so a tour pays the tablets
  // that have not been read in the band the reader is in when it reaches them.
  let points = 0;
  let bar = 0;
  let min = minutes(first.tiles, STOPS.length);
  let tours = 1;
  const seen = new Set<string>();
  const gain = (n: number): void => {
    bar += n;
    while (points < 14 && bar >= xpToNext(points)) {
      bar -= xpToNext(points);
      points++;
    }
  };
  const read = (s: Stop): void => {
    const k = `${key(s)}#${Math.floor(points / BAND)}`;
    if (!seen.has(k)) {
      seen.add(k);
      gain(TABLET_XP);
    }
  };
  for (const s of STOPS) if (s.kind === 'manual') gain(MANUAL_XP);
  for (const s of tablets) read(s);
  while (!(points >= 14 && bar >= xpToNext(14)) && tours < 40) {
    for (const s of tablets) read(s);
    min += minutes(again.tiles, tablets.length);
    tours++;
  }

  return {
    tablets: tablets.length,
    manuals: manuals.length,
    bandSize: BAND,
    tabletXp: TABLET_XP,
    manualXp: MANUAL_XP,
    firstTourMin: +minutes(first.tiles, STOPS.length).toFixed(1),
    tabletTourMin: +minutes(again.tiles, tablets.length).toFixed(1),
    missed: [...first.missed, ...again.missed].map((s) => s.name),
    tours,
    points,
    fullBar: bar >= xpToNext(14),
    minutesTo14: +min.toFixed(1),
  };
}

if (process.argv[1]?.endsWith('tablets.ts')) console.log(JSON.stringify(plan(), null, 1));
