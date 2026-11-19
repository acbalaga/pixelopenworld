import { PALETTE } from '../content/sprites/palette';
import { STORM_FLASH, WEATHER_PARTICLES } from '../content/world/atmosphere';
import type { Weather } from '../content/balance/time';
import { Layer, type Renderer } from './renderer';

const MAX = 160;

/**
 * Weather particles and storm flashes. Particles live in screen space in pooled arrays, so a
 * frame allocates nothing, and are drawn in world space at the camera.
 */
export class WeatherFx {
  private x = new Float32Array(MAX);
  private y = new Float32Array(MAX);
  /** A little per-particle variation in speed, 0.8 to 1.2. */
  private k = new Float32Array(MAX);
  private n = 0;
  private flashUntil = 0;
  private nextFlash = 0;

  constructor(private readonly rand: () => number) {}

  /** Moves the particles for `dtMs` and fills or trims the pool to the weather's count. */
  update(dtMs: number, weather: Weather, w: number, h: number, nowMs: number): void {
    const def = WEATHER_PARTICLES[weather];
    const want = def ? Math.min(MAX, def.count) : 0;
    while (this.n < want) {
      this.x[this.n] = this.rand() * (w + 40);
      this.y[this.n] = this.rand() * h;
      this.k[this.n] = 0.8 + this.rand() * 0.4;
      this.n++;
    }
    if (this.n > want) this.n = want;
    if (def) {
      const dt = Math.min(dtMs, 50) / 1000;
      for (let i = 0; i < this.n; i++) {
        this.y[i] = (this.y[i] as number) + def.fall * (this.k[i] as number) * dt;
        this.x[i] = (this.x[i] as number) + def.drift * (this.k[i] as number) * dt;
        if ((this.y[i] as number) > h) {
          this.y[i] = -def.h;
          this.x[i] = this.rand() * (w + 40);
        }
        if ((this.x[i] as number) < -20) this.x[i] = w + this.rand() * 20;
        if ((this.x[i] as number) > w + 40) this.x[i] = -10;
      }
    }
    if (weather === 'storm') {
      if (this.nextFlash === 0) this.nextFlash = nowMs + this.gap();
      if (nowMs >= this.nextFlash) {
        this.flashUntil = nowMs + STORM_FLASH.ms;
        this.nextFlash = nowMs + this.gap();
      }
    } else this.nextFlash = 0;
  }

  private gap(): number {
    return STORM_FLASH.meanSeconds * 1000 * (0.5 + this.rand());
  }

  /** Queues the particles and any flash, in world space at the camera. */
  draw(r: Renderer, camX: number, camY: number, weather: Weather, nowMs: number): void {
    const def = WEATHER_PARTICLES[weather];
    if (def) {
      const color = PALETTE[def.color] as string;
      for (let i = 0; i < this.n; i++)
        r.drawRect(
          Layer.Weather,
          camX + (this.x[i] as number),
          camY + (this.y[i] as number),
          def.w,
          def.h,
          color,
          def.alpha,
        );
    }
    if (weather === 'storm' && nowMs < this.flashUntil)
      r.drawRect(
        Layer.Weather,
        camX,
        camY,
        r.width,
        r.height,
        PALETTE[3] as string,
        STORM_FLASH.alpha,
      );
  }
}
