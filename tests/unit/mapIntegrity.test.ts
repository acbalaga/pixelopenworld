import { describe, expect, it } from 'vitest';
import { validateSave } from '../../src/save/integrity';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { addXp } from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import { addNote, mapSystem } from '../../src/sim/systems/map';
import { FULL_CHUNK } from '../../src/sim/world/fog';
import { plainFor } from '../support/saves';

function world(): { s: SimState; me: number } {
  const s = createDemoState(7, 0);
  s.world = { solidAt: (): number => 0 };
  const f = feetAt(40, 40);
  return { s, me: createAvatar(s, f.x, f.y) };
}

describe('integrity of map state', () => {
  const plainWith = (edit: (s: SimState) => void) => {
    const { s } = world();
    mapSystem(s);
    addNote(s, 1, 1, 'a note');
    edit(s);
    return plainFor(s);
  };
  const codes = (p: ReturnType<typeof plainFor>): string[] =>
    validateSave(p).reasons.map((r) => r.code);

  it('passes a map played honestly', () => {
    expect(codes(plainWith(() => {}))).not.toContain('MAP_STATE');
  });

  it('flags a damaged map', () => {
    expect(codes(plainWith((s) => (s.map.fog['slice']!['0,0'] = 'zz')))).toContain('MAP_STATE');
    expect(codes(plainWith((s) => (s.map.fog['slice']!['not a key'] = FULL_CHUNK)))).toContain(
      'MAP_STATE',
    );
    expect(codes(plainWith((s) => (s.map.notes[0]!.text = 'x'.repeat(200))))).toContain(
      'MAP_STATE',
    );
    expect(codes(plainWith((s) => s.map.rumors.push('rumor.nope')))).toContain('MAP_STATE');
    expect(codes(plainWith((s) => (s.map.notes[0]!.id = 99)))).toContain('MAP_STATE');
  });

  it('keeps Cartography XP inside what exploring could have earned', () => {
    const p = plainWith((s) => addXp(s, 0, 'skill.cartography', 5_000_000));
    expect(codes(p)).toContain('XP_IMPLAUSIBLE');
  });
});
