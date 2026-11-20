import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import {
  ROOTWAY_DOORSTEP,
  SLICE_CAVE_ROW,
  SQUARE_ANCHOR,
  SQUARE_SPREAD,
  dawnmeadowTile,
} from '../../src/save/sliceRemap';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { query } from '../../src/sim/kernel/entities';
import { px } from '../../src/sim/kernel/fixed';
import { deserializeState, serializeState, type SimState } from '../../src/sim/state';
import { CHUNK_TILES, decodeChunk } from '../../src/sim/world/chunk';
import { bakeRegion } from '../../tools/bake-world/bake';

interface Fixture {
  plain: SavePlain;
  expectedHash: string;
  counts: { entities: number; npc: number; node: number; spawner: number; fixture: number };
  snare: number;
}
const f = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-22.json'), 'utf8'),
) as Fixture;

const files = bakeRegion(DAWNMEADOW, STAMPS);
const chunkAt = new Map<string, ReturnType<typeof decodeChunk>>();
for (const [name, v] of files) {
  const m = /^dawnmeadow\/chunk-(\d+)-(\d+)\.bin$/.exec(name);
  if (m) chunkAt.set(`${m[1]},${m[2]}`, decodeChunk(v as Uint8Array));
}
const solid = (x: number, y: number): boolean => {
  const c = chunkAt.get(`${Math.floor(x / CHUNK_TILES)},${Math.floor(y / CHUNK_TILES)}`);
  return !c || c.collision[(y % CHUNK_TILES) * CHUNK_TILES + (x % CHUNK_TILES)] !== 0;
};
/** The tile and its eight neighbours are open, so the avatar's box fits. */
const roomy = (x: number, y: number): boolean => {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if (solid(x + dx, y + dy)) return false;
  return true;
};

const load = async (plain: SavePlain): Promise<SavePlain> =>
  migrate(await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(plain))));
/** The fixture with its avatar moved to a slice tile. */
const at = (tx: number, ty: number): SavePlain => {
  const s = deserializeState(f.plain.sim);
  const me = findAvatar(s)!;
  const p = s.entities.comps.pos[me]!;
  p.x = px(tx * 16 + 8);
  p.y = px(ty * 16 + 14);
  return { ...f.plain, sim: serializeState(s) };
};
const tileOf = (s: SimState, id: number): { x: number; y: number } => {
  const p = s.entities.comps.pos[id]!;
  return { x: Math.floor(p.x / 256 / 16), y: Math.floor((p.y / 256 - 1) / 16) };
};

describe('schema 22 to 23 migration (the move to Dawnmeadow)', () => {
  it('loads the previous fixture and lands on walkable ground in the square', async () => {
    expect(f.plain.schema).toBe(22);
    const now = await load(f.plain);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    const me = findAvatar(s)!;
    const t = tileOf(s, me);
    expect(roomy(t.x, t.y)).toBe(true);
    // Two tiles east of the old Waystone is two tiles east of the new spawn point.
    expect(t).toEqual({ x: SQUARE_ANCHOR.x + 2, y: SQUARE_ANCHOR.y + 1 });
    // The new square is where the Waystone is, not somewhere else.
    expect(Math.abs(t.x - 185)).toBeLessThan(20);
    expect(Math.abs(t.y - 189)).toBeLessThan(10);
  });

  it('keeps everything the player owns and passes integrity', async () => {
    const before = deserializeState(f.plain.sim);
    const now = await load(f.plain);
    const after = deserializeState(now.sim);
    const a = findAvatar(before)!;
    const b = findAvatar(after)!;
    for (const k of [
      'inventory',
      'storage',
      'skills',
      'journal',
      'loadouts',
      'deeds',
      'paths',
    ] as const)
      // Schema 26 gives every journal an empty `singulars`.
      expect(after.entities.comps[k][b], k).toEqual(
        k === 'journal'
          ? { ...before.entities.comps[k][a], singulars: {} }
          : before.entities.comps[k][a],
      );
    expect(after.entities.comps.avatar[b]!.coin).toBe(before.entities.comps.avatar[a]!.coin);
    expect(after.ledger).toEqual(before.ledger);
    const verdict = validateSave(now);
    expect(verdict.reasons).toEqual([]);
    expect(verdict.ok).toBe(true);
  });

  it('removes the slice map objects, its creatures and its chunk deltas', async () => {
    expect(f.counts.npc).toBeGreaterThan(0);
    expect(f.counts.spawner).toBeGreaterThan(0);
    expect(Object.keys(deserializeState(f.plain.sim).deltas).length).toBeGreaterThan(0);
    const s = deserializeState((await load(f.plain)).sim);
    for (const k of ['npc', 'node', 'spawner', 'ai', 'boss'] as const)
      expect(query(s.entities, k), k).toEqual([]);
    expect(s.deltas).toEqual({});
    // The only fixture left is the player's snare.
    const kinds = query(s.entities, 'fixture').map((id) => s.entities.comps.fixture[id]!.kind);
    expect(kinds).toEqual(['fixture.snare']);
  });

  it('keeps drops lying in the world and a placed snare, moved to where the avatar is', async () => {
    const s = deserializeState((await load(f.plain)).sim);
    const me = findAvatar(s)!;
    const drops = query(s.entities, 'pickup');
    expect(drops).toHaveLength(1);
    for (const id of [...drops, ...query(s.entities, 'fixture')]) {
      const t = tileOf(s, id);
      expect(roomy(t.x, t.y), `entity ${id}`).toBe(true);
    }
    expect(tileOf(s, me).x).toBeGreaterThan(SQUARE_ANCHOR.x);
  });

  it('moves the respawn point to the new square too', async () => {
    const s = deserializeState((await load(f.plain)).sim);
    const r = s.entities.comps.avatar[findAvatar(s)!]!.respawn;
    expect({ x: Math.floor(r.x / 256 / 16), y: Math.floor((r.y / 256 - 1) / 16) }).toEqual(
      SQUARE_ANCHOR,
    );
  });

  it('puts a character who was inside the old cave outside the Rootway entrance', async () => {
    for (const [tx, ty] of [
      [40, 105],
      [75, 140],
      [10, SLICE_CAVE_ROW],
    ] as const) {
      const s = deserializeState((await load(at(tx, ty))).sim);
      const t = tileOf(s, findAvatar(s)!);
      expect(t, `${tx},${ty}`).toEqual(ROOTWAY_DOORSTEP);
      expect(roomy(t.x, t.y)).toBe(true);
    }
  });

  it('every old outdoor tile maps to open ground (the clamp range is all walkable)', () => {
    for (let ty = 0; ty < SLICE_CAVE_ROW; ty += 3)
      for (let tx = 0; tx < 96; tx += 3) {
        const t = dawnmeadowTile(tx, ty);
        expect(roomy(t.x, t.y), `${tx},${ty} -> ${t.x},${t.y}`).toBe(true);
      }
    for (const x of SQUARE_SPREAD.x)
      for (const y of SQUARE_SPREAD.y)
        expect(roomy(SQUARE_ANCHOR.x + x, SQUARE_ANCHOR.y + y)).toBe(true);
  });

  it('is the only step between 22 and 23', () => {
    expect(Object.keys(MIGRATIONS).map(Number)).toContain(22);
    expect(CURRENT_SCHEMA).toBeGreaterThanOrEqual(23);
  });
});
