/**
 * Dev builds only: every Content Security Policy violation is logged as a console error, so the
 * e2e runs against the dev server fail on any. Production builds do not contain this file
 * (tools/check-dev-absent.ts), and there the policy is enforced by the headers alone.
 */
export function installCspReporter(): void {
  document.addEventListener('securitypolicyviolation', (e) => {
    console.error(`[csp] ${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`);
  });
}
