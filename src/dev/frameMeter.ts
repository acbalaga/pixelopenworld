/** Dev-only frame meter. Imported only behind `import.meta.env.DEV`. */

const N = 240;

/** Rolling frame statistics. */
export interface FrameStats {
  fps: number;
  avgFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  avgWorkMs: number;
  over20ms: number;
}

/** Records frame interval and render work time, shows them in a small overlay. */
export class FrameMeter {
  private frame = new Float32Array(N);
  private work = new Float32Array(N);
  private i = 0;
  private filled = 0;
  private last = 0;
  private el: HTMLElement | null = null;
  private shownAt = 0;

  /** Call at the start of the render callback with `performance.now()`. Returns a work timer. */
  begin(now: number): void {
    if (this.last) {
      this.frame[this.i] = now - this.last;
    }
    this.last = now;
  }

  /** Call at the end of the render callback with `performance.now()`. */
  end(now: number, extra = ''): void {
    this.work[this.i] = now - this.last;
    this.i = (this.i + 1) % N;
    this.filled = Math.min(N, this.filled + 1);
    if (this.el && now - this.shownAt > 500) {
      this.shownAt = now;
      const s = this.stats();
      this.el.textContent = `${s.fps.toFixed(0)} fps  frame ${s.avgFrameMs.toFixed(1)} ms (p95 ${s.p95FrameMs.toFixed(1)}, max ${s.maxFrameMs.toFixed(1)})  work ${s.avgWorkMs.toFixed(2)} ms${extra ? `  ${extra}` : ''}`;
    }
  }

  stats(): FrameStats {
    const n = Math.max(1, this.filled - 1);
    const f = Array.from(this.frame.subarray(0, this.filled))
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    const avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length);
    const w = this.work.subarray(0, this.filled);
    return {
      fps: avg > 0 ? 1000 / avg : 0,
      avgFrameMs: avg,
      p95FrameMs: f[Math.floor(f.length * 0.95)] ?? 0,
      maxFrameMs: f[f.length - 1] ?? 0,
      avgWorkMs: w.reduce((a, b) => a + b, 0) / n,
      over20ms: f.filter((v) => v > 20).length,
    };
  }

  /** Shows the overlay in the corner of the page. */
  show(): void {
    const el = document.createElement('pre');
    el.id = 'frame-meter';
    el.className = 'dev-meter';
    document.body.appendChild(el);
    this.el = el;
  }
}
