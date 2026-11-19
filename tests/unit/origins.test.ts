import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { layersFor, normalizeDoll } from '../../src/content/dolls/parts';
import { DEFAULT_ORIGIN, ORIGINS, ORIGIN_IDS, wakesFor } from '../../src/content/world/origins';
import { WAKE_IDS, WAKE_POINTS } from '../../src/content/world/wake';
import { ORIGIN_STRINGS } from '../../src/content/strings/origins';
import { SPRITES } from '../../src/content/sprites';
import { gridFromDef } from '../../src/content/sprites/grid';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { createAvatar } from '../../src/sim/avatar';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, deserializeState, serializeState } from '../../src/sim/state';
import { chooseWake } from '../../src/sim/world/wake';
import { composeFrame } from '../../src/render/doll';

const TILE = 16;

describe('origins are data and give nothing but flavor', () => {
  it('has the six origins, and every string they name exists with no em dash', () => {
    expect(ORIGIN_IDS).toHaveLength(6);
    for (const o of Object.values(ORIGINS))
      for (const k of [o.nameKey, o.blurbKey, o.firstLineKey]) {
        expect(ORIGIN_STRINGS[k], k).toBeTruthy();
        expect(ORIGIN_STRINGS[k]).not.toMatch(/—/);
      }
  });

  it('the subsets are the table in the Dawnmeadow region doc', () => {
    expect([...wakesFor('origin.unremembered')]).toEqual([...WAKE_IDS]);
    expect([...wakesFor('origin.farmhand')]).toEqual(['w1', 'w7']);
    expect([...wakesFor('origin.road_weary')]).toEqual(['w2', 'w8']);
    expect([...wakesFor('origin.hunters_ward')]).toEqual(['w4', 'w7']);
    expect([...wakesFor('origin.river_found')]).toEqual(['w3', 'w6']);
    expect([...wakesFor('origin.pilgrims_child')]).toEqual(['w5', 'w8']);
    // A save from a newer build with an origin this build does not know draws from all eight.
    expect(wakesFor('origin.from_the_future')).toEqual(wakesFor(DEFAULT_ORIGIN));
  });

  it('over 1,000 seeds per origin, only its own wake points are chosen, and every one is used', () => {
    for (const o of Object.values(ORIGINS)) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 1000; seed++) {
        const s = createDemoState(seed, 0);
        const w = chooseWake(s, o.wakes);
        expect(o.wakes, `${o.id} seed ${seed}`).toContain(w.id);
        seen.add(w.id);
      }
      expect([...seen].sort()).toEqual([...o.wakes].sort());
    }
  });

  it('a new character is identical across origins apart from position, look and the origin id', () => {
    const make = (origin: string): string => {
      const s = createDemoState(777, 0);
      // Where it wakes follows the origin. Everything below is masked or must match.
      const wake = chooseWake(s, wakesFor(origin));
      const me = createAvatar(s, px(wake.x * TILE + 8), px(wake.y * TILE + 14), 'Same_1', origin);
      const a = s.entities.comps.avatar[me]!;
      a.origin = '';
      a.facing = 4;
      a.respawn = { x: 0, y: 0 };
      s.entities.comps.pos[me] = { x: 0, y: 0 };
      return serializeState(s);
    };
    const base = make(DEFAULT_ORIGIN);
    for (const id of ORIGIN_IDS) expect(make(id), id).toBe(base);
    // And the avatar really does carry the chosen origin.
    const s = createDemoState(1, 0);
    const me = createAvatar(s, 0, 0, 'X_1', 'origin.farmhand');
    expect(s.entities.comps.avatar[me]!.origin).toBe('origin.farmhand');
    for (const id of WAKE_IDS) expect(WAKE_POINTS[id]).toBeDefined();
  });
});

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-19.json'), 'utf8'),
) as { plain: SavePlain };

describe('schema 19 to 20 migration (look and origin)', () => {
  it('keeps the look as it was on screen, gains neutral new parts and an origin, and passes integrity', async () => {
    expect(fixture.plain.schema).toBe(19);
    const decoded = await new JsonCodec().decode(
      new TextEncoder().encode(JSON.stringify(fixture.plain)),
    );
    const now = migrate(decoded);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    // The same character: every old field kept, every new one at its neutral entry.
    expect(now.look).toEqual(normalizeDoll(fixture.plain.look));
    expect(now.look).toMatchObject({
      ...fixture.plain.look,
      height: 'mid',
      eyes: 0,
      brows: 0,
      mouth: 0,
      mark: 0,
      facial: 'none',
      accessory: 'none',
    });
    // And it draws exactly as it did: no stamp layer, the same pixels in every frame.
    const defs = new Map(SPRITES.map((s) => [s.id, s]));
    const provider = (id: string, f: string): Uint8Array => gridFromDef(defs.get(id)!, f);
    expect(layersFor(now.look).some((l) => l.stamp)).toBe(false);
    for (const f of ['idle_down', 'walk_right_1', 'attack_up_0', 'work_swing_down_2'])
      expect(composeFrame(provider, layersFor(now.look), f, now.look.height ?? 'mid')).toEqual(
        composeFrame(provider, layersFor(fixture.plain.look), f),
      );
    const s = deserializeState(now.sim);
    const me = findAvatar(s)!;
    expect(s.entities.comps.avatar[me]!.origin).toBe(DEFAULT_ORIGIN);
    expect(validateSave(now).reasons).toEqual([]);
  });
});
