// Fails if the production bundle contains the combined seal material as a contiguous byte or
// string literal (tech/02, POW-M2-03). The fragments are allowed: they are separate literals and
// only become the material when the code combines them at runtime. The derived key cannot be
// searched for, since it depends on a random salt per file and is never written down.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { combineFragments } from '../src/save/seal/derive';
import { SEAL_VERSIONS } from '../src/save/seal/registry';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Every way the bytes could sit in a bundle as text, and the raw bytes themselves. */
export function renderings(bytes: Uint8Array): { name: string; needle: Buffer }[] {
  const raw = Buffer.from(bytes);
  const list = [...bytes];
  return [
    { name: 'raw bytes', needle: raw },
    { name: 'hex', needle: Buffer.from(raw.toString('hex')) },
    { name: 'HEX', needle: Buffer.from(raw.toString('hex').toUpperCase()) },
    { name: 'base64', needle: Buffer.from(raw.toString('base64')) },
    { name: 'base64url', needle: Buffer.from(raw.toString('base64url')) },
    { name: 'decimal list', needle: Buffer.from(list.join(',')) },
    { name: 'decimal list, spaced', needle: Buffer.from(list.join(', ')) },
    { name: '0x list', needle: Buffer.from(list.map((b) => `0x${b.toString(16)}`).join(',')) },
    {
      name: '\\x escapes',
      needle: Buffer.from(list.map((b) => `\\x${b.toString(16).padStart(2, '0')}`).join('')),
    },
  ];
}

/** One message per file and rendering of `material` found under `dir`. */
export function findSealLeaks(
  dir: string,
  materials: { label: string; bytes: Uint8Array }[],
): string[] {
  const leaks: string[] = [];
  const files = walk(dir).map((f) => ({ rel: relative(dir, f), data: readFileSync(f) }));
  for (const m of materials)
    for (const r of renderings(m.bytes))
      for (const f of files)
        if (f.data.includes(r.needle)) leaks.push(`${f.rel}: contains ${m.label} as ${r.name}`);
  return leaks;
}

/** The combined material of every version the build knows, committed or from the build variable. */
async function builtMaterials(): Promise<{ label: string; bytes: Uint8Array }[]> {
  const out: { label: string; bytes: Uint8Array }[] = [];
  const hex = (s: string): Uint8Array =>
    Uint8Array.from(s.match(/../g) ?? [], (b) => Number.parseInt(b, 16));
  const env = process.env.POW_SEAL_MATERIAL;
  if (env) {
    const parsed = JSON.parse(env) as { versions: Record<string, string[]> };
    for (const [v, frags] of Object.entries(parsed.versions))
      out.push({
        label: `env seal v${v}`,
        bytes: await combineFragments(frags.map(hex), Number(v)),
      });
  }
  for (const v of SEAL_VERSIONS) {
    const mod = (await import(`../src/save/seal/v${v}/index.ts`)) as { FRAGMENTS: Uint8Array[] };
    out.push({ label: `seal v${v}`, bytes: await combineFragments(mod.FRAGMENTS, v) });
    // A build that injects its own material must not carry the committed fragments either.
    if (env)
      mod.FRAGMENTS.forEach((f, i) =>
        out.push({ label: `committed v${v} fragment ${i}`, bytes: f }),
      );
  }
  return out;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = process.env.DIST_DIR ?? join(root, 'dist', 'client');
  const materials = await builtMaterials();
  const leaks = findSealLeaks(dist, materials);
  if (leaks.length > 0) {
    console.error(`check-seal-absent: FAIL, seal material in the bundle\n  ${leaks.join('\n  ')}`);
    process.exit(1);
  }
  console.log(
    `check-seal-absent: OK, searched ${walk(dist).length} files for ${materials.length} seal material(s) in ${renderings(new Uint8Array(32)).length} forms`,
  );
}
