// Temporary demo (M0-08). M0-05 replaces the drawing with the real renderer.
import { attachInput } from '../platform/input/dom';
import { toCommands } from '../platform/input/sampler';
import { startBrowserLoop } from '../platform/loop';
import { createDemoState, DEMO_BOX } from '../sim/state';
import { step } from '../sim/step';
import { setComp } from '../sim/kernel/entities';

/** Runs the sim demo on a canvas: entity 0 (yellow) follows input, the rest drift. */
export function startInputDemo(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const state = createDemoState(1, 30);
  setComp(state.entities, 0, 'vel', { x: 0, y: 0 });
  const input = attachInput(canvas, { leftHanded: () => false });
  let prevDir: number | null = null;

  startBrowserLoop({
    tick: () => {
      const rec = input.sampler.sample(performance.now());
      step(state, { commands: toCommands(rec, prevDir) });
      prevDir = rec.moveDir;
    },
    render: () => {
      const scale = Math.max(1, Math.floor(Math.min(canvas.width / 160, canvas.height / 240)));
      ctx.fillStyle = '#3a6ea5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#22304a';
      ctx.fillRect(0, 0, (DEMO_BOX.x / 256) * scale, (DEMO_BOX.y / 256) * scale);
      const { pos } = state.entities.comps;
      pos.forEach((p, id) => {
        if (!p) return;
        ctx.fillStyle = id === 0 ? '#ffd23f' : '#e8e8e8';
        ctx.fillRect(Math.round((p.x / 256) * scale), Math.round((p.y / 256) * scale), 6, 6);
      });
    },
  });
}
