import type { SimEvent } from '../sim/kernel/events';
import type { Renderer } from './renderer';
import type { PixelFont } from '../ui/text/pixelFont';
import { UI_BALANCE } from '../content/balance/ui';

const CALLOUT = UI_BALANCE.callout;

interface Callout {
  text: string;
  born: number;
  color: string;
}

/** How long a hit flash and a damage number last, in ms. */
const FLASH_MS = 160;
const NUMBER_MS = 700;
const SHAKE_MS = 120;
/** Peak camera shake in logical px. */
const SHAKE_PX = 2;

interface FloatingNumber {
  x: number;
  y: number;
  text: string;
  born: number;
  color: string;
}

/** World position of an entity's center in px, or null. Supplied by the scene. */
export type PosOf = (id: number) => { x: number; y: number } | null;

/**
 * Render-side hit feedback, driven only by sim events: a blink on whoever was hurt, floating
 * damage numbers, and a small camera shake. Shake is off under reduced motion. Nothing here
 * feeds back into the sim.
 */
export class CombatFeedback {
  private flashUntil = new Map<number, number>();
  private numbers: FloatingNumber[] = [];
  private shakeUntil = 0;
  private shakePower = 0;
  /** At most one shout per entity: a new one replaces the last. */
  private callouts = new Map<number, Callout>();

  constructor(private readonly colors: { hit: string; crit: string; hurt: string }) {}

  /** Feed one tick's events. `playerId` is the avatar, whose damage shows in the hurt color. */
  onEvents(
    events: readonly SimEvent[],
    now: number,
    posOf: PosOf,
    playerId: number,
    reducedMotion: boolean,
  ): void {
    for (const e of events) {
      if (e.type === 'damageDealt') {
        this.flashUntil.set(e.dst, now + FLASH_MS);
        const p = posOf(e.dst);
        if (p) {
          const hurt = e.dst === playerId;
          this.numbers.push({
            x: p.x,
            y: p.y - 10,
            text: `${e.amount}${e.crit ? '!' : ''}`,
            born: now,
            color: hurt ? this.colors.hurt : e.crit || e.bonus ? this.colors.crit : this.colors.hit,
          });
        }
        if (!reducedMotion && (e.dst === playerId || e.heavy || e.crit)) {
          this.shakeUntil = now + SHAKE_MS;
          this.shakePower = e.dst === playerId ? SHAKE_PX : SHAKE_PX - 1;
        }
      } else if (e.type === 'perfectDodge') {
        const p = posOf(e.id);
        if (p)
          this.numbers.push({
            x: p.x,
            y: p.y - 14,
            text: 'PERFECT',
            born: now,
            color: this.colors.crit,
          });
      }
    }
  }

  /** True while the entity should blink. */
  flashing(id: number, now: number): boolean {
    const until = this.flashUntil.get(id);
    if (until === undefined) return false;
    if (until <= now) {
      this.flashUntil.delete(id);
      return false;
    }
    return Math.floor((until - now) / 40) % 2 === 0;
  }

  /** Camera offset in logical px for this moment. Zero when there is no shake. */
  shake(now: number): { x: number; y: number } {
    if (now >= this.shakeUntil) return { x: 0, y: 0 };
    const k = Math.floor(now / 16);
    const sign = (n: number): number => (((n * 2654435761) >>> 0) % 2 === 0 ? 1 : -1);
    return { x: sign(k) * this.shakePower, y: sign(k + 7) * Math.max(0, this.shakePower - 1) };
  }

  /** Shouts a technique or move name over entity `id` (G4 playtest). */
  callout(id: number, text: string, color: string, now: number): void {
    this.callouts.set(id, { text, born: now, color });
  }

  /** The shouts showing now, oldest first. For tests and tools. */
  activeCallouts(now: number): { id: number; text: string }[] {
    return [...this.callouts]
      .filter(([, c]) => now - c.born < CALLOUT.ms)
      .map(([id, c]) => ({ id, text: c.text }));
  }

  /** Draws and retires shouts, following whoever shouted. One that has gone from the world ends. */
  drawCallouts(
    r: Renderer,
    font: PixelFont,
    camX: number,
    camY: number,
    now: number,
    outline: string,
    posOf: PosOf,
    reducedMotion: boolean,
  ): void {
    for (const [id, c] of this.callouts) {
      const p = posOf(id);
      if (!p || now - c.born >= CALLOUT.ms) {
        this.callouts.delete(id);
        continue;
      }
      const rise = reducedMotion ? 0 : Math.round(((now - c.born) / CALLOUT.ms) * CALLOUT.risePx);
      font.draw(
        r,
        c.text,
        Math.round(p.x - camX),
        Math.round(p.y - camY) - CALLOUT.abovePx - rise,
        c.color,
        { align: 'center', outline },
      );
    }
  }

  /** Draws and retires floating numbers. `camX`, `camY` turn world px into screen px. */
  drawNumbers(
    r: Renderer,
    font: PixelFont,
    camX: number,
    camY: number,
    now: number,
    outline: string,
  ): void {
    this.numbers = this.numbers.filter((n) => now - n.born < NUMBER_MS);
    for (const n of this.numbers) {
      const age = (now - n.born) / NUMBER_MS;
      const rise = Math.round(age * 14);
      font.draw(r, n.text, Math.round(n.x - camX), Math.round(n.y - camY) - rise, n.color, {
        align: 'center',
        outline,
      });
    }
  }
}
