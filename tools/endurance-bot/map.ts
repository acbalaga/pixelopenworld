/**
 * Map-out bot. Walks the real baked Dawnmeadow from a wake point with the sim's own movement,
 * collision, portals and fog, always heading for the nearest tile in an unrevealed fog block, and
 * reports how long it takes to uncover everything a player can walk to (no keys, no puzzles).
 *
 *   npx tsx tools/endurance-bot/map.ts [--wake w3] [--walk] [--cap 600] [--foes]
 *
 * --walk   never sprint (default holds the stick at full extent, as a phone player does)
 * --foes   spawners on; the bot ignores creatures and just keeps walking
 */
import { writeFileSync } from 'node:fs';
import { DAWNMEADOW_WAKE_POINTS } from '../../src/content/world/wake';
import { DAWNMEADOW_POIS } from '../../src/content/pois/dawnmeadow';
import { FIXTURES } from '../../src/content/world/fixtures';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { SUBPX } from '../../src/sim/kernel/fixed';
import { createDemoState } from '../../src/sim/state';
import { WORLD_SYSTEMS, stepWorld } from '../../src/sim/step';
import { mapSystem } from '../../src/sim/systems/map';
import { skillsSystem } from '../../src/sim/systems/skills';
import { tick as kernelTick } from '../../src/sim/kernel/scheduler';
import { applyAvatarCommand } from '../../src/sim/avatar';
import { pointsOf } from '../../src/sim/skills';
import { blockOf, countRevealed, isRevealed } from '../../src/sim/world/fog';
import { newStream } from '../../src/sim/world/stream';
import { REGION, loadDawnmeadow, walkable } from './world';

const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const WAKE = (arg('--wake') ?? 'w3') as keyof typeof DAWNMEADOW_WAKE_POINTS;
const SPRINT = !process.argv.includes('--walk');
const FOES = process.argv.includes('--foes');
const CAP_MIN = Number(arg('--cap') ?? 900);
/** Run the map system before skills, so a reveal pays Cartography in the same tick. */
const FIX_ORDER = process.argv.includes('--fix-order');
const FIXED = (() => {
  const list = WORLD_SYSTEMS.filter((x) => x !== mapSystem);
  list.splice(list.indexOf(skillsSystem), 0, mapSystem);
  return list;
})();
const TPS = 30;

const L = loadDawnmeadow();
const g = L.grid;
const W = L.w;
const H = L.h;
const idx = (x: number, y: number): number => y * W + x;

