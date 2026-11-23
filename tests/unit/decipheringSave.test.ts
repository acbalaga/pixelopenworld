import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/content/items';
import { FIXTURES } from '../../src/content/world/fixtures';
import { MAX_TABLET_PLACEMENTS } from '../../src/save/integrity/bounds';
import { validateSave } from '../../src/save/integrity';
import { emit } from '../../src/sim/kernel/events';
import { pointsOf } from '../../src/sim/skills';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { skillsSystem } from '../../src/sim/systems/skills';
import { loadDawnmeadow } from '../../tools/endurance-bot/world';
import { Run } from '../support/bots';

const SKILL = 'skill.deciphering';
const TABLETS = loadDawnmeadow().objects.filter((o) => FIXTURES[o.kind]?.type === 'tablet');
const MANUALS = Object.values(ITEMS).filter((i) => i.manual);

describe('a save that has read everything (POW-M4-23E)', () => {
  it('holds the baked tablets within the bound the plausibility layer assumes', () => {
    expect(TABLETS.length).toBeLessThanOrEqual(MAX_TABLET_PLACEMENTS);
  });

  it('keeps a save that has read everything plausible', async () => {
    const run = new Run(52);
    // The first save starts the character's clock.
    await run.save();
    const ids = TABLETS.map((t) => spawnFixture(run.s, t.kind, t.x, t.y));
    for (const m of MANUALS) {
      run.s.events.list.length = 0;
      emit(run.s.events, { type: 'manualRead', who: run.me, item: m.id, technique: 'technique.x' });
      skillsSystem(run.s);
    }
    for (let round = 0; round < 12; round++) for (const id of ids) readTablet(run, id);
    expect(pointsOf(run.s, run.me, SKILL)).toBeGreaterThanOrEqual(13);
    // About half an hour of play to read and travel.
    run.run(30 * 60 * 30);
    await run.save();
    const snap = run.snapshots.at(-1)!;
    expect(validateSave(snap.loaded.plain).reasons).toEqual([]);
  });
});

function readTablet(run: Run, id: number): void {
  run.s.events.list.length = 0;
  emit(run.s.events, { type: 'tabletRead', id, who: run.me });
  skillsSystem(run.s);
}
