import { expect, it } from 'vitest';
import { PIT } from '../../src/content/balance/travelers';
import { PLACE_SPOTS } from '../../src/content/people/placeSpots';
import { createAvatar } from '../../src/sim/avatar';
import { px } from '../../src/sim/kernel/fixed';
import { startBout } from '../../src/sim/pitBouts';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { crowdOf } from '../../src/sim/travelers/crowd';
import { PLACE_LIST } from '../../src/sim/travelers/lists';
import { addFlag } from '../../src/sim/travelers/pit';

// Not part of `verify` (timing depends on the machine). Run with `npm run bench`.
// POW-M5-30: a Pit bout with 2 fighters and 8 spectators promoted holds the sim tick budget
// (tech/04: 6 ms average, 12 ms worst), measured against the same scene with no bout.
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;
const R = PLACE_SPOTS[PIT.place]!.rect;
const IDX = PLACE_LIST.indexOf(PIT.place);

function scene(bout: boolean): { mean: number; max: number; promoted: number } {
  const s: SimState = createDemoState(5, 0);
  s.world = { solidAt: (): number => 0 };
  const me = createAvatar(s, px((R.x + 2) * 16 + 8), px((R.y + R.h - 1) * 16 + 14));
  addFlag(s, PIT.flags.open);
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  const tick = (): number => {
    const clock = { ...s.clock!, nowMs: s.clock!.nowMs + 33 };
    const t = performance.now();
    stepWorld(s, me, { commands: [], worldTick: s.worldTick + 1, clock });
    return performance.now() - t;
  };
  for (let i = 0; i < 120; i++) tick();
  const crowd = crowdOf(s);
  // Ten online Travelers at the Pit: two to fight, eight to watch.
  const ten: number[] = [];
  for (let slot = 0; slot < 240 && ten.length < 10; slot++) if (crowd.online[slot]) ten.push(slot);
  for (const slot of ten) {
    crowd.doing[slot] = {
      kind: 'social',
      place: IDX,
      left: 1e6,
      eta: 0,
      from: IDX,
      total: 0,
      skill: -1,
      thing: '',
    };
    s.travelers[slot]!.place = IDX;
  }
  for (let i = 0; i < 90; i++) tick();
  const at = ten.filter((slot) => (crowd.entOf[slot] ?? -1) >= 0).map((slot) => ({ slot }));
  const samples: number[] = [];
  for (let i = 0; i < 900; i++) {
    if (bout && !s.pitBouts?.bout) startBout(s, at[0]!.slot, at[1]!.slot);
    samples.push(tick());
  }
  return {
    mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    max: Math.max(...samples),
    promoted: crowd.ents.size,
  };
}

it('a Pit bout with 2 fighters and 8 spectators holds the tick budget', () => {
  const quiet = scene(false);
  const bout = scene(true);
  console.log(
    `Pit, ${bout.promoted} promoted: no bout ${quiet.mean.toFixed(3)} ms (max ${quiet.max.toFixed(2)}), bout ${bout.mean.toFixed(3)} ms (max ${bout.max.toFixed(2)}). Budget 6 ms average, 12 ms worst.`,
  );
  expect(bout.mean).toBeLessThan(6);
});
