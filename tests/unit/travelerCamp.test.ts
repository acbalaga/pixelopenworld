import { describe, expect, it } from 'vitest';
import { createAvatar } from '../../src/sim/avatar';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { chooseNext, crowdOf, newCrowd, travelersSystem } from '../../src/sim/travelers/crowd';
import { standPx, travelerViews } from '../../src/sim/travelers/entities';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { PLACE_LIST } from '../../src/sim/travelers/lists';
import { PLACES } from '../../src/content/people/places';
import { PLACE_SPOTS } from '../../src/content/people/placeSpots';
import { CAMP } from '../../src/content/balance/travelers';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { CHUNK_TILES, decodeChunk } from '../../src/sim/world/chunk';
import { bakeRegion } from '../../tools/bake-world/bake';
import { TEMPLATES } from '../../src/content/chat/templates';
import { validateShippedChat } from '../../src/content/chat/validate';

/**
 * Camps (POW-M5-26, from the Gate G5a playtest): at dusk the rest point near town looks like a camp,
 * with Travelers sitting round it.
 */
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;
const OPEN = { solidAt: (): number => 0 };
/** The tick dusk begins: day ends 34 minutes into the cycle, and the cycle starts at minute 4. */
const DUSK = (34 - 4) * 1800;
const NIGHT = (38 - 4) * 1800;
const CAMP_ID = 'wayside.river_camp';
const CAMP_IDXS = new Set(CAMP.places.map((id) => PLACE_LIST.indexOf(id)));

function world(seed: number, worldTick: number, at = { x: 192, y: 193 }): SimState {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  createAvatar(s, px(at.x * 16 + 8), px(at.y * 16 + 8));
  s.worldTick = worldTick;
  s.weatherOverride = 'clear';
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

function run(s: SimState, ticks: number, each?: () => void): void {
  const base = s.clock!.nowMs;
  const start = s.tick;
  for (let i = 0; i < ticks; i++) {
    s.tick++;
    s.worldTick++;
    s.clock = { ...s.clock!, nowMs: base + Math.floor(((s.tick - start) * 1000) / 30) };
    s.events.list.length = 0;
    travelersSystem(s);
    if (each && i % 60 === 0) each();
  }
}

describe('the camp place', () => {
  it('are outdoor wayside places added after the others, so saved place indices hold', () => {
    expect(CAMP.places).toHaveLength(3);
    for (const id of CAMP.places) {
      expect(PLACES[id]).toMatchObject({ area: 'wayside', indoors: false });
      expect(PLACE_LIST.indexOf(id)).toBeGreaterThan(PLACE_LIST.indexOf('wayside.chapel'));
    }
    // The first two camps come right after the older places, then the Pit (M5-29), then the guild
    // halls (M5-08) and the north gate: indices are saved, so they never move. The woods-edge camp
    // (M6-23) came later, so it is last.
    expect(PLACE_LIST.slice(22, 24)).toEqual(CAMP.places.slice(0, 2));
    expect(PLACE_LIST[PLACE_LIST.length - 1]).toBe('wayside.woods_camp');
  });

  it('each ring a rest point fixture, and no slot sits on it or on a solid tile, and each is reachable from the road', () => {
    const files = bakeRegion(DAWNMEADOW, STAMPS);
    const chunks = new Map<string, ReturnType<typeof decodeChunk>>();
    const objs = new Map<string, string>();
    for (const [name, v] of files) {
      if (!/^dawnmeadow\/chunk-/.test(name)) continue;
      const c = decodeChunk(v as Uint8Array);
      chunks.set(`${c.cx},${c.cy}`, c);
      for (const o of c.objects)
        objs.set(`${c.cx * CHUNK_TILES + o.x},${c.cy * CHUNK_TILES + o.y}`, o.kind);
    }
    const solid = (x: number, y: number): boolean => {
      const c = chunks.get(`${Math.floor(x / CHUNK_TILES)},${Math.floor(y / CHUNK_TILES)}`);
      if (!c) return true;
      const kind = objs.get(`${x},${y}`);
      return (
        c.collision[(y % CHUNK_TILES) * CHUNK_TILES + (x % CHUNK_TILES)] !== 0 ||
        (kind !== undefined && kind !== 'fixture.rest_point')
      );
    };
    // Walk from the first Hearthford square slot, the road, over open tiles.
    const start = PLACE_SPOTS['hearthford.square']!.slots[0]!;
    const seen = new Map<string, number>([[`${start[0]},${start[1]}`, 0]]);
    const q: [number, number][] = [[start[0], start[1]]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i]!;
      const d = seen.get(`${x},${y}`)!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const k = `${x + dx},${y + dy}`;
        if (seen.has(k) || solid(x + dx, y + dy)) continue;
        seen.set(k, d + 1);
        q.push([x + dx, y + dy]);
      }
    }
    for (const id of CAMP.places) {
      const spot = PLACE_SPOTS[id]!;
      const [fx, fy] = spot.focus!;
      expect(objs.get(`${fx},${fy}`), id).toBe('fixture.rest_point');
      expect(spot.slots.length, id).toBeGreaterThanOrEqual(4);
      for (const [x, y] of spot.slots) {
        const ring = Math.max(Math.abs(x - fx), Math.abs(y - fy));
        expect(ring, `${id} slot ${x},${y}`).toBeGreaterThanOrEqual(1);
        expect(ring, `${id} slot ${x},${y}`).toBeLessThanOrEqual(2);
        expect(solid(x, y), `${id} slot ${x},${y}`).toBe(false);
        expect(seen.has(`${x},${y}`), `${id} slot ${x},${y}`).toBe(true);
      }
      // The walk from the square is inside the 80 tile ring (owner, 2026-11-25).
      expect(seen.get(`${fx},${fy}`), id).toBeLessThanOrEqual(80);
    }
    // Every rest point inside the ring is a camp, so the resting rule reaches it (POW-M6-23).
    const foci = new Set(CAMP.places.map((id) => PLACE_SPOTS[id]!.focus!.join(',')));
    const ring = DAWNMEADOW.placements.filter(
      (p) =>
        p.kind === 'fixture.rest_point' && !p.stamp && (seen.get(`${p.x},${p.y}`) ?? 1e9) <= 80,
    );
    expect(ring.length).toBe(CAMP.places.length);
    for (const p of ring) expect(foci.has(`${p.x},${p.y}`), `rest point ${p.x},${p.y}`).toBe(true);
  });
});

