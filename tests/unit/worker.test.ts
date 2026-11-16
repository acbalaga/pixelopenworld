import { describe, expect, it } from 'vitest';
import { route } from '../../worker/index';

describe('worker routes', () => {
  it('health returns ok and version, uncached, with security headers', async () => {
    const r = route(new Request('https://x.test/api/health'));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, version: 'test' });
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(r.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });
  it('unknown api path is JSON 404', async () => {
    const r = route(new Request('https://x.test/api/nope'));
    expect(r.status).toBe(404);
    expect(r.headers.get('Content-Type')).toContain('application/json');
    expect(await r.json()).toEqual({ error: 'not found' });
  });
  it('rejects non-GET health', () => {
    expect(route(new Request('https://x.test/api/health', { method: 'POST' })).status).toBe(405);
  });
});
