#!/usr/bin/env node
// Adds the SessionStart hook that installs OpenSpec in web sessions to .claude/settings.json. Usage:
//   node scripts/web-hook.mjs [--settings .claude/settings.json]
// Run by /relevo:init only after the person agreed to the hook. Every other key and hook of the file is kept, and a
// file that is not a JSON object is left as it is.
// exit 0: written, or already there   exit 2: the file could not be merged

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mergeWebHook } from './lib/init.mjs';

const i = process.argv.indexOf('--settings');
const path = i === -1 ? '.claude/settings.json' : process.argv[i + 1];

try {
  const before = existsSync(path) ? readFileSync(path, 'utf8') : null;
  const after = mergeWebHook(before);
  if (after === before) {
    console.log(`${path} already installs OpenSpec at the start of a web session; nothing changed`);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, after);
    console.log(`${path} now installs OpenSpec at the start of a web session; the file is left for you to commit`);
  }
} catch (err) {
  console.error(`could not add the hook to ${path}: ${err.message}`);
  process.exit(2);
}
