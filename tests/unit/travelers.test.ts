import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CREATURES } from '../../src/content/creatures';
import { NPCS } from '../../src/content/dialogue';
import { PLACES } from '../../src/content/people/places';
import { SKILLS } from '../../src/content/skills';
import { HAND_TUNED } from '../../src/content/travelers/handTuned';
import { GUILDS } from '../../src/content/travelers/guilds';
import { BLOCKLIST, isBlocked, normalizeForBlock } from '../../src/content/travelers/blocklist';
import { HAND_TUNED_COUNT, TRAVELER_COUNT } from '../../src/content/balance/travelers';
import { ACTIVITIES } from '../../src/content/travelers/types';
import { gzip } from '../../src/save/compress';
import { decodeLives, encodeLives } from '../../src/save/binary';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate, MIGRATIONS } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { deriveSummary } from '../../src/shared/summary';
import { createStream, int } from '../../src/sim/kernel/rng';
import { canonical, createDemoState, deserializeState, serializeState } from '../../src/sim/state';
import {
  identitiesOf,
  identityOf,
  initialLife,
  initialLives,
  normalizeHandle,
  MEMORY_RING,
  PLACE_LIST,
  SKILL_LIST,
  type TravelerLife,
} from '../../src/sim/travelers';

describe('Traveler identities', () => {
  it('makes 240, hand-tuned first, and derives the same ones from the same seed', () => {
    const a = identitiesOf(12345);
    expect(a).toHaveLength(TRAVELER_COUNT);
    expect(a.slice(0, HAND_TUNED_COUNT).map((t) => t.handle)).toEqual(
      HAND_TUNED.map((h) => h.handle),
    );
    expect(canonical(identitiesOf(12345))).toBe(canonical(a));
    expect(identityOf(12345, 77)).toBe(a[77]);
    expect(canonical(identitiesOf(54321))).not.toBe(canonical(a));
  });

  it('is byte-identical across two independent runs', () => {
    const run = (): string => {
      // A fresh state has no shared cache with identitiesOf's memo: build twice through the demo path.
      return canonical([identitiesOf(999).map((t) => t), initialLives(999)]);
    };
    expect(run()).toBe(run());
    expect(serializeState(createDemoState(999, 0))).toBe(serializeState(createDemoState(999, 0)));
  });

  it('has no duplicate handles, no blocklist hit and no content name across 1,000 seeds', () => {
    const reserved = new Set<string>();
    for (const n of Object.values(NPCS)) reserved.add(normalizeHandle(n.name));
    for (const c of Object.values(CREATURES)) reserved.add(normalizeHandle(c.name));
    for (const s of Object.values(SKILLS)) reserved.add(normalizeHandle(s.name));
    for (const id of Object.keys(PLACES))
      reserved.add(normalizeHandle((id.split('.').pop() ?? id).replace(/_/g, ' ')));
    for (let seed = 1; seed <= 1000; seed++) {
      const seen = new Set<string>();
      for (const t of identitiesOf(seed * 7919)) {
        const n = normalizeHandle(t.handle);
        expect(seen.has(n), `seed ${seed}: duplicate ${t.handle}`).toBe(false);
        seen.add(n);
        expect(isBlocked(t.handle), `seed ${seed}: blocked ${t.handle}`).toBe(false);
        expect(reserved.has(n), `seed ${seed}: content name ${t.handle}`).toBe(false);
        expect(t.handle.length).toBeGreaterThanOrEqual(3);
        expect(t.handle.length).toBeLessThanOrEqual(16);
      }
    }
  });

  it('keeps every field in its range and every skill and guild real', () => {
    for (const t of identitiesOf(31337)) {
      expect(t.focus.length).toBeGreaterThanOrEqual(2);
      expect(t.focus.length).toBeLessThanOrEqual(4);
      for (const f of t.focus) expect(SKILLS[f], f).toBeDefined();
      expect(t.pace).toBeGreaterThanOrEqual(0.6);
      expect(t.pace).toBeLessThanOrEqual(1.6);
      expect(t.home).toBeGreaterThanOrEqual(1);
      expect(t.home).toBeLessThanOrEqual(8);
      expect(t.phase).toBeGreaterThanOrEqual(-40);
      expect(t.phase).toBeLessThanOrEqual(40);
      expect(t.guild === 0 || GUILDS.some((g) => g.id === t.guild)).toBe(true);
      expect(t.ties.length).toBeLessThanOrEqual(3);
      for (const tie of t.ties) expect(tie.slot).not.toBe(t.slot);
    }
  });

  it('keeps ties symmetric', () => {
    const all = identitiesOf(2024);
    for (const t of all)
      for (const tie of t.ties) {
        const back = all[tie.slot]!.ties.find((x) => x.slot === t.slot);
        expect(back, `${t.handle} to ${all[tie.slot]!.handle}`).toBeDefined();
        expect(back!.kind).toBe(tie.kind);
      }
  });

  it('gives the 24 hand-tuned Travelers distinct hair, and matches the design table', () => {
    const pairs = new Set<string>();
    for (const t of identitiesOf(1).slice(0, HAND_TUNED_COUNT))
      pairs.add(`${t.look.hair}|${t.look.hairColor}`);
    expect(pairs.size).toBe(HAND_TUNED_COUNT);
    expect(HAND_TUNED.map((h) => h.slot)).toEqual([...Array(24).keys()]);
    // A hand-tuned Traveler looks the same in every save.
    expect(identityOf(1, 6).look).toEqual(identityOf(2, 6).look);
    // The standing ties of design/12 section 6.
    const has = (a: number, b: number, kind: string): boolean =>
      HAND_TUNED[a]!.ties.some((t) => t.slot === b && t.kind === kind);
    expect(has(1, 11, 'friend') && has(11, 1, 'friend')).toBe(true);
    expect(has(3, 9, 'rival') && has(9, 3, 'rival')).toBe(true);
    expect(has(6, 22, 'sibling') && has(22, 6, 'sibling')).toBe(true);
    expect(has(1, 12, 'mentor') && has(12, 1, 'mentor')).toBe(true);
    expect(has(18, 12, 'friend') && has(12, 18, 'friend')).toBe(true);
  });

  it('keeps the crowd varied at a glance', () => {
    const ids = identitiesOf(555);
    const pairs = new Set(ids.map((t) => `${t.look.hair}|${t.look.hairColor}`));
    expect(pairs.size).toBeGreaterThan(80);
    const arch = new Set(ids.map((t) => t.archetype));
    expect(arch.size).toBe(10);
    const sched = new Set(ids.map((t) => t.schedule));
    expect(sched.size).toBe(10);
  });
});