describe('choosing a camp', () => {
  const choices = (weather: 'clear' | 'rain' | 'storm', tick: number): number => {
    const s = createDemoState(5, 0);
    s.worldTick = tick;
    s.weatherOverride = weather;
    const crowd = newCrowd(5);
    let atCamp = 0;
    for (const t of identitiesOf(5).slice(0, 60))
      for (let i = 0; i < 40; i++) {
        const d = chooseNext(s, crowd, t);
        if ((d.kind === 'social' || d.kind === 'afk') && CAMP_IDXS.has(d.place)) atCamp++;
      }
    return atCamp;
  };

  it('happens at dusk and night in clear weather', () => {
    expect(choices('clear', DUSK + 100)).toBeGreaterThan(20);
    expect(choices('clear', NIGHT + 100)).toBeGreaterThan(20);
  });

  it('never happens by day', () => {
    expect(choices('clear', 9000)).toBe(0);
  });

  it('is never made in rain or a storm', () => {
    expect(choices('rain', DUSK + 100)).toBe(0);
    expect(choices('storm', DUSK + 100)).toBe(0);
    expect(choices('rain', NIGHT + 100)).toBe(0);
    expect(choices('storm', NIGHT + 100)).toBe(0);
  });

  it('is weighted to Casual, Explorer and Roleplayer', () => {
    const top = ['Casual', 'Explorer', 'Roleplayer'];
    for (const a of Object.keys(CAMP.chance)) {
      const v = CAMP.chance[a as keyof typeof CAMP.chance];
      if (top.includes(a)) expect(v).toBeGreaterThanOrEqual(0.4);
      else expect(v).toBeLessThan(0.4);
    }
  });
});

describe('a camp at dusk', () => {
  it('has someone at it in 8 of 10 seeds', () => {
    let hits = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = world(seed, DUSK - 1800);
      const crowd = crowdOf(s);
      let seen = false;
      run(s, 1800 + 7200, () => {
        if (s.worldTick < DUSK) return;
        for (const d of crowd.doing)
          if (
            d &&
            CAMP_IDXS.has(d.place) &&
            d.eta === 0 &&
            (d.kind === 'social' || d.kind === 'afk')
          )
            seen = true;
      });
      if (seen) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(8);
  }, 120_000);

  it('seats promoted Travelers round the bedroll, facing it, and none on it', () => {
    const [fx, fy] = PLACE_SPOTS[CAMP_ID]!.focus!;
    const fire = { x: fx * 16 + 8, y: fy * 16 + 8 };
    let seated = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = world(seed, DUSK - 1800, { x: fx, y: fy + 3 });
      run(s, 1800 + 7200, () => {
        for (const v of travelerViews(s)) {
          const dx = fire.x - v.x;
          const dy = fire.y - v.y;
          if (Math.hypot(dx, dy) > 40) continue;
          // Nobody stands on the bedroll, walkers included once they arrive.
          if (v.mode === 'sit' || v.mode === 'afk') {
            seated++;
            expect(Math.hypot(dx, dy), `seed ${seed}`).toBeGreaterThan(6);
            const face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 6) : dy > 0 ? 4 : 0;
            expect(v.face, `seed ${seed}`).toBe(face);
          }
        }
      });
    }
    expect(seated).toBeGreaterThan(0);
  }, 180_000);

  it('keeps camp slots round the fixture for every Traveler slot', () => {
    for (const id of CAMP.places) {
      const [cx, cy] = PLACE_SPOTS[id]!.focus!;
      for (let slot = 0; slot < 200; slot++) {
        const p = standPx(slot, PLACE_LIST.indexOf(id))!;
        expect(Math.hypot(p.x - (cx * 16 + 8), p.y - 6 - (cy * 16 + 8))).toBeGreaterThan(6);
      }
    }
  });
});

describe('camp lines', () => {
  const lines = TEMPLATES.filter((t) => t.when?.place?.includes(CAMP_ID));

  it('are ten idle lines, local, and only at a camp', () => {
    expect(lines.flatMap((t) => t.text)).toHaveLength(10);
    for (const t of lines) expect(t.when!.place).toEqual([...CAMP.places]);
    for (const t of lines) {
      expect(t.channel).toBe('local');
      expect(t.trigger).toBe('state.idle');
    }
  });

  it('pass the template validator', () => {
    expect(validateShippedChat()).toEqual([]);
  });
});
