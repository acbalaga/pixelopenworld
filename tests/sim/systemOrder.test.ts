import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { emit } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { WORLD_SYSTEMS } from '../../src/sim/step';
import { bestiarySystem } from '../../src/sim/systems/bestiary';
import { deedsSystem, pathsSystem } from '../../src/sim/systems/deeds';
import { mapSystem } from '../../src/sim/systems/map';
import { singularsSystem } from '../../src/sim/systems/singulars';
import { SKILLS_READS, skillsSystem } from '../../src/sim/systems/skills';
import { TRIALS_READS, trialsSystem } from '../../src/sim/systems/trials';

/** Every event type the two readers use. */
const READ = new Set<string>([...SKILLS_READS, ...TRIALS_READS]);

/** Systems that run after the readers today. */
const AFTER = WORLD_SYSTEMS.slice(WORLD_SYSTEMS.indexOf(skillsSystem) + 1);

/** A state with an avatar, a few events of the kinds the late systems react to, and a fed fog. */
function scripted(): SimState {
  const s = createDemoState(11, 0);
  s.world = { solidAt: () => 0 };
  const f = feetAt(40, 40);
  const me = createAvatar(s, f.x, f.y);
  emit(s.events, { type: 'killed', src: me, dst: 99, kind: 'creature.mossling', tag: 'sword' });
  emit(s.events, { type: 'befriended', who: me, id: 98, kind: 'creature.fox' });
  emit(s.events, { type: 'itemDropped', who: me, item: 'item.stick', qty: 1, pickup: 97 });
  emit(s.events, { type: 'damageDealt', src: 99, dst: me, amount: 3 } as never);
  return s;
}

describe('system order', () => {
  it('runs the map before the systems that read what it sends', () => {
    const i = WORLD_SYSTEMS.indexOf(mapSystem);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(WORLD_SYSTEMS.indexOf(trialsSystem));
    expect(i).toBeLessThan(WORLD_SYSTEMS.indexOf(skillsSystem));
  });

  it('has the systems this test expects after the readers', () => {
    expect(AFTER).toEqual([deedsSystem, pathsSystem, singularsSystem, bestiarySystem]);
  });

  it('lists event types that exist', () => {
    expect(READ.has('revealed')).toBe(true);
    expect(READ.size).toBeGreaterThan(15);
  });

  it('no system after the readers emits an event they read (run alone)', () => {
    for (const sys of AFTER) {
      const s = scripted();
      const before = s.events.list.length;
      sys(s);
      const sent = s.events.list.slice(before).map((e) => e.type);
      expect(
        sent.filter((t) => READ.has(t)),
        `${sys.name} sends an event that skills or trials read`,
      ).toEqual([]);
    }
  });

  it('no system after the readers names a read event in an emit (source scan)', () => {
    const files = ['deeds', 'singulars', 'bestiary'];
    const found: string[] = [];
    for (const f of files) {
      const src = readFileSync(
        join(__dirname, '..', '..', 'src', 'sim', 'systems', `${f}.ts`),
        'utf8',
      );
      for (const m of src.matchAll(/emit\([^)]*?type:\s*'(\w+)'/g))
        if (m[1] && READ.has(m[1])) found.push(`${f}:${m[1]}`);
    }
    expect(found).toEqual([]);
  });
});