describe('the handle blocklist', () => {
  const bad = [
    'fuck',
    'F_U_C_K',
    'fvck'.replace('v', 'u'),
    'sh1t',
    'sh!t',
    'xX_shit_Xx',
    'b1tch',
    'B.I.T.C.H',
    'n1gg3r',
    'n_i_g_g_a',
    'f4gg0t',
    'Hitler',
    'h1tl3r',
    'Nazi99',
    'p0rn',
    'Admin',
    '4dm1n',
    'M0derator',
    'g00gle',
    'Faceb00k',
    'N1ke',
    'Tr_ump',
    'b1den',
    'cunt',
    'c u n t',
    'whore',
    'wh0r3',
    'killyourself',
    'k1ll_y0urs3lf',
    'fuuuck',
    'Pokem0n',
  ];
  it('rejects every known-bad entry, including leetspeak and separator variants', () => {
    for (const b of bad) expect(isBlocked(b), b).toBe(true);
  });
  it('lets the hand-tuned handles and ordinary names through', () => {
    for (const h of HAND_TUNED) expect(isBlocked(h.handle), h.handle).toBe(false);
    for (const ok of [
      'Nightowl',
      'Nigel',
      'Grape',
      'Draper',
      'Raccoon',
      'Spice',
      'Kestrel99',
      'Shoes',
    ])
      expect(isBlocked(ok), ok).toBe(false);
  });
  it('is stored in its normalized form', () => {
    for (const t of BLOCKLIST) expect(normalizeForBlock(t)).toBe(t);
  });
});

const life = (i: number, full: boolean): TravelerLife => ({
  build: full ? SKILL_LIST.map((_, k) => [k, 40 + ((i + k) % 55)] as [number, number]) : [[0, 5]],
  paths: full ? 0x1f : 0,
  coin: full ? 1000 + i * 37 : 0,
  place: i % PLACE_LIST.length,
  activity: i % ACTIVITIES.length,
  subject: i,
  guild: i % 13,
  regardTier: 2,
  regardPts: 80 + (i % 60),
  flags: 0x1f,
  memory: Array.from({ length: full ? MEMORY_RING : 0 }, (_, k) => ({
    kind: k % 11,
    subject: (i * 7 + k * 13) % 600,
    day: 40 + ((i + k) % 80),
  })),
  lastSeen: 100000 + i * 11,
  lineCursor: i,
});

