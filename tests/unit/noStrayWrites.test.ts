import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'fixtures' ? [] : sources(rel);
    return /\.(ts|mts)$/.test(e.name) ? [rel] : [];
  });
}

describe('tests and tools', () => {
  it('never write to a fixed path under /tmp (CI has no such directory; use os.tmpdir())', () => {
    const bad = [...sources('tests'), ...sources('tools')].filter((f) => {
      if (f.endsWith('noStrayWrites.test.ts')) return false;
      return /(appendFileSync|writeFileSync|mkdirSync|createWriteStream)\s*\(\s*['"`]\/tmp\//.test(
        readFileSync(join(ROOT, f), 'utf8'),
      );
    });
    expect(bad).toEqual([]);
  });
});
