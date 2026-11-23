import { describe, expect, it } from 'vitest';
import { REQUEST_BALANCE as RB } from '../../src/content/balance/requests';
import type { RequestDef } from '../../src/content/requests/types';
import { validateSave } from '../../src/save/integrity';
import { Run } from '../support/bots';
import { REQUEST } from '../../tools/sim-bot/policies';

/** A run whose board has handed the avatar a standing gather job, and that job. */
function withBoardJob(): { run: Run; gen: RequestDef } {
  const run = new Run(REQUEST.seed);
  REQUEST.setup?.(run);
  for (let n = 0; n < 6; n++) REQUEST.step(run, n);
  const j = run.s.entities.comps.journal[run.me]!;
  const id = Object.keys(j.requests).find((k) => k.startsWith('standing.'))!;
  return { run, gen: j.requests[id]!.gen! };
}

async function reasons(run: Run): Promise<string[]> {
  await run.save();
  return validateSave(run.snapshots.at(-1)!.loaded.plain).reasons.map((r) => r.code);
}

/** Sets the one step of a standing job. */
function setStep(gen: RequestDef, step: RequestDef['solutions'][number]['steps'][number]): void {
  gen.solutions[0]!.steps[0] = step;
}

describe('standing jobs pass the integrity check (POW-M4-23 triage B)', () => {
  it('passes a board gather hand-in at every quantity the generator rolls, and at its cap', async () => {
    const { run, gen } = withBoardJob();
    const step = gen.solutions[0]!.steps[0]!;
    expect(step.kind).toBe('deliver');
    const board = (gen.giver as { board: string }).board;
    const qtys = [
      ...Array.from(
        { length: RB.standing.gather.qty[1] - RB.standing.gather.qty[0] + 1 },
        (_v, i) => RB.standing.gather.qty[0] + i,
      ),
      RB.standing.gather.maxQty,
    ];
    for (const qty of qtys) {
      setStep(gen, { kind: 'deliver', item: (step as { item: string }).item, qty, to: board });
      expect(await reasons(run), `qty ${qty}`).toEqual([]);
    }
  });

  it('still flags a gather hand-in above its own cap', async () => {
    const { run, gen } = withBoardJob();
    const step = gen.solutions[0]!.steps[0] as { item: string; to: string };
    setStep(gen, {
      kind: 'deliver',
      item: step.item,
      qty: RB.standing.gather.maxQty + 1,
      to: step.to,
    });
    expect(await reasons(run)).toContain('REQUEST_STATE');
  });

  it('flags a shelf job (deliver to a person) above the deliver cap, and passes it at the cap', async () => {
    const { run, gen } = withBoardJob();
    const step = gen.solutions[0]!.steps[0] as { item: string };
    gen.titleKey = 'request.standing.deliver.title';
    setStep(gen, {
      kind: 'deliver',
      item: step.item,
      qty: RB.standing.deliver.maxQty,
      to: 'npc.shopkeeper',
    });
    expect(await reasons(run)).toEqual([]);
    setStep(gen, {
      kind: 'deliver',
      item: step.item,
      qty: RB.standing.deliver.maxQty + 1,
      to: 'npc.shopkeeper',
    });
    expect(await reasons(run)).toContain('REQUEST_STATE');
  });

  it('flags a gather-titled job that hands in to a person, and a shelf job that hands in to the board', async () => {
    const { run, gen } = withBoardJob();
    const step = gen.solutions[0]!.steps[0] as { item: string; to: string };
    setStep(gen, { kind: 'deliver', item: step.item, qty: 5, to: 'npc.shopkeeper' });
    expect(await reasons(run)).toContain('REQUEST_STATE');
    gen.titleKey = 'request.standing.deliver.title';
    setStep(gen, { kind: 'deliver', item: step.item, qty: 5, to: step.to });
    expect(await reasons(run)).toContain('REQUEST_STATE');
  });
});
