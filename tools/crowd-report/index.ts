/**
 * The online count of the crowd over a simulated real week (POW-M5-03, `npm run crowd-report`).
 * Samples every 10 real minutes, prints the range and the peak and trough hours, and writes a
 * plot to `docs/ops/evidence/pow-m5-03/online-week.png`. Usage: `[seed] [utcOffsetMinutes]`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { identitiesOf } from '../../src/sim/travelers';
import { isOnlineAt, MIN_PER_DAY, weekdayOf } from '../../src/sim/travelers/schedule';
import { encodePng, hex, newImage, put } from '../bake-assets/png';

const seed = Number(process.argv[2] ?? 1);
const tz = Number(process.argv[3] ?? 0);
const ids = identitiesOf(seed);
// A Monday 00:00 local, well after the epoch.
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const STEP = 10;
const samples: { day: number; min: number; n: number }[] = [];
for (let d = 0; d < 7; d++)
  for (let m = 0; m < MIN_PER_DAY; m += STEP) {
    const local = (MON + d) * MIN_PER_DAY + m;
    let n = 0;
    for (const t of ids) if (isOnlineAt(seed, t, local)) n++;
    samples.push({ day: weekdayOf(MON + d), min: m, n });
  }
const ns = samples.map((s) => s.n);
const lo = Math.min(...ns);
const hi = Math.max(...ns);
const mean = (f: (s: (typeof samples)[number]) => boolean): number => {
  const xs = samples.filter(f);
  return xs.reduce((a, s) => a + s.n, 0) / xs.length;
};
const wd = (s: (typeof samples)[number]): boolean => s.day >= 1 && s.day <= 5;
const hourMean = (a: number, b: number, weekday: boolean): number =>
  mean((s) => wd(s) === weekday && s.min >= a * 60 && s.min < b * 60);
const best = (weekday: boolean): number => {
  let bh = 0;
  let bv = -1;
  for (let hr = 0; hr < 24; hr++) {
    const v = hourMean(hr, hr + 1, weekday);
    if (v > bv) {
      bv = v;
      bh = hr;
    }
  }
  return bh;
};
console.log('hour  weekday weekend');
for (let hr = 0; hr < 24; hr++)
  console.log(
    `${String(hr).padStart(2)}    ${hourMean(hr, hr + 1, true)
      .toFixed(1)
      .padStart(6)} ${hourMean(hr, hr + 1, false)
      .toFixed(1)
      .padStart(6)}`,
  );
console.log(`seed ${seed}, tz ${tz}: online min ${lo}, max ${hi}`);
console.log(
  `weekday peak hour ${best(true)}:00 (${hourMean(best(true), best(true) + 1, true).toFixed(1)})`,
);
console.log(
  `weekday mean 03:00-07:00 ${hourMean(3, 7, true).toFixed(1)}, 20:00-23:00 ${hourMean(20, 23, true).toFixed(1)}`,
);
console.log(
  `weekend mean 03:00-07:00 ${hourMean(3, 7, false).toFixed(1)}, 20:00-23:00 ${hourMean(20, 23, false).toFixed(1)}`,
);

// Plot: one line over the week, the 18 and 48 bounds drawn.
const W = 7 * 144 * 2;
const H = 260;
const img = newImage(W + 40, H + 30);
const bg = hex('#20222e');
for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) put(img, x, y, bg);
const y0 = H;
const yOf = (n: number): number => y0 - Math.round((n / 60) * (H - 10));
for (const [n, c] of [
  [18, '#5b6b3a'],
  [48, '#7b4a3a'],
] as const)
  for (let x = 20; x < W + 20; x++) put(img, x, yOf(n), hex(c));
for (let d = 0; d <= 7; d++) for (let y = 0; y < H; y++) put(img, 20 + d * 288, y, hex('#3a3d52'));
samples.forEach((s, i) => {
  const x = 20 + i * 2;
  const y = yOf(s.n);
  for (let k = 0; k < 2; k++)
    for (let yy = y; yy <= y + 1; yy++) put(img, x + k, yy, hex('#e8c85a'));
});
mkdirSync('docs/ops/evidence/pow-m5-03', { recursive: true });
writeFileSync('docs/ops/evidence/pow-m5-03/online-week.png', encodePng(img));
