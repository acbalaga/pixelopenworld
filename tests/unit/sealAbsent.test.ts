import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSealLeaks, renderings } from '../../tools/check-seal-absent';
import { combineFragments } from '../../src/save/seal/derive';
import { FRAGMENTS } from '../../src/save/seal/v1';

function bundle(files: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'pow-seal-dist-'));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

describe('seal material check', () => {
  it('passes a bundle that holds the fragments but never the combined material', async () => {
    const material = await combineFragments(FRAGMENTS, 1);
    // The fragments themselves are separate literals, as the build ships them.
    const js = FRAGMENTS.map((f) => `new Uint8Array([${[...f].join(',')}])`).join(';');
    const dir = bundle({ 'assets/index.js': js });
    expect(findSealLeaks(dir, [{ label: 'v1', bytes: material }])).toEqual([]);
  });

  it('flags the combined material in every form it could take', async () => {
    const material = await combineFragments(FRAGMENTS, 1);
    for (const r of renderings(material)) {
      const dir = bundle({
        'assets/a.js': Buffer.concat([Buffer.from('var x="'), r.needle, Buffer.from('";')]),
      });
      const leaks = findSealLeaks(dir, [{ label: 'v1', bytes: material }]);
      expect(leaks.length, r.name).toBeGreaterThan(0);
      expect(leaks[0]).toContain('assets/a.js');
    }
  });

  it('the real fragments, combined, are 32 bytes and differ from each fragment', async () => {
    const material = await combineFragments(FRAGMENTS, 1);
    expect(material.length).toBe(32);
    for (const f of FRAGMENTS) expect(Buffer.from(material).includes(Buffer.from(f))).toBe(false);
  });
});
