import { expect, it } from 'vitest';
import { createDemoState } from '../../src/sim/state';
import { crowdOf, onlineCount, travelersSystem } from '../../src/sim/travelers/crowd';
import { catchUp } from '../../src/sim/travelers/progress';
import { initialLives } from '../../src/sim/travelers/generate';

// Not part of `verify` (timing depends on the machine). Run with `npm run bench`.
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const evening = (MON + 2) * 86_400_000 + 21 * 3_600_000;

it('abstract tick, full population at the evening peak', () => {
  const s = createDemoState(7, 0);
  s.clock = { nowMs: evening, epochMs: evening - 10 * 86_400_000, tzOffsetMin: 0 };
  // Warm up to a populated, mid-activity crowd.
  for (let m = 0; m < 120; m++) {
    s.tick += 60;
    s.worldTick = m * 60;
    s.clock.nowMs = evening + m * 60_000;
    travelersSystem(s);
  }
  const N = 600;
  const samples: number[] = [];
  for (let m = 120; m < 120 + N; m++) {
    s.tick += 60;
    s.worldTick = m * 60;
    s.clock.nowMs = evening + (m % 120) * 60_000;
    const t = performance.now();
    travelersSystem(s);
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / N;
  console.log(
    `${onlineCount(crowdOf(s))} online of 240, ${N} abstract ticks: mean ${mean.toFixed(3)} ms, p99 ${samples[Math.floor(N * 0.99)]?.toFixed(3)} ms, max ${samples[N - 1]?.toFixed(3)} ms (budget: 0.5 ms avg)`,
  );
  expect(mean).toBeLessThan(0.5);
});

it('catch-up over a 30 day gap', () => {
  const lives = initialLives(7);
  const t = performance.now();
  catchUp(7, lives, 40, 30);
  const ms = performance.now() - t;
  console.log(`catch-up, 240 Travelers, 30 day gap: ${ms.toFixed(2)} ms (budget: 100 ms)`);
  expect(ms).toBeLessThan(100);
});
