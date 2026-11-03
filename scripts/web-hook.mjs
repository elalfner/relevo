#!/usr/bin/env node
// Adds a SessionStart hook for web sessions to .claude/settings.json: the one that installs OpenSpec (the default) or,
// with --hook plugin, the one that installs the Relevo plugin. Usage:
//   node scripts/web-hook.mjs [--hook openspec|plugin] [--settings .claude/settings.json]
// Run by /relevo:init only after the person agreed to the hook. Every other key and hook of the file is kept, and a
// file that is not a JSON object is left as it is.
// exit 0: written, or already there   exit 2: the file could not be merged

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mergeWebHook } from './lib/init.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const i = process.argv.indexOf('--settings');
const path = i === -1 ? '.claude/settings.json' : process.argv[i + 1];
const h = process.argv.indexOf('--hook');
const kind = h === -1 ? 'openspec' : process.argv[h + 1];
const what = kind === 'plugin' ? 'the Relevo plugin' : 'OpenSpec';

try {
  const before = existsSync(path) ? readFileSync(path, 'utf8') : null;
  const after = mergeWebHook(before, kind);
  if (after === before) {
    console.log(`${path} already installs ${what} at the start of a web session; nothing changed`);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, after);
    console.log(`${path} now installs ${what} at the start of a web session; the file is left for you to commit`);
  }
} catch (err) {
  console.error(`could not add the hook to ${path}: ${err.message}`);
  process.exit(2);
}