// Portal graph: standing on a portal tile lands you next to its partner.
const byKind = new Map<string, { x: number; y: number }>();
for (const o of L.objects) if (FIXTURES[o.kind]?.type === 'portal' || FIXTURES[o.kind]?.type === 'arrival') byKind.set(o.kind, o);
const jump = new Map<number, number>();
for (const p of L.portals) {
  if (p.locked) continue;
  const d = byKind.get(p.to) ?? FIXTURES[p.to]?.at;
  if (!d) continue;
  const off = FIXTURES[p.to]?.arrive ?? [0, 0];
  // The sim lands the feet at the partner's feet plus the offset; take the tile under that, or
  // the nearest open one if the offset rounds onto a wall.
  const fx = d.x * 16 + 8 + off[0];
  const fy = d.y * 16 + 16 - 8 + off[1];
  let ax = Math.floor(fx / 16);
  let ay = Math.floor((fy - 1) / 16);
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

function bfs(sx: number, sy: number, goal: (x: number, y: number) => boolean): number[] | null {
  const prev = new Int32Array(W * H).fill(-2);
  const q = new Int32Array(W * H);
  let h = 0;
  let t = 0;
  const s = idx(sx, sy);
  prev[s] = -1;
  q[t++] = s;
  while (h < t) {
    const c = q[h++]!;
    const x = c % W;
    const y = (c - x) / W;
    if (c !== s && goal(x, y)) {
      const path: number[] = [];
      for (let k = c; k !== -1; k = prev[k]!) path.push(k);
      return path.reverse();
    }
    const nb = [c - W, c + 1, c + W, c - 1];
    const j = jump.get(c);
    if (j !== undefined) nb.push(j);
    for (const n of nb) {
      if (n < 0 || n >= W * H || prev[n] !== -2) continue;
      const nx = n % W;
      if (n !== j && Math.abs(nx - x) > 1) continue;
      if (!walkable(g, nx, (n - nx) / W)) continue;
      prev[n] = c;
      q[t++] = n;
    }
  }
  return null;
}

// Everything reachable from the wake, for the denominator.
const wake = DAWNMEADOW_WAKE_POINTS[WAKE];
const reachBlocks = new Set<string>();
let reachTiles = 0;
bfs(wake.x, wake.y, (x, y) => {
  reachTiles++;
  reachBlocks.add(`${blockOf(x)},${blockOf(y)}`);
  return false;
});
const totalBlocks = (W / 4) * (H / 4);

const s = createDemoState(7, 0);
s.region = REGION;
s.world = g;
s.stream = newStream(g, FOES);
const f = feetAt(wake.x, wake.y);
const me = createAvatar(s, f.x, f.y, 'MapBot');

const tileOf = (): [number, number] => {
  const p = s.entities.comps.pos[me]!;
  return [Math.floor(p.x / SUBPX / 16), Math.floor((p.y / SUBPX - 1) / 16)];
};
const fog = (): Record<string, string> => s.map.fog[REGION] ?? {};
const tick = (cmd?: object): void => {
  const input = { commands: cmd ? [cmd as never] : [], worldTick: s.tick + 1 };
  if (FIX_ORDER) kernelTick(s, FIXED, input, (st, c) => applyAvatarCommand(st, me, c));
  else stepWorld(s, me, input);
};

const poisSeen = new Set<string>();
const milestones: { pct: number; min: number }[] = [];
const marks = [10, 25, 50, 75, 90, 95, 99, 100];
let nudges = 0;
let deaths = 0;
let target = -1;
let stopAt: [number, number] | null = null;
const log: { min: number; revealed: number; carto: number }[] = [];
const target95 = reachBlocks.size;

while (s.tick < CAP_MIN * 60 * TPS) {
  const [tx, ty] = tileOf();
  if (s.entities.comps.fighter[me]?.state === 'dead') {
    deaths++;
    for (let i = 0; i < 600 && s.entities.comps.fighter[me]?.state === 'dead'; i++) tick();
    continue;
  }
  const F = fog();
  const path = bfs(tx, ty, (x, y) => !isRevealed(F, blockOf(x), blockOf(y)));
  if (!path) {
    stopAt = [tx, ty];
    break;
  }
  target = path[path.length - 1]!;
  // Walk the path tile by tile with 8-way steering.
  let i = 1;
  let still = 0;
  let lastP = { ...s.entities.comps.pos[me]! };
  let budget = 0;
  while (i < path.length && budget++ < 20 * TPS) {
    const k = path[i]!;
    const kx = k % W;
    const ky = (k - kx) / W;
    if (isRevealed(fog(), blockOf(target % W), blockOf(Math.floor(target / W)))) break;
    const goal = feetAt(kx, ky);
    const p = s.entities.comps.pos[me]!;
    const dx = goal.x - p.x;
    const dy = goal.y - p.y;
    const dz = 2 * SUBPX;
    if (Math.abs(dx) <= dz && Math.abs(dy) <= dz) {
      i++;
      continue;
    }
    const ex = dx > dz ? 1 : dx < -dz ? -1 : 0;
    const ey = dy > dz ? 1 : dy < -dz ? -1 : 0;
    const dir = [
      [7, 0, 1],
      [6, -1, 2],
      [5, 4, 3],
    ][ey + 1]![ex + 1]!;
    tick({ type: 'move', dir: dir === -1 ? null : dir, full: SPRINT });
    const q = s.entities.comps.pos[me]!;
    // Portal: a jump in position. Replan from the far side.
    if (Math.abs(q.x - lastP.x) > 40 * SUBPX || Math.abs(q.y - lastP.y) > 40 * SUBPX) break;
    if (Math.abs(q.x - lastP.x) + Math.abs(q.y - lastP.y) < SUBPX / 4) still++;
    else still = 0;
    lastP = { ...q };
    if (still > 20) {
      // Snagged on a corner or a fixture body: step onto the waypoint, as a player would wiggle.
      nudges++;
      q.x = goal.x;
      q.y = goal.y;
      still = 0;
      i++;
    }
    for (const poi of DAWNMEADOW_POIS) {
      if (poisSeen.has(poi.id)) continue;
      const [ax, ay] = tileOf();
      if (Math.abs(ax - poi.x) <= 6 && Math.abs(ay - poi.y) <= 6) poisSeen.add(poi.id);
    }
    if (s.tick % (60 * TPS) === 0) {
      const r = countRevealed(fog());
      log.push({ min: s.tick / TPS / 60, revealed: r, carto: pointsOf(s, me, 'skill.cartography') });
      const pct = (100 * r) / target95;
      while (marks.length && pct >= marks[0]!) milestones.push({ pct: marks.shift()!, min: s.tick / TPS / 60 });
    }
  }
  if (i >= path.length) {
    // Reached the tile and the block is still dark (a block revealed only by standing in it).
    tick({ type: 'move', dir: null });
  }
}

const revealed = countRevealed(fog());
const min = s.tick / TPS / 60;
const result = {
  wake: WAKE,
  fixOrder: FIX_ORDER,
  stopAt,
  stopWalkable: stopAt ? walkable(g, stopAt[0], stopAt[1]) : null,
  sprint: SPRINT,
  foes: FOES,
  simMinutes: +min.toFixed(1),
  revealedBlocks: revealed,
  reachableBlocks: reachBlocks.size,
  totalBlocks,
  pctOfReachable: +((100 * revealed) / reachBlocks.size).toFixed(1),
  pctOfRegion: +((100 * revealed) / totalBlocks).toFixed(1),
  reachableTiles: reachTiles,
  poisSeen: poisSeen.size,
  poisTotal: DAWNMEADOW_POIS.length,
  poisMissed: DAWNMEADOW_POIS.filter((p) => !poisSeen.has(p.id)).map((p) => p.id),
  cartography: pointsOf(s, me, 'skill.cartography'),
  cartographyXp: s.ledger.xpEarned['skill.cartography'] ?? 0,
  athletics: pointsOf(s, me, 'skill.athletics'),
  nudges,
  deaths,
  milestones,
  unlockedPortalsUsedInGraph: jump.size,
  lockedPortals: L.portals.filter((p) => p.locked).map((p) => p.kind),
};
console.log(JSON.stringify(result, null, 1));
const out = arg('--out');
if (out) writeFileSync(out, JSON.stringify({ ...result, log }, null, 1));
