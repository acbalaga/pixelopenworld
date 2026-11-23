/**
 * Gathering supply on the real map. For each gathering tag and tier, finds every node in the
 * baked Dawnmeadow, the walking tour through them (nearest-neighbour over real BFS distance, with
 * portals), and the best sustained gathers per minute: a full lap, bounded by the node respawn.
 */
import { NODES } from '../../src/content/items/recipes';
import { MOVEMENT } from '../../src/content/balance/movement';
import { loadDawnmeadow, walkable } from './world';

const L = loadDawnmeadow();
const W = L.w;
const H = L.h;
const TPS = 30;
/** Walk speed in tiles per second (sub-px per tick / 256 / 16 px). */
const WALK = (MOVEMENT.walkSpeed / 256 / 16) * TPS;
/** One gather with the sweet spot taken: the measured `Run.gather` cost, 45 ticks. */
const GATHER_S = 45 / TPS;

function dist(from: { x: number; y: number }): Int32Array {
  const d = new Int32Array(W * H).fill(-1);
  const q = new Int32Array(W * H);
  let h = 0;
  let t = 0;
  // Nodes stand on solid tiles; start from the open tiles around them.
  for (const [ox, oy] of [
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -1],
    [0, 0],
  ] as const) {
    const x = from.x + ox;
    const y = from.y + oy;
    if (walkable(L.grid, x, y) && d[y * W + x] === -1) {
      d[y * W + x] = 0;
      q[t++] = y * W + x;
    }
  }
  while (h < t) {
    const c = q[h++]!;
    const x = c % W;
    for (const n of [c - W, c + 1, c + W, c - 1]) {
      if (n < 0 || n >= W * H || d[n] !== -1) continue;
      const nx = n % W;
      if (Math.abs(nx - x) > 1 || !walkable(L.grid, nx, (n - nx) / W)) continue;
      d[n] = d[c]! + 1;
      q[t++] = n;
    }
  }
  return d;
}

const at = (d: Int32Array, p: { x: number; y: number }): number => {
  let best = -1;
  for (const [ox, oy] of [
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -1],
    [0, 0],
  ] as const) {
    const v = d[(p.y + oy) * W + p.x + ox] ?? -1;
    if (v >= 0 && (best < 0 || v < best)) best = v;
  }
  return best;
};

export interface Supply {
  tag: string;
  tier: number;
  nodes: number;
  kinds: string[];
  tourTiles: number;
  tourMinutes: number;
  respawnMinutes: number;
  perMinute: number;
  /** Nodes no walk reaches from the first one (other side of a locked door, or an island). */
  unreachable: number;
}

export function supply(): Supply[] {
  const groups = new Map<string, { x: number; y: number; kind: string }[]>();
  for (const o of L.objects) {
    const n = NODES[o.kind];
    if (!n) continue;
    const k = `${n.tag}:${n.tier}`;
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  const out: Supply[] = [];
  for (const [k, list] of groups) {
    const [tag, tier] = k.split(':') as [string, string];
    // Nearest-neighbour tour from a start node. A start on the wrong side of a locked door or a
    // portal reaches little, so a tour that leaves nodes behind is retried from one of them and the
    // tour that reaches the most is kept.
    const tour = (startIdx: number): { tiles: number; unreachable: number; left: typeof list } => {
      const left = [...list];
      let cur = left.splice(startIdx, 1)[0]!;
      let tiles = 0;
      let unreachable = 0;
      const first = cur;
      let stranded: typeof list = [];
      while (left.length) {
        const d = dist(cur);
        let bi = -1;
        let bd = Infinity;
        left.forEach((p, i) => {
          const v = at(d, p);
          if (v >= 0 && v < bd) {
            bd = v;
            bi = i;
          }
        });
        if (bi < 0) {
          unreachable += left.length;
          stranded = [...left];
          break;
        }
        tiles += bd;
        cur = left.splice(bi, 1)[0]!;
      }
      const back = at(dist(cur), first);
      if (back > 0) tiles += back;
      return { tiles, unreachable, left: stranded };
    };
    let best = tour(0);
    for (let tries = 0; best.unreachable > 0 && tries < 4; tries++) {
      const next = tour(list.indexOf(best.left[0]!));
      if (next.unreachable >= best.unreachable) break;
      best = next;
    }
    const { tiles, unreachable } = best;
    const reached = list.length - unreachable;
    const respawn = Math.max(...list.map((p) => NODES[p.kind]!.respawn)) / TPS / 60;
    const lap = tiles / WALK / 60 + (reached * GATHER_S) / 60;
    out.push({
      tag,
      tier: Number(tier),
      nodes: list.length,
      kinds: [...new Set(list.map((p) => p.kind))],
      tourTiles: tiles,
      tourMinutes: +lap.toFixed(2),
      respawnMinutes: +respawn.toFixed(2),
      perMinute: +(reached / Math.max(lap, respawn)).toFixed(2),
      unreachable,
    });
  }
  return out.sort((a, b) => a.tag.localeCompare(b.tag) || a.tier - b.tier);
}

if (process.argv[1]?.endsWith('gather.ts')) console.log(JSON.stringify(supply(), null, 1));
