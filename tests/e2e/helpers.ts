import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';

/** Screenshots land here, outside Playwright's outputDir (which it empties each run). */
export const SHOT_DIR = join(process.cwd(), 'e2e-screenshots');

/** Everything that must stay empty for a clean run. */
export interface Problems {
  console: string[];
  pageErrors: string[];
  csp: string[];
  failedRequests: string[];
}

/** Starts collecting console errors and warnings, uncaught errors, CSP violations, bad responses. */
export async function watchProblems(page: Page): Promise<Problems> {
  const p: Problems = { console: [], pageErrors: [], csp: [], failedRequests: [] };
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') p.console.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => p.pageErrors.push(String(e)));
  page.on('requestfailed', (r) => p.failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.status() >= 400) p.failedRequests.push(`${r.status()} ${r.url()}`);
  });
  // Runs inside the page before any script. Test-side only, not part of the app.
  await page.exposeFunction('__reportCsp', (msg: string) => p.csp.push(msg));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      void (window as unknown as { __reportCsp: (m: string) => void }).__reportCsp(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  return p;
}

/** Saves a full-page screenshot as `e2e-screenshots/<name>.png` and returns the PNG bytes. */
export async function shot(page: Page, name: string): Promise<Buffer> {
  mkdirSync(SHOT_DIR, { recursive: true });
  return page.screenshot({ path: join(SHOT_DIR, `${name}.png`) });
}

/** Fraction of pixels that differ between two same-size PNGs. */
export function diffFraction(a: Buffer, b: Buffer): number {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  if (pa.width !== pb.width || pa.height !== pb.height) return 1;
  let diff = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    if (
      pa.data[i] !== pb.data[i] ||
      pa.data[i + 1] !== pb.data[i + 1] ||
      pa.data[i + 2] !== pb.data[i + 2]
    ) {
      diff++;
    }
  }
  return diff / (pa.data.length / 4);
}
