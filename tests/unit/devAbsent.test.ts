import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDevLeaks } from '../../tools/check-dev-absent';

function bundle(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'pow-dist-'));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  return dir;
}

describe('dev code check', () => {
  it('passes a clean bundle', () => {
    const dir = bundle({ 'index.html': '<canvas id="game">', 'assets/index-abc.js': 'var a=1' });
    expect(findDevLeaks(dir)).toEqual([]);
  });
  it('flags a dev overlay id in a script', () => {
    const dir = bundle({ 'assets/index-abc.js': 'e.id="pow-dev-overlay"' });
    expect(findDevLeaks(dir)).toHaveLength(1);
  });
  it('flags the map viewer route', () => {
    const dir = bundle({ 'assets/index.js': 'p==="/dev/map"' });
    expect(findDevLeaks(dir)).toHaveLength(1);
  });
  it('flags a dev route string and a dev-named file', () => {
    const dir = bundle({ 'assets/dev-sprites-1.js': 'x', 'assets/index.js': 'p==="/dev/sprites"' });
    expect(findDevLeaks(dir).length).toBeGreaterThanOrEqual(2);
  });
});
