/**
 * Dev overlay: frame and tick timing plus renderer facts. Imported only behind
 * `import.meta.env.DEV`, so it never reaches the production bundle (tools/check-dev-absent.ts
 * enforces that). Toggle with the Backquote key or a three-finger tap.
 */

import './dev.css';
import { BUILD_LABEL } from '../shared/version';

const N = 240;

/** What a scene reports each frame. Cheap to compute; read once per overlay refresh. */
export interface OverlayInfo {
  /** Entities in the sim. */
  entities: number;
  /** Draw calls issued last frame. */
  drawCalls: number;
  /** Logical canvas size and the integer scale to physical pixels. */
  logicalWidth: number;
  logicalHeight: number;
  scale: number;
  /** Anything scene specific, appended on its own line. */
  extra?: string;
}

/** Rolling statistics over the last {@link N} frames. */
export interface FrameStats {
  fps: number;
  avgFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  avgWorkMs: number;
  avgTickMs: number;
  maxTickMs: number;
  over20ms: number;
}

/** `performance.memory` exists in Chromium only. */
function heapMb(): number | null {
  const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return m ? m.usedJSHeapSize / 1048576 : null;
}

/** The overlay element and its timing buffers. */
export class DevOverlay {
  private frame = new Float32Array(N);
  private work = new Float32Array(N);
  private tick = new Float32Array(N);
  private frameI = 0;
  private tickI = 0;
  private frameFilled = 0;
  private tickFilled = 0;
  private last = 0;
  private tickStart = 0;
  private shownAt = 0;
  private readonly el: HTMLElement;

  constructor(private readonly info: () => OverlayInfo) {
    const el = document.createElement('pre');
    el.id = 'pow-dev-overlay';
    document.body.appendChild(el);
    this.el = el;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote' && !e.repeat) this.toggle();
    });
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 3) this.toggle();
    });
  }

  /** Shows or hides the overlay. */
  toggle(): void {
    this.el.hidden = !this.el.hidden;
  }

  /** Call at the start of the render callback. */
  frameBegin(now: number): void {
    if (this.last) this.frame[this.frameI] = now - this.last;
    this.last = now;
  }

  /** Call at the end of the render callback. */
  frameEnd(now: number): void {
    this.work[this.frameI] = now - this.last;
    this.frameI = (this.frameI + 1) % N;
    this.frameFilled = Math.min(N, this.frameFilled + 1);
    if (!this.el.hidden && now - this.shownAt > 500) {
      this.shownAt = now;
      this.el.textContent = this.format();
    }
  }

  /** Call before and after each sim tick. */
  tickBegin(now: number): void {
    this.tickStart = now;
  }
  tickEnd(now: number): void {
    this.tick[this.tickI] = now - this.tickStart;
    this.tickI = (this.tickI + 1) % N;
    this.tickFilled = Math.min(N, this.tickFilled + 1);
  }

  /** Current statistics. */
  stats(): FrameStats {
    const f = Array.from(this.frame.subarray(0, this.frameFilled))
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    const sum = (a: ArrayLike<number>): number => Array.from(a).reduce((x, y) => x + y, 0);
    const avg = sum(f) / Math.max(1, f.length);
    const ticks = this.tick.subarray(0, this.tickFilled);
    return {
      fps: avg > 0 ? 1000 / avg : 0,
      avgFrameMs: avg,
      p95FrameMs: f[Math.floor(f.length * 0.95)] ?? 0,
      maxFrameMs: f[f.length - 1] ?? 0,
      avgWorkMs: sum(this.work.subarray(0, this.frameFilled)) / Math.max(1, this.frameFilled),
      avgTickMs: sum(ticks) / Math.max(1, ticks.length),
      maxTickMs: Math.max(0, ...ticks),
      over20ms: f.filter((v) => v > 20).length,
    };
  }

  private format(): string {
    const s = this.stats();
    const i = this.info();
    const mem = heapMb();
    const lines = [
      `${s.fps.toFixed(0)} fps  frame ${s.avgFrameMs.toFixed(1)} ms (p95 ${s.p95FrameMs.toFixed(1)}, max ${s.maxFrameMs.toFixed(1)}, >20 ms: ${s.over20ms})`,
      `render ${s.avgWorkMs.toFixed(2)} ms  tick ${s.avgTickMs.toFixed(2)} ms (max ${s.maxTickMs.toFixed(2)})`,
      `entities ${i.entities}  draw calls ${i.drawCalls}`,
      `logical ${i.logicalWidth}x${i.logicalHeight} at ${i.scale}x  heap ${mem === null ? 'n/a' : `${mem.toFixed(1)} MB`}`,
    ];
    if (i.extra) lines.push(i.extra);
    lines.push(`build ${BUILD_LABEL}`);
    return lines.join('\n');
  }
}
