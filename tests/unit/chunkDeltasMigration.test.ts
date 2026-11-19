import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { getComp } from '../../src/sim/kernel/entities';
import { px } from '../../src/sim/kernel/fixed';
import { deserializeState, hashState } from '../../src/sim/state';
import { CHUNK_PX } from '../../src/sim/world/window';
import { newStream, streamSystem } from '../../src/sim/world/stream';
import { TileWorld } from '../../src/sim/world/world';
import { findAvatar } from '../../src/shared/summary';

describe('schema 20 to 21 migration (chunk deltas)', () => {
  it('loads the previous fixture and keeps the chest, the node and the block as they were', async () => {
    const f = JSON.parse(
      readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-20.json'), 'utf8'),
    ) as { plain: SavePlain; expectedHash: string; chest: boolean; block: boolean; node: number };
    expect(f.plain.schema).toBe(20);
    const decoded = await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
    const now = migrate(decoded);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    expect(s.deltas).toEqual({});
    // Nothing else changed: with the deltas field removed the old hash comes back.
    delete (s as { deltas?: unknown }).deltas;
    expect(hashState(s)).toBe(f.expectedHash);
    // Streaming adopts the old entities and folds the ones far from the avatar into deltas.
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
