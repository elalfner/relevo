#!/usr/bin/env node
// Records which files already differ from the commit before the agent starts (the install step may have rewritten a
// lockfile), so that the rescue and the checkpoints do not take them for the work of the agent. Usage:
//   node scripts/tree-baseline.mjs record
// Saved under $RELEVO_PROGRESS_DIR, outside the working tree. Without that variable (a local run) it does nothing.
// It never fails: exit 0 always, because a missing baseline only leaves everything in, which is the safe side.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { restrictedListFromText } from './lib/restricted-paths.mjs';
import { saveBaseline, takeBaseline } from './lib/tree-baseline.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const [command] = process.argv.slice(2);
try {
  const dir = process.env.RELEVO_PROGRESS_DIR;
  if (command === 'record' && dir) {
    const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    const path = resolve('relevo.yml');
    const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const baseline = takeBaseline(git, restrictedListFromText(text));
    saveBaseline(dir, baseline);
    console.log(JSON.stringify({ recorded: Object.keys(baseline).length }));
  } else if (command !== 'record') {
    process.stderr.write('tree-baseline: use `record`\n');
  }
} catch (error) {
  process.stderr.write(`tree-baseline: ${String(error.message).slice(0, 200)}\n`);
}
process.exit(0);
