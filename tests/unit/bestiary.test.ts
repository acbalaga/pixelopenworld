import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { migrate, MIGRATIONS } from '../../src/save/migrations';
import { validateSave } from '../../src/save/integrity';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { emit } from '../../src/sim/kernel/events';
import { recordKill } from '../../src/sim/ledger';
import { createDemoState, deserializeState, hashState } from '../../src/sim/state';
import { bestiarySystem } from '../../src/sim/systems/bestiary';
import { bestiaryView } from '../../src/ui/menu/bestiaryModel';

function rig() {
  const s = createDemoState(2, 0);
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y, 'Dex_1');
  return { s, me };
}

describe('the Bestiary (M4-05)', () => {
  it('is empty until a creature is killed or befriended', () => {
    const { s, me } = rig();
    expect(bestiaryView(s, me).rows).toEqual([]);
    // Seeing a creature act is not enough to open its entry.
    emit(s.events, {
      type: 'temperamentSeen',
      id: 99,
      target: me,
      kind: 'creature.mossling',
      temperament: 'curious',
    });
    bestiarySystem(s);
    expect(bestiaryView(s, me).rows).toEqual([]);
  });

  it('opens on a first kill, from the ledger, and shows only temperaments it has seen', () => {
    const { s, me } = rig();
    recordKill(s, 'creature.mossling');
    expect(bestiaryView(s, me).rows[0]).toMatchObject({
      name: 'Mossling',
      // The picture the Chronicle draws is this sprite's idle frame.
      sprite: 'creature.mossling',
      kills: 'Defeated 1',
      temperament: 'Temperament not yet seen',
      befriended: false,
    });
    emit(s.events, {
      type: 'temperamentSeen',
      id: 99,
      target: me,
      kind: 'creature.mossling',
      temperament: 'curious',
    });
    bestiarySystem(s);
    // The same sighting twice is kept once.
    emit(s.events, {
      type: 'temperamentSeen',
      id: 99,
      target: me,
      kind: 'creature.mossling',
      temperament: 'territorial',
    });
    bestiarySystem(s);
    bestiarySystem(s);
    expect(bestiaryView(s, me).rows[0]?.temperament).toBe('Seen to be: Curious, Territorial');
    expect(s.entities.comps.journal[me]?.bestiary['creature.mossling']?.temperaments).toEqual([
      'curious',
      'territorial',
    ]);
  });

  it('opens on a first friend, and ignores what another avatar was shown', () => {
    const { s, me } = rig();
    emit(s.events, {
      type: 'temperamentSeen',
      id: 5,
      target: me + 7,
      kind: 'creature.fox',
      temperament: 'curious',
    });
    emit(s.events, { type: 'befriended', who: me + 7, id: 5, kind: 'creature.fox' });
    bestiarySystem(s);
    expect(bestiaryView(s, me).rows).toEqual([]);
    emit(s.events, { type: 'befriended', who: me, id: 5, kind: 'creature.fox' });
    bestiarySystem(s);
    expect(bestiaryView(s, me).rows[0]).toMatchObject({ name: 'Fox', befriended: true });
  });

  it('never lists the training dummy, and counts known against all', () => {
    const { s, me } = rig();
    recordKill(s, 'creature.training_dummy');
    recordKill(s, 'creature.fox');
    const v = bestiaryView(s, me);
    expect(v.rows.map((r) => r.name)).toEqual(['Fox']);
    expect(v.count).toMatch(/^1 of \d+ creatures known$/);
  });

  it('ignores an unknown creature id in an event', () => {
    const { s, me } = rig();
    emit(s.events, { type: 'befriended', who: me, id: 5, kind: 'creature.nothing' });
    bestiarySystem(s);
    expect(s.entities.comps.journal[me]?.bestiary).toEqual({});
  });
});

describe('schema 26 to 27 migration (the Bestiary)', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-26.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };

  it('loads the previous fixture with an empty Bestiary and nothing else changed', async () => {
    expect(f.plain.schema).toBe(26);
    expect(JSON.parse(f.plain.sim).entities.comps.journal[0]).not.toHaveProperty('bestiary');
    const decoded = await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
    const at27 = migrate(decoded, MIGRATIONS, 27);
    expect(at27.schema).toBe(27);
    const s = deserializeState(at27.sim);
    for (const j of s.entities.comps.journal) {
      if (!j) continue;
      expect(j.bestiary).toEqual({});
      delete (j as { bestiary?: unknown }).bestiary;
    }
    delete (s as { travelers?: unknown }).travelers;
    delete (s as { mail?: unknown }).mail;
    delete (s as { guild?: unknown }).guild;
    delete (s.mail?.duels as { pit?: number } | undefined)?.pit;
    delete (s.mail?.duels as { honor?: number } | undefined)?.honor;
    expect(hashState(s)).toBe(f.expectedHash);
  });

  it('reaches the current schema, keeps the kills the ledger counted, and passes the integrity check', async () => {
    const decoded = await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
    const now = migrate(decoded);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    const me = s.entities.comps.avatar.findIndex((a) => a);
    expect(bestiaryView(s, me).rows.map((r) => r.name)).toEqual(['Mossling']);
    expect(validateSave(now).reasons).toEqual([]);
  });
});
