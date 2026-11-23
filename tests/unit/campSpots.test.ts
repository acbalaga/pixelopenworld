import { describe, expect, it } from 'vitest';
import { roomAt } from '../../src/content/world/rooms';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import {
  REGION_SETTLEMENTS,
  inSettlement,
  settlementRects,
} from '../../src/content/world/settlements';

const camps = DAWNMEADOW.placements.filter((p) => p.kind === 'fixture.rest_point' && !p.stamp);

describe('settlements for camps (POW-M4-23C)', () => {
  it('match the stamps the Dawnmeadow spec places, and have a size', () => {
    for (const s of REGION_SETTLEMENTS['dawnmeadow']!) {
      const placed = DAWNMEADOW.placements.find((p) => p.stamp === s.stamp);
      expect(placed, s.stamp).toMatchObject({ x: s.x, y: s.y });
    }
    expect(settlementRects('dawnmeadow')).toHaveLength(REGION_SETTLEMENTS['dawnmeadow']!.length);
  });
});

describe('the Dawnmeadow camps', () => {
  it('are six, outdoors, outside every settlement, and far apart', () => {
    expect(camps).toHaveLength(6);
    for (const c of camps) {
      expect(roomAt(c.x, c.y, 'dawnmeadow')?.outdoors, `${c.x},${c.y} outdoors`).toBe(true);
      expect(inSettlement('dawnmeadow', c.x, c.y), `${c.x},${c.y} in a settlement`).toBe(false);
    }
    for (const a of camps)
      for (const b of camps)
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(12);
  });
});
