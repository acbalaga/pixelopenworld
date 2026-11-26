import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import type { SavePlain } from '../../src/save/types';
import { getComp } from '../../src/sim/kernel/entities';
import { px } from '../../src/sim/kernel/fixed';
import { deserializeState, hashState } from '../../src/sim/state';
import { CHUNK_PX } from '../../src/sim/world/window';
import { newStream, streamSystem } from '../../src/sim/world/stream';
import { TileWorld } from '../../src/sim/world/world';
import { findAvatar } from '../../src/shared/summary';
import { LAST_SLICE_SCHEMA } from '../support/saves';

describe('schema 20 to 21 migration (chunk deltas)', () => {
  it('loads the previous fixture and keeps the chest, the node and the block as they were', async () => {
    const f = JSON.parse(
      readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-20.json'), 'utf8'),
    ) as { plain: SavePlain; expectedHash: string; chest: boolean; block: boolean; node: number };
    expect(f.plain.schema).toBe(20);
    const decoded = await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
    const at21 = migrate(decoded, MIGRATIONS, 21);
    expect(at21.schema).toBe(21);
    const s = deserializeState(at21.sim);
    expect(s.deltas).toEqual({});
    // Nothing else changed: with the deltas field removed the old hash comes back.
    delete (s as { deltas?: unknown }).deltas;
    delete (s as { map?: unknown }).map;
    delete (s as { travelers?: unknown }).travelers;
    delete (s as { mail?: unknown }).mail;
    expect(hashState(s)).toBe(f.expectedHash);
    // Streaming adopts the old entities and folds the ones far from the avatar into deltas.
    const now = migrate(decoded, MIGRATIONS, LAST_SLICE_SCHEMA);
    expect(now.schema).toBe(LAST_SLICE_SCHEMA);
    const full = deserializeState(now.sim);
    const grid = new TileWorld(); // no chunks: every old entity is outside the window
    full.world = grid;
    full.stream = newStream(grid, false);
    // With the avatar far away, every adopted object is folded into a delta.
    const me = getComp(full.entities, findAvatar(full)!, 'pos')!;
    me.x = px(50 * CHUNK_PX);
    me.y = px(50 * CHUNK_PX);
    streamSystem(full);
    const kinds = Object.values(full.deltas).flatMap((d) => Object.keys(d.objects));
    expect(kinds.some((k) => k.startsWith('fixture.chest'))).toBe(true);
    expect(kinds.some((k) => k.startsWith('node.'))).toBe(true);
    expect(kinds.some((k) => k.startsWith('fixture.block'))).toBe(true);
  });
});

describe('schema 21 to 22 migration (dungeons and bosses)', () => {
  it('loads the previous fixture, keeps its deltas, and gains an empty boss component', async () => {
    const f = JSON.parse(
      readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-21.json'), 'utf8'),
    ) as { plain: SavePlain; expectedHash: string; deltaChunks: number };
    expect(f.plain.schema).toBe(21);
    expect(f.deltaChunks).toBeGreaterThan(0);
    const decoded = await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
    const now = migrate(decoded, MIGRATIONS, LAST_SLICE_SCHEMA);
    expect(now.schema).toBe(LAST_SLICE_SCHEMA);
    const s = deserializeState(now.sim);
    expect(Object.keys(s.deltas)).toHaveLength(f.deltaChunks);
    expect(s.entities.comps.boss.every((b) => b === null)).toBe(true);
    // Nothing else changed: without the new component the old hash comes back.
    delete (s.entities.comps as { boss?: unknown }).boss;
    delete (s as { map?: unknown }).map;
    delete (s as { travelers?: unknown }).travelers;
    delete (s as { mail?: unknown }).mail;
    expect(hashState(s)).toBe(f.expectedHash);
  });
});
