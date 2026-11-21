import { describe, expect, it } from 'vitest';
import { AUTHORED } from '../../src/content/requests/dawnmeadow';
import { REQUESTS } from '../../src/content/requests';
import { playRequest, rig } from '../support/requestPlay';

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
