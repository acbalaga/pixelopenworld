import { FIXTURES } from '../../src/content/world/fixtures';
import type { DungeonDef, DungeonEdge, DungeonRoom } from '../../src/content/world/dungeons/types';
import { Solid } from '../../src/sim/world/chunk';
import { resolveStamp } from '../../src/sim/world/stamp';
import { collisionOfCell } from '../bake-assets/world';

/** The most block puzzle states one room may have before the validator gives up and says so. */
const MAX_STATES = 150_000;
const MAX_BLOCKS = 3;

/** Fixture types a body stands in the way of, for the avatar and for blocks. */
const SOLID_TYPES = new Set([
  'door',
  'gate',
  'chest',
  'breakable',
  'switch',
  'tablet',
  'storage',
  'board',
  'station',
  'bed',
  'mirror',
  'waystone',
  'element',
  'wall',
  'resetpost',
]);

interface Grid {
  w: number;
  h: number;
  walk: boolean[];
  blocks: number[];
  /** Tiles holding a reset post. A room with blocks must have one. */
  posts: number[];
  plates: number[];
  /** Tiles a block may not be pushed onto: next to an entrance or exit, which it could seal. */
  noPush: Set<number>;
}

function grid(room: DungeonRoom, edges: readonly DungeonEdge[]): Grid {
  const r = resolveStamp(room.stamp);
  const idx = (x: number, y: number): number => y * r.w + x;
  const walk: boolean[] = r.cells.map((c) => c !== null && collisionOfCell(c) === Solid.None);
  const blocks: number[] = [];
  const posts: number[] = [];
  const plates: number[] = [];
  const noPush = new Set<number>();
  for (const o of r.objects) {
    const def = FIXTURES[o.kind];
    if (!def) continue;
    const i = idx(o.x, o.y);
    if (def.type === 'block') blocks.push(i);
    else if (def.type === 'resetpost') {
      posts.push(i);
      walk[i] = false;
    } else if (def.type === 'plate' && (def.holds ?? ['block']).includes('block')) plates.push(i);
    else if (def.type === 'portal' || def.type === 'arrival') mark(noPush, o.x, o.y, r.w, r.h);
    else if (
      SOLID_TYPES.has(def.type) &&
      !def.arenaDoor &&
      !def.tide &&
      !def.water &&
      !def.holdTicks
    )
      walk[i] = false;
  }
  for (const e of edges) {
    if (e.from === room.id) mark(noPush, e.at.x, e.at.y, r.w, r.h);
    if (e.to === room.id) mark(noPush, e.arrive.x, e.arrive.y, r.w, r.h);
  }
  return { w: r.w, h: r.h, walk, blocks, posts, plates, noPush };
}

function mark(set: Set<number>, x: number, y: number, w: number, h: number): void {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h) set.add((y + dy) * w + x + dx);
}

