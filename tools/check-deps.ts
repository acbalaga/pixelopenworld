/**
 * Dependency review (tech/02, tech/04), run in CI: the shipped client has no runtime dependencies,
 * and the lockfile pins every package by integrity hash from the public registry.
 * `npm audit` is run separately; accepted exceptions are listed in docs/ops/security-review.md.
 */
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as Record<
  string,
  Record<string, string>
>;
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
  lockfileVersion: number;
  packages: Record<string, { resolved?: string; integrity?: string; link?: boolean }>;
};
const problems: string[] = [];

for (const k of ['dependencies', 'optionalDependencies', 'peerDependencies'])
  if (pkg[k] && Object.keys(pkg[k]).length > 0)
    problems.push(
      `package.json has ${k}: ${Object.keys(pkg[k]).join(', ')} (the client ships none)`,
    );

if (lock.lockfileVersion < 3) problems.push(`lockfileVersion ${lock.lockfileVersion}, want 3`);
let count = 0;
for (const [path, p] of Object.entries(lock.packages)) {
  if (path === '' || p.link) continue;
  count++;
  if (!p.integrity) problems.push(`${path}: no integrity hash`);
  if (!p.resolved?.startsWith('https://registry.npmjs.org/'))
    problems.push(`${path}: not resolved from the npm registry over https (${p.resolved})`);
}

if (problems.length > 0) {
  console.error(`check-deps: FAIL\n  ${problems.slice(0, 30).join('\n  ')}`);
  process.exit(1);
}
console.log(`check-deps: OK, no runtime dependencies, ${count} locked packages all with integrity`);
