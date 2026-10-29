#!/usr/bin/env node
// Commits named files, and nothing else, after checking them. Usage:
//   node scripts/commit-change.mjs --message "feat: title (#42)" [--allow pubspec.yaml,pubspec.lock] [--rules-file CLAUDE.md,docs/rules.md]
//     [--within apps/web --change 42-title] -- path [path ...]
// --within is the folder of the platform of the issue: files outside it are refused, except the specification of --change, GLOSSARY.md and docs/adr/.
// It stages the paths, refuses protected paths and restricted files ("restricted file in the diff"), scans the staged diff for temporary markers and credentials, and
// commits only when nothing was found. With no --rules-file it reads qa.rules_from from relevo.yml, if there is one; it also reads the platform folders there, because the skill folders of a platform are protected too.
//   exit 0: committed (prints the short hash)   exit 1: refused, nothing committed (prints what and where)
//   exit 2: bad arguments, "." or "-A" as a path, or git failed

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadConfig } from './lib/config.mjs';
import { commitChange, refusalText } from './lib/commit-change.mjs';
import { platformFolders } from './lib/protected-paths.mjs';
import { restrictedListFromText } from './lib/restricted-paths.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const options = sep === -1 ? argv : argv.slice(0, sep);
const paths = sep === -1 ? [] : argv.slice(sep + 1);
const opt = (name) => {
  const i = options.indexOf(`--${name}`);
  return i === -1 ? undefined : options[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

if (!opt('message') || paths.length === 0) fail('usage: commit-change.mjs --message "<message>" [--allow a,b] [--rules-file path] -- <path> [path ...]');

let rulesFile = opt('rules-file') ? opt('rules-file').split(',').map((f) => f.trim()).filter(Boolean) : null;
let platformPaths = [];
// The list is read from the text, so a relevo.yml that does not validate still restricts what it lists.
const restricted = restrictedListFromText(existsSync('relevo.yml') ? readFileSync('relevo.yml', 'utf8') : '');
if (existsSync('relevo.yml')) {
  const loaded = loadConfig(readFileSync('relevo.yml', 'utf8'));
  if (loaded.ok) {
    if (!rulesFile) rulesFile = loaded.config.qa.rules_from;
    platformPaths = platformFolders(loaded.config.platforms);
  }
}
const allow = (opt('allow') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

try {
  const result = commitChange({ git, message: opt('message'), paths, allow, rulesFile, platformPaths, within: opt('within') ?? null, change: opt('change') ?? null, restricted });
  if (result.ok) {
    console.log(result.commit);
    process.exit(0);
  }
  console.error('not committed:');
  console.error(refusalText(result));
  process.exit(1);
} catch (err) {
  fail(`${err.message}${err.stderr ? `\n${String(err.stderr).trim()}` : ''}`);
}