/** Tiles the avatar can reach from `from` without crossing a block. The smallest index names the region. */
function reach(g: Grid, from: number, blocked: ReadonlySet<number>): Set<number> {
  const seen = new Set<number>([from]);
  const q = [from];
  while (q.length > 0) {
    const i = q.pop() as number;
    const x = i % g.w;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = Math.floor(i / g.w) + dy;
      if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
      const n = ny * g.w + nx;
      if (seen.has(n) || !g.walk[n] || blocked.has(n)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  return seen;
}

/**
 * Searches every state of a room's block puzzle: where the blocks are and which part of the room
 * the avatar can reach. Returns problems: unsolvable, or reachable states from which it cannot be
 * solved (a block pushed into a corner, a plate it can no longer reach).
 */
function blockPuzzle(room: DungeonRoom, g: Grid, start: number): string[] {
  if (g.blocks.length === 0) return [];
  const where = `room ${room.id}`;
  // Every room with blocks has a reset post, and the post is not beside a block's start tile
  // (the player stands next to the post, and a block going home must not land on them).
  if (g.posts.length === 0) return [`${where}: has blocks but no reset post (fixture.reset_post)`];
  for (const post of g.posts)
    for (const b of g.blocks)
      if (
        Math.abs((post % g.w) - (b % g.w)) <= 1 &&
        Math.abs(Math.floor(post / g.w) - Math.floor(b / g.w)) <= 1
      )
        return [`${where}: the reset post is beside a block's start tile`];
  if (g.plates.length === 0) return [];
  if (g.blocks.length > MAX_BLOCKS)
    return [
      `${where}: ${g.blocks.length} blocks is more than the validator checks (${MAX_BLOCKS})`,
    ];
  if (g.plates.length > g.blocks.length)
    return [`${where}: ${g.plates.length} plates but only ${g.blocks.length} blocks`];
  const key = (blocks: number[], who: number): string => `${blocks.join(',')}|${who}`;
  const norm = (blocks: number[]): number[] => [...blocks].sort((a, b) => a - b);
  const initial = norm(g.blocks);
  const firstWho = Math.min(...reach(g, start, new Set(initial)));
  const states = new Map<string, { blocks: number[]; who: number; to: string[] }>();
  const queue = [key(initial, firstWho)];
  states.set(queue[0] as string, { blocks: initial, who: start, to: [] });
  const goal = new Set<string>();
  for (let qi = 0; qi < queue.length; qi++) {
    if (states.size > MAX_STATES) return [`${where}: block puzzle has too many states to check`];
    const k = queue[qi] as string;
    const s = states.get(k) as { blocks: number[]; who: number; to: string[] };
    if (g.plates.every((p) => s.blocks.includes(p))) goal.add(k);
    const area = reach(g, s.who, new Set(s.blocks));
    for (const b of s.blocks) {
      const bx = b % g.w;
      const by = Math.floor(b / g.w);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const from = (by - dy) * g.w + (bx - dx);
        const tx = bx + dx;
        const ty = by + dy;
        if (bx - dx < 0 || by - dy < 0 || bx - dx >= g.w || by - dy >= g.h) continue;
        if (tx < 0 || ty < 0 || tx >= g.w || ty >= g.h) continue;
        const to = ty * g.w + tx;
        if (!area.has(from) || !g.walk[to] || s.blocks.includes(to) || g.noPush.has(to)) continue;
        const next = norm(s.blocks.map((x) => (x === b ? to : x)));
        // The avatar now stands where the block was.
        const who = Math.min(...reach(g, b, new Set(next)));
        const nk = key(next, who);
        s.to.push(nk);
        if (!states.has(nk)) {
          states.set(nk, { blocks: next, who: b, to: [] });
          queue.push(nk);
        }
      }
    }
  }
  if (goal.size === 0) return [`${where}: the block puzzle cannot be solved`];
  // States that can reach a solved one: walk the arrows backwards from the solved ones.
  const back = new Map<string, string[]>();
  for (const [k, s] of states)
    for (const t of s.to) (back.get(t) ?? back.set(t, []).get(t)!).push(k);
  const good = new Set(goal);
  const stack = [...goal];
  while (stack.length > 0) {
    for (const p of back.get(stack.pop() as string) ?? []) {
      if (good.has(p)) continue;
      good.add(p);
      stack.push(p);
    }
  }
  const dead = [...states.keys()].filter((k) => !good.has(k));
  if (dead.length === 0 || room.reset) return [];
  const bad = (states.get(dead[0] as string) as { blocks: number[] }).blocks
    .map((b) => `(${b % g.w}, ${Math.floor(b / g.w)})`)
    .join(' ');
  return [
    `${where}: soft lock: with blocks at ${bad} no plate can be pressed, and the room does not reset (${dead.length} such states)`,
  ];
}

/**
 * Checks a dungeon the way a player with only its declared skills would meet it. Returns every
 * problem found, none when it is sound: rooms unreachable from the entrance, keys that cannot be
 * had, one-way routes with no way back to the entrance, and block puzzles that can be soft
 * locked. The baker fails on any.
 */
export function validateDungeon(def: DungeonDef): string[] {
  const errors: string[] = [];
  const at = (m: string): string => `${def.id}: ${m}`;
  const rooms = new Map(def.rooms.map((r) => [r.id, r]));
  if (!rooms.has(def.entrance)) return [at(`no entrance room '${def.entrance}'`)];
  for (const e of def.edges)
    for (const id of [e.from, e.to])
      if (!rooms.has(id)) errors.push(at(`edge ${e.from} to ${e.to} names unknown room '${id}'`));
  if (errors.length > 0) return errors;

  const skillOk = (e: DungeonEdge): boolean => !e.skill || def.skills.includes(e.skill);
  const both = (e: DungeonEdge): boolean => e.kind === 'open' || e.kind === 'locked';
  const reachable = new Set([def.entrance]);
  const keys = new Set<string>();
  for (let changed = true; changed;) {
    changed = false;
    for (const id of reachable)
      for (const k of rooms.get(id)?.keys ?? []) {
        if (keys.has(k)) continue;
        keys.add(k);
        changed = true;
      }
    for (const e of def.edges) {
      if (!skillOk(e) || (e.kind === 'locked' && !(e.key && keys.has(e.key)))) continue;
      if (reachable.has(e.from) && !reachable.has(e.to)) {
        reachable.add(e.to);
        changed = true;
      }
      if (both(e) && reachable.has(e.to) && !reachable.has(e.from)) {
        reachable.add(e.from);
        changed = true;
      }
    }
  }
  for (const e of def.edges)
    if (e.kind === 'locked' && !(e.key && keys.has(e.key)))
      errors.push(
        at(
          `the key ${e.key} for the door from ${e.from} to ${e.to} cannot be reached from the entrance`,
        ),
      );
  for (const r of def.rooms)
    if (!reachable.has(r.id) && !r.outsideOnly)
      errors.push(at(`room ${r.id} cannot be reached from the entrance`));

  // The way back: from every reachable room, the entrance must be reachable by edges that work
  // in that direction, with every key in hand. A drop works one way only.
  const arcs = new Map<string, string[]>();
  const arc = (a: string, b: string): void => void (arcs.get(b) ?? arcs.set(b, []).get(b)!).push(a);
  for (const e of def.edges) {
    if (!skillOk(e) || (e.kind === 'locked' && !(e.key && keys.has(e.key)))) continue;
    arc(e.from, e.to);
    if (both(e)) arc(e.to, e.from);
  }
  const back = new Set([def.entrance]);
  const todo = [def.entrance];
  while (todo.length > 0) {
    for (const p of arcs.get(todo.pop() as string) ?? []) {
      if (back.has(p)) continue;
      back.add(p);
      todo.push(p);
    }
  }
  for (const id of reachable)
    if (!back.has(id)) errors.push(at(`soft lock: no way back to the entrance from room ${id}`));

  for (const e of def.edges) {
    for (const [roomId, t] of [
      [e.from, e.at],
      [e.to, e.arrive],
    ] as const) {
      const room = rooms.get(roomId) as DungeonRoom;
      const g = grid(room, def.edges);
      if (t.x < 0 || t.y < 0 || t.x >= g.w || t.y >= g.h || !g.walk[t.y * g.w + t.x])
        errors.push(
          at(`edge ${e.from} to ${e.to}: (${t.x}, ${t.y}) in room ${roomId} is not open floor`),
        );
    }
  }
  for (const room of def.rooms) {
    const g = grid(room, def.edges);
    const entry = def.edges.find((e) => e.to === room.id)?.arrive ?? room.start ?? { x: 1, y: 1 };
    const start = (room.start ?? entry).y * g.w + (room.start ?? entry).x;
    for (const m of blockPuzzle(room, g, start)) errors.push(at(m));
  }
  return errors;
}
