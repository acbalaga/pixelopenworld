import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../../src/shared/headers';

const dir = join(process.cwd(), 'src/assets/fonts');
const css = readFileSync(join(process.cwd(), 'src/style.css'), 'utf8');
const FILES = ['atkinson-hyperlegible-400.woff2', 'atkinson-hyperlegible-700.woff2'];

describe('bundled clear text font', () => {
  it('ships both weights as real woff2 files, small enough to be cheap', () => {
    let total = 0;
    for (const f of FILES) {
      const bytes = readFileSync(join(dir, f));
      expect(bytes.subarray(0, 4).toString('latin1'), f).toBe('wOF2');
      total += statSync(join(dir, f)).size;
    }
    expect(total).toBeLessThan(60 * 1024);
  });
  it('ships the OFL license text and the copyright line with it', () => {
    const lic = readFileSync(join(dir, 'OFL.txt'), 'utf8');
    expect(lic).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(lic).toContain('Braille Institute of America');
    const readme = readFileSync(join(dir, 'README.md'), 'utf8');
    expect(readme).toContain('SIL Open Font License');
    expect(readme).not.toContain('—');
  });
  it('is declared for both weights from our own files, with no outside host', () => {
    for (const f of FILES) expect(css).toContain(`./assets/fonts/${f}`);
    expect(css).toMatch(/font-weight: 400/);
    expect(css).toMatch(/font-weight: 700/);
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).not.toContain('fonts.googleapis');
  });
  it('is first in the clear text stack, with the system fonts behind it', () => {
    const m = /\.ui-root \{[^}]*font-family:\s*([^;]+);/s.exec(css);
    expect(m, 'ui-root font stack').not.toBeNull();
    const stack = (m as RegExpExecArray)[1] as string;
    expect(stack.trim().startsWith("'Atkinson Hyperlegible'")).toBe(true);
    expect(stack).toContain('system-ui');
    expect(stack).toContain('sans-serif');
  });
  it('needs no change to the CSP: fonts fall under default-src self', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'] as string;
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('font-src');
  });
});
