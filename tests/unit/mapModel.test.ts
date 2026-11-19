import { describe, expect, it } from 'vitest';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { createDemoState, type SimState } from '../../src/sim/state';
import { addNote, hearRumor, regionFog } from '../../src/sim/systems/map';
import { revealDisc } from '../../src/sim/world/fog';
import { mapView, type MapContext } from '../../src/ui/menu/mapModel';

const ctx: MapContext = {
  region: 'dawnmeadow',
  regionName: 'Dawnmeadow',
  chunks: DAWNMEADOW.chunks,
  landmarks: DAWNMEADOW.landmarks,
  waystones: DAWNMEADOW.waystones,
};

function game(): { s: SimState; me: number } {
  const s = createDemoState(5, 0);
  s.region = 'dawnmeadow';
  s.world = { solidAt: () => 0 };
  const f = feetAt(185, 160);
  return { s, me: createAvatar(s, f.x, f.y) };
}

const reveal = (s: SimState, tx: number, ty: number, r = 3): number =>
  revealDisc(regionFog(s, 'dawnmeadow'), Math.floor(tx / 4), Math.floor(ty / 4), r);

describe('map model', () => {
  it('shows nothing marked on a fresh map', () => {
    const { s, me } = game();
    const v = mapView(s, me, ctx);
    expect(v.places).toEqual([]);
    expect(v.percent).toBe(0);
    expect(v.player).toEqual({ x: 185, y: 160 });
  });

  it('shows a landmark only once its ground is uncovered', () => {
    const { s, me } = game();
    reveal(s, 185, 166);
    expect(mapView(s, me, ctx).places.map((p) => p.key)).toEqual(['landmark.bell_tower']);
    expect(mapView(s, me, ctx).percent).toBeGreaterThan(0);
  });

  it('shows a Waystone only once it is seen', () => {
    const { s, me } = game();
    expect(mapView(s, me, ctx).places.some((p) => p.kind === 'waystone')).toBe(false);
    const w = DAWNMEADOW.waystones[1]!;
    reveal(s, w.x, w.y);
    expect(mapView(s, me, ctx).places.map((p) => p.key)).toContain(`waystone.${w.id}`);
  });

  it('draws a rumor off the true spot, and drops it when the real place is found', () => {
    const { s, me } = game();
    hearRumor(s, me, 'rumor.quarry_crane');
    const before = mapView(s, me, ctx).places;
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ kind: 'rumor' });
    expect([before[0]!.x, before[0]!.y]).not.toEqual([184, 37]);
    reveal(s, 184, 37);
    const after = mapView(s, me, ctx).places.map((p) => p.key);
    expect(after).not.toContain('rumor.quarry_crane');
    expect(after).toContain('landmark.quarry_crane');
  });

  it('keeps a rumor to its own region', () => {
    const { s, me } = game();
    hearRumor(s, me, 'rumor.mill_sails');
    expect(mapView(s, me, { ...ctx, region: 'whisperwood' }).places).toEqual([]);
  });

  it('never marks a wake point', () => {
    const { s, me } = game();
    for (const w of DAWNMEADOW.wakePoints) reveal(s, w.x, w.y, 6);
    for (const p of mapView(s, me, ctx).places) {
      for (const w of DAWNMEADOW.wakePoints) expect(p.key).not.toContain(w.id);
    }
  });

  it('lists notes', () => {
    const { s, me } = game();
    addNote(s, 4, 5, 'camp');
    expect(mapView(s, me, ctx).notes).toEqual([{ id: 1, x: 4, y: 5, text: 'camp' }]);
  });
});
