import { it } from 'vitest';
import { createDemoState } from '../../src/sim/state';
import { step } from '../../src/sim/step';

// Not part of `verify` (timing depends on the machine). Run with `npm run bench`.
it('tick cost, 500 demo entities', () => {
  const state = createDemoState(1, 500);
  for (let i = 0; i < 500; i++) step(state, { commands: [] });
  const N = 3000;
  const samples: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    step(state, { commands: [] });
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / N;
  console.log(
    `500 entities, ${N} ticks: mean ${mean.toFixed(3)} ms, p99 ${samples[Math.floor(N * 0.99)]?.toFixed(3)} ms, max ${samples[N - 1]?.toFixed(3)} ms (budget: 6 ms avg, 12 ms worst)`,
  );
});
