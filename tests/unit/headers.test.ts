import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../../src/shared/headers';

/** The `/*` block of public/_headers, as a map. */
function staticHeaders(): Record<string, string> {
  const text = readFileSync(join(process.cwd(), 'public', '_headers'), 'utf8');
  const block = text.split(/\n\s*\n/).find((b) => b.startsWith('/*'));
  if (!block) throw new Error('no /* block in _headers');
  const out: Record<string, string> = {};
  for (const line of block.split('\n').slice(1)) {
    const m = /^\s+([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (m) out[m[1] as string] = (m[2] as string).trim();
  }
  return out;
}

const csp = (v: string): Record<string, string[]> =>
  Object.fromEntries(
    v
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map((d) => [d[0] as string, d.slice(1)]),
  );

describe('security headers (tech/02 "Client hardening", T8)', () => {
  const policy = csp(SECURITY_HEADERS['Content-Security-Policy'] as string);

  it('static responses and API responses carry the same policy and headers', () => {
    const s = staticHeaders();
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(s[k], k).toBe(v);
  });

  it('static responses also deny every unused browser feature', () => {
    const pp = staticHeaders()['Permissions-Policy'] as string;
    for (const f of ['camera', 'microphone', 'geolocation', 'payment', 'usb'])
      expect(pp).toContain(`${f}=()`);
  });

  it('the policy allows only this origin, with no inline script, no eval, no third parties', () => {
    for (const d of ['default-src', 'script-src', 'style-src', 'connect-src', 'worker-src'])
      expect(policy[d], d).toEqual(["'self'"]);
    expect(policy['object-src']).toEqual(["'none'"]);
    expect(policy['base-uri']).toEqual(["'none'"]);
    expect(policy['frame-ancestors']).toEqual(["'none'"]);
    expect(policy['form-action']).toEqual(["'none'"]);
    const all = SECURITY_HEADERS['Content-Security-Policy'] as string;
    expect(all).not.toMatch(/unsafe-inline|unsafe-eval|unsafe-hashes|https?:|\*|wss?:/);
  });

  it('the other headers are the strict ones', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('no-referrer');
    expect(SECURITY_HEADERS['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toMatch(/max-age=\d{8,}/);
  });
});
