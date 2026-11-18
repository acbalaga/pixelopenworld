import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { deserializeState } from '../../src/sim/state';
import { honestPlain, tamper } from '../support/saves';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-13.json'), 'utf8'),
) as { plain: SavePlain };

describe('schema 13 to 14 migration', () => {
  it('copies the slots into loadout 0, leaves loadout 1 empty, and keeps a taught technique known', async () => {
    expect(fixture.plain.schema).toBe(13);
    const before = deserializeState(fixture.plain.sim);
    const me = before.entities.comps.avatar.findIndex((a) => a);
    const slots = [...before.entities.comps.fighter[me]!.slots];
    expect(slots[1]).toBe('technique.ember_bolt');

    const now = migrate(
      await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(fixture.plain))),
    );
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    const ld = s.entities.comps.loadouts[me]!;
    expect(ld.active).toBe(0);
    expect(ld.sets[0].slots).toEqual(slots);
    expect(ld.sets[1]).toEqual({ main: null, off: null, slots: [null, null, null, null] });
    expect(s.entities.comps.channel.every((c) => c === null)).toBe(true);
    expect(s.entities.comps.journal[me]!.flags).toContain('learned.technique.ember_bolt');
    expect(s.entities.comps.fighter[me]!.slots).toEqual(slots);
    expect(s.entities.comps.skills[me]!.points['skill.blades']).toBe(2);
    expect(validateSave(now).reasons.filter((r) => r.code !== 'XP_IMPLAUSIBLE')).toEqual([]);
  });
});

describe('integrity: TECHNIQUE_UNKNOWN', () => {
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
  const plain = honestPlain();
  const slotted = (slot: number, id: string, points = 0): SavePlain =>
    tamper(plain, (s, me) => {
      s.entities.comps.fighter[me]!.slots[slot] = id;
      const sk = s.entities.comps.skills[me]!;
      if (points) sk.points['skill.blades'] = points;
    });

  it('passes an honest save and a technique its skill has earned', () => {
    expect(codes(plain)).not.toContain('TECHNIQUE_UNKNOWN');
    // Hum of Courage is taught: it needs its skill awake and the learned flag.
    const taught = tamper(plain, (s, me) => {
      s.entities.comps.fighter[me]!.slots[1] = 'technique.performance_hum';
      s.entities.comps.skills[me]!.awake.push('skill.performance');
      s.entities.comps.journal[me]!.flags.push('learned.technique.performance_hum');
    });
    expect(codes(taught)).not.toContain('TECHNIQUE_UNKNOWN');
    // Without the lesson it is flagged.
    expect(codes(slotted(1, 'technique.performance_hum'))).toContain('TECHNIQUE_UNKNOWN');
  });
  it('flags a band the skill has not reached, a taught technique never taught, and an unknown id', () => {
    expect(codes(slotted(1, 'technique.heavy_whirl'))).toContain('TECHNIQUE_UNKNOWN');
    expect(codes(slotted(1, 'technique.tide_splash'))).toContain('TECHNIQUE_UNKNOWN');
    expect(codes(slotted(1, 'technique.nope'))).toContain('TECHNIQUE_UNKNOWN');
  });
  it('checks the other loadout too', () => {
    const p = tamper(plain, (s, me) => {
      s.entities.comps.loadouts[me]!.sets[1].slots[2] = 'technique.stone_earth_wall';
    });
    expect(codes(p)).toContain('TECHNIQUE_UNKNOWN');
  });
});