describe('the binary Traveler encoding', () => {
  it('round trips exactly', () => {
    const lives = initialLives(77);
    expect(decodeLives(encodeLives(lives))).toEqual(lives);
    const full = Array.from({ length: 240 }, (_, i) => life(i, true));
    expect(decodeLives(encodeLives(full))).toEqual(full);
  });

  it('keeps the worst case, every Traveler a Friend with a full memory ring, under 40 KB compressed', async () => {
    // Worst case also means every skill carries points, which no real build does.
    const worst = Array.from({ length: 240 }, (_, i) => life(i, true));
    const raw = encodeLives(worst);
    const packed = await gzip(raw);
    console.log(
      `240 lives, worst case: ${raw.length} bytes raw, ${packed.length} bytes compressed`,
    );
    expect(packed.length).toBeLessThan(40 * 1024);
    // A realistic late save, sparse builds and half-full rings.
    const real = initialLives(5).map((l, i) => ({
      ...l,
      ...life(i, false),
      memory: life(i, true).memory.slice(0, 12),
    }));
    const realPacked = await gzip(encodeLives(real));
    console.log(`240 lives, typical: ${realPacked.length} bytes compressed`);
    expect(realPacked.length).toBeLessThan(packed.length);
  });

  it('refuses damaged input instead of building a nonsense Traveler', () => {
    const good = encodeLives(initialLives(3));
    expect(() => decodeLives(good.subarray(0, good.length - 3))).toThrow();
    expect(() =>
      decodeLives(new Uint8Array([200, 200, 200, 200, 200, 200, 200, 200, 255])),
    ).toThrow();
    const trailing = new Uint8Array(good.length + 1);
    trailing.set(good);
    expect(() => decodeLives(trailing)).toThrow();
    const r = createStream(1, 'misc');
    for (let n = 0; n < 200; n++) {
      const junk = new Uint8Array(40).map(() => int(r, 0, 255));
      try {
        decodeLives(junk);
      } catch {
        /* a throw is the right answer */
      }
    }
  });

  it('starts every life inside its fields and below its Traveler plateau', () => {
    for (const t of identitiesOf(8)) {
      const l = initialLife(t);
      for (const [, p] of l.build) expect(p).toBeLessThanOrEqual(t.plateau);
      expect(l.place).toBeGreaterThanOrEqual(0);
      expect(l.guild).toBe(t.guild);
    }
  });
});

describe('the state and the save', () => {
  it('round trips the lives through the sim text', () => {
    const s = createDemoState(4242, 0);
    s.travelers[3]!.coin += 17;
    s.travelers[200]!.memory.push({ kind: 2, subject: 9, day: 5 });
    const back = deserializeState(serializeState(s));
    expect(back.travelers).toEqual(s.travelers);
    expect(serializeState(back)).toBe(serializeState(s));
  });

  it('has traveler totals in the summary', () => {
    const s = createDemoState(4242, 0);
    const d = deriveSummary(s, 0);
    expect(d.travelerPoints).toBeGreaterThan(0);
    expect(d.travelerCoin).toBe(s.travelers.reduce((a, l) => a + l.coin, 0));
  });
});

describe('schema 29 to 30 migration (Travelers)', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-29.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };
  const decode = (): Promise<SavePlain> =>
    new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));

  it('finds 240 lives matching a fresh generation from the fixture seed', async () => {
    expect(f.plain.schema).toBe(29);
    expect(JSON.parse(f.plain.sim)).not.toHaveProperty('travelers');
    const at30 = migrate(await decode(), MIGRATIONS, 30);
    expect(at30.schema).toBe(30);
    const s = deserializeState(at30.sim);
    expect(s.travelers).toHaveLength(240);
    expect(s.travelers).toEqual(initialLives(s.seed));
    expect(at30.summary.travelerPoints).toBeGreaterThan(0);
  });

  it('reaches the current schema and passes every integrity layer', async () => {
    const now = migrate(await decode());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });
});
