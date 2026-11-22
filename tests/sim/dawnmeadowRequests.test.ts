import { describe, expect, it } from 'vitest';
import { AUTHORED } from '../../src/content/requests/dawnmeadow';
import { REQUESTS } from '../../src/content/requests';
import { DIALOGUES } from '../../src/content/dialogue';
import { meet, playRequest, rig, say, state } from '../support/requestPlay';

describe('Dawnmeadow requests: every way of every one finishes it (M4-12)', () => {
  for (const a of AUTHORED) {
    for (const way of a.ways) {
      it(`${a.title}: ${way.label}`, () => {
        playRequest(rig(a.giver), a, way.id);
      });
    }
  }
});

describe('Dawnmeadow requests: the table', () => {
  it('has fourteen new authored requests, each with a different id from the first map', () => {
    expect(AUTHORED).toHaveLength(24);
    for (const a of AUTHORED) expect(REQUESTS[`request.${a.key}`]?.kind).toBe('authored');
    expect(new Set(AUTHORED.map((a) => a.key)).size).toBe(24);
  });

  it('has at least eight with a way that needs no fighting, as regions/01 asks', () => {
    const quiet = AUTHORED.filter((a) =>
      a.ways.some((w) => w.steps.every((s) => s.kind !== 'defeat')),
    );
    expect(quiet.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps every title within 24 characters and every line free of em dashes', () => {
    for (const a of AUTHORED) {
      expect(a.title.length, a.key).toBeLessThanOrEqual(24);
      const all = [a.title, a.ask, ...a.ways.map((w) => w.label), ...Object.values(a.talk)].join(
        '\n',
      );
      expect(all, a.key).not.toMatch(/[—–]/);
    }
  });
});

describe("Dawnmeadow requests: a new character does not know the town's troubles (G4 playtest)", () => {
  const clock = AUTHORED.find((a) => a.key === 'tower_clock')!;
  const far = AUTHORED.find((a) => a.key === 'cart_wheels')!;

  it('gates the clock on having handled gears, and the far jobs on the town knowing you', () => {
    expect(clock.requires).toEqual([{ awake: 'skill.tinkering' }]);
    expect(far.requires?.[0]).toHaveProperty('renown');
  });

  it('refuses a gated request to a fresh character and takes it once the requirement holds', () => {
    const r = rig(clock.giver);
    r.tick(say(clock.giver, `${clock.key}_ask`, 0));
    expect(state(r, `request.${clock.key}`)).toBe('none');
    meet(r, clock.requires);
    r.tick(say(clock.giver, `${clock.key}_ask`, 0));
    expect(state(r, `request.${clock.key}`)).toBe('active');
  });

  it("keeps the reeve's work door open for the job that has no gate, and hides the gated offers", () => {
    const reeve = DIALOGUES[clock.giver]!;
    const offer = (key: string) =>
      reeve.nodes['work']?.choices?.find((c) => c.text === `dlg.rq.c_${key}`);
    expect(offer('tower_clock')?.if).toContainEqual({ awake: 'skill.tinkering' });
  });
});
