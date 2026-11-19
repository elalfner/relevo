#!/usr/bin/env node
// Lists the shared code that a build touched, for the hand-off. Usage:
//   node scripts/shared-code.mjs --base <branch> [--repo-root .] [--shared "src/ui/**,lib/kit/**"]
// It reads the files that the branch added or modified against `origin/<base>` (or `<base>`) and prints
//   { base, shared: [{ path, status, why, importers }], line, notes }
// A file is shared when it lives in a shared folder or is imported by more than one other file that is not a test; no model
// decides it. The script never blocks and fails open: when it cannot read the diff it says so in `notes` and exits 0.
//   exit 0: printed   exit 2: bad arguments
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readFileSync } from './lib/guarded-fs.mjs';
import { sharedFiles, sharedLine } from './lib/shared-code.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const base = arg('base');
if (!base) {
  console.error('usage: shared-code.mjs --base <branch> [--repo-root <folder>] [--shared <globs, comma separated>]');
  process.exit(2);
}
const root = resolve(arg('repo-root') ?? '.');
const extra = (arg('shared') ?? '').split(',').map((g) => g.trim()).filter(Boolean);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 << 20 });
const out = (result) => {
  console.log(JSON.stringify({ base, shared: [], line: '', notes: [], ...result }));
  process.exit(0);
};

let ref = null;
for (const candidate of [`origin/${base}`, base]) {
  try {
    git('rev-parse', '--verify', '--quiet', `${candidate}^{commit}`);
    ref = candidate;
    break;
  } catch { /* try the next */ }
}
if (!ref) out({ notes: [`the base branch ${base} could not be resolved, so the shared code was not listed`] });

let changed;
let files;
try {
  changed = git('diff', '--name-status', '-M', `${ref}...HEAD`).split('\n').filter(Boolean).map((line) => {
    const [code, ...paths] = line.split('\t');
    return { code, path: paths[paths.length - 1] };
  }).filter((c) => c.code[0] !== 'D').map((c) => ({ path: c.path, status: c.code[0] === 'A' || c.code[0] === 'R' ? 'added' : 'modified' }));
  files = git('ls-files').split('\n').filter(Boolean);
} catch (err) {
  out({ notes: [`the diff against ${ref} could not be read, so the shared code was not listed`] });
}
const result = sharedFiles({
  changed,
  files,
  extra,
  read: (path) => {
    try {
      return readFileSync(join(root, path), 'utf8');
    } catch {
      return null;
    }
  },
});
out({ ...result, line: sharedLine(result.shared) });
