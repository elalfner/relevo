#!/usr/bin/env node
// Adds the read denials of the restricted files to the settings of an agent. Usage:
//   node scripts/restricted-settings.mjs [--agent claude|antigravity] [--settings <file>]
// Run by /relevo:init only after the person agreed to the item. Every key and every entry the file already has is kept
// and the new entries go at the end of their lists; a file that is not a JSON object is left as it is.
//   claude       .claude/settings.json of this repository: Read rules in permissions.deny and sandbox.filesystem.denyRead
//   antigravity  ~/.gemini/antigravity-cli/settings.json: one read_file rule for each restricted file that exists here
// The restricted files are found by listing folders and compared by name: none is opened.
// exit 0: written, or already there   exit 2: bad arguments or the file could not be merged

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { AGY_USER_FILE, CLAUDE_SETTINGS, mergeAgyDenials, mergeClaudeDenials } from './lib/restricted-settings.mjs';
import { agyReadDenials, findRestrictedFiles, restrictedListFromText } from './lib/restricted-paths.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const agent = opt('agent') ?? 'claude';
if (!['claude', 'antigravity'].includes(agent)) fail('usage: restricted-settings.mjs [--agent claude|antigravity] [--settings <file>]');

// Read from the text: a relevo.yml that does not validate still restricts what it lists.
const list = restrictedListFromText(existsSync('relevo.yml') ? readFileSync('relevo.yml', 'utf8') : '');

const path = opt('settings') ?? (agent === 'claude' ? CLAUDE_SETTINGS : resolve(homedir(), AGY_USER_FILE));
try {
  const before = existsSync(path) ? readFileSync(path, 'utf8') : null;
  const after = agent === 'claude'
    ? mergeClaudeDenials(before, list)
    : mergeAgyDenials(before, agyReadDenials(findRestrictedFiles(process.cwd(), list), list, process.cwd()));
  if (after === before) {
    console.log(`${path} already denies the read of the restricted files; nothing changed`);
  } else {
    mkdirSync(dirname(resolve(path)), { recursive: true });
    writeFileSync(path, after);
    console.log(`${path} now denies the read of the restricted files${agent === 'claude' ? '; the file is left for you to commit' : ''}`);
  }
} catch (err) {
  fail(`could not add the denials to ${path}: ${err.message}`);
}
