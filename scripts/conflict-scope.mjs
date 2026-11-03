#!/usr/bin/env node
// Says where the conflicted files of a merge are. Usage:
//   node scripts/conflict-scope.mjs               reads `git diff --name-only --diff-filter=U`
//   node scripts/conflict-scope.mjs --paths       reads the paths from stdin, one per line
// exit 0: all inside openspec/ (or none)   exit 1: prints the files outside   exit 2: bad arguments
//
// With --handoff it answers the question of `review`: may these conflicts go to the developer agent? Every conflicted
// file must be inside the folder of the platform (--within), the specification of the change (--change), GLOSSARY.md or
// docs/adr/, and none may be a protected path, a restricted file or a dependency file that the issue does not allow.
//   node scripts/conflict-scope.mjs --handoff --within apps/web --change 42-title [--allow package.json,package-lock.json] [--config relevo.yml] [--paths]
// It prints JSON { ok, paths, outside: [{ path, reason }] }.
//   exit 0: every conflicted file may go to the developer agent (or there is none)   exit 1: some may not

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { conflictScope } from './lib/archive-check.mjs';
import { loadConfig } from './lib/config.mjs';
import { conflictHandoff } from './lib/conflict-handoff.mjs';
import { platformFolders } from './lib/protected-paths.mjs';
import { restrictedListFromText } from './lib/restricted-paths.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const fromStdin = argv.includes('--paths');
const raw = fromStdin ? readFileSync(0, 'utf8') : execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], { encoding: 'utf8' });
const paths = raw.split('\n').filter(Boolean);

if (argv.includes('--handoff')) {
  const configPath = resolve(opt('config') ?? 'relevo.yml');
  const text = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  const loaded = text ? loadConfig(text) : { ok: false };
  const allow = (opt('allow') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  const result = conflictHandoff(paths, {
    within: opt('within') ?? null,
    change: opt('change') ?? null,
    allow,
    rulesFile: loaded.ok ? loaded.config.qa.rules_from : null,
    platformPaths: loaded.ok ? platformFolders(loaded.config.platforms) : [],
    restricted: restrictedListFromText(text),
  });
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

const result = conflictScope(paths);
if (result.ok) {
  console.log(result.paths.length === 0 ? 'no conflicts' : `all ${result.paths.length} conflicted file(s) are under openspec/`);
  process.exit(0);
}
console.log(`conflicts outside openspec/: ${result.outside.join(', ')}`);
process.exit(1);
