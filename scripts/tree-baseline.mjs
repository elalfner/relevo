#!/usr/bin/env node
// Records which files already differ from the commit before the agent starts (the install step may have rewritten a
// lockfile), so that the rescue and the checkpoints do not take them for the work of the agent. Usage:
//   node scripts/tree-baseline.mjs record
//   node scripts/tree-baseline.mjs list
//       prints, one per line, the files that are still as the install step left them (recorded and unchanged since):
//       they are not part of the change, and the QA lenses leave them out of the diff they review
// Saved under $RELEVO_PROGRESS_DIR, outside the working tree. Without that variable (a local run) it does nothing.
// It never fails: exit 0 always, because a missing baseline only leaves everything in, which is the safe side.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { restrictedListFromText } from './lib/restricted-paths.mjs';
import { changedSince, loadBaseline, saveBaseline, takeBaseline } from './lib/tree-baseline.mjs';
import { changedPaths } from './lib/rescue-work.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const [command] = process.argv.slice(2);
try {
  const dir = process.env.RELEVO_PROGRESS_DIR;
  if (command === 'record') {
    if (dir) {
      const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
      const path = resolve('relevo.yml');
      const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
      const baseline = takeBaseline(git, restrictedListFromText(text));
      saveBaseline(dir, baseline);
      console.log(JSON.stringify({ recorded: Object.keys(baseline).length }));
    }
  } else if (command === 'list') {
    // Recorded and still unchanged: the changed files that `changedSince` leaves out. Without a record, nothing.
    const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    const path = resolve('relevo.yml');
    const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const restricted = restrictedListFromText(text);
    const baseline = loadBaseline(dir);
    const paths = changedPaths(git(['status', '--porcelain=v1', '-z', '--untracked-files=all']));
    const mine = new Set(changedSince(paths, baseline, git, restricted));
    for (const p of paths) if (!mine.has(p) && baseline[p]) console.log(p);
  } else {
    process.stderr.write('tree-baseline: use `record` or `list`\n');
  }
} catch (error) {
  process.stderr.write(`tree-baseline: ${String(error.message).slice(0, 200)}\n`);
}
process.exit(0);
