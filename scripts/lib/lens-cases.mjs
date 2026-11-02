// Reads the seeded-defect cases of tests/fixtures/lens-defects.
// A case is a folder <lens>/<stack>/<case>/ with case.json and either
// bad/ and good/ folders, or a `from` pointing at an interface-defects folder
// that holds one bad.* and one good.* file.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

export const CASES_DIR = 'tests/fixtures/lens-defects';

function filesOf(dir, base = dir) {
  const out = {};
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) Object.assign(out, filesOf(full, base));
    else out[relative(base, full)] = readFileSync(full, 'utf8');
  }
  return out;
}

export function loadCases(root = process.cwd(), dir = CASES_DIR) {
  const base = join(root, dir);
  const cases = [];
  if (!existsSync(base)) return cases;
  for (const lens of readdirSync(base).sort()) {
    for (const stack of readdirSync(join(base, lens)).sort()) {
      for (const name of readdirSync(join(base, lens, stack)).sort()) {
        const folder = join(base, lens, stack, name);
        const meta = JSON.parse(readFileSync(join(folder, 'case.json'), 'utf8'));
        let bad;
        let good;
        if (meta.from) {
          const src = join(root, meta.from);
          const all = filesOf(src);
          const pick = (prefix) => Object.entries(all).filter(([k]) => k.startsWith(prefix));
          bad = Object.fromEntries(pick('bad.'));
          good = Object.fromEntries(pick('good.'));
        } else {
          bad = filesOf(join(folder, 'bad'));
          good = filesOf(join(folder, 'good'));
        }
        cases.push({ id: `${lens}/${stack}/${name}`, folder, meta, bad, good });
      }
    }
  }
  return cases;
}
