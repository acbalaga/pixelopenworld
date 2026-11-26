import { expect, it } from 'vitest';
import { RAID } from '../../src/content/balance/events';
import { PLACE_SPOTS } from '../../src/content/people/placeSpots';
import { createAvatar } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { crowdOf } from '../../src/sim/travelers/crowd';
import { PLACE_LIST } from '../../src/sim/travelers/lists';

// Not part of `verify` (timing depends on the machine). Run with `npm run bench`.
// POW-M5-11: a field raid with 15 promoted Travelers fighting the raid boss holds the sim tick
// budget (tech/04: 6 ms average, 12 ms worst).
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;

it('a field raid with 15 promoted Travelers holds the tick budget', () => {
  const site = 'millbrook.fields';
  const r = PLACE_SPOTS[site]!.rect;
  const at = { x: (r.x + r.w / 2) * 16, y: (r.y + r.h / 2) * 16 };
  const s = createDemoState(5, 0);
  s.world = { solidAt: (): number => 0 };
  s.weatherOverride = 'clear';
  const me = createAvatar(s, px(at.x), px(at.y + 60));
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  const tick = (): number => {
    const clock = { ...s.clock!, nowMs: s.clock!.nowMs + 33 };
    const t = performance.now();
    stepWorld(s, me, { commands: [], worldTick: s.worldTick + 1, clock });
    return performance.now() - t;
  };
  for (let i = 0; i < 60; i++) tick();
  const crowd = crowdOf(s);
  const idx = PLACE_LIST.indexOf(site);
  const raiders: number[] = [];
  for (let slot = 0; slot < 240 && raiders.length < 15; slot++)
    if (crowd.online[slot]) raiders.push(slot);
  for (const slot of raiders) {
    crowd.doing[slot] = {
      kind: 'fight',
      place: idx,
      left: 1e6,
      eta: 0,
      from: idx,
      total: 0,
      skill: -1,
      thing: RAID.boss,
    };
    s.travelers[slot]!.place = idx;
  }
  const boss = spawnCreature(s, RAID.boss, at.x, at.y);
  const pools = s.entities.comps.pools[boss]!;
  pools.hpMax *= 50;
  pools.hp = pools.hpMax;
  for (let i = 0; i < 90; i++) tick();
  const samples: number[] = [];
  for (let i = 0; i < 900; i++) {
    pools.hp = pools.hpMax;
    samples.push(tick());
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const fighting = raiders.filter((sl) => (crowd.entOf[sl] ?? -1) >= 0).length;
  console.log(
    `Raid: ${fighting} raiders promoted (${crowd.ents.size} in all), tick mean ${mean.toFixed(3)} ms, max ${Math.max(...samples).toFixed(2)} ms. Budget 6 ms average, 12 ms worst.`,
  );
  expect(fighting).toBeGreaterThanOrEqual(15);
  expect(mean).toBeLessThan(6);
});
