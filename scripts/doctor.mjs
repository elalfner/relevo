#!/usr/bin/env node
// Checks that the machine, the repository and GitHub are ready for Relevo. Read-only: it changes nothing.
//   node scripts/doctor.mjs [--repo owner/name] [--all] [--json]
//   --all lists the checks that passed too; --json always lists every check
// exit 0: no check failed (warnings allowed)   exit 1: at least one check failed

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { adapterFacts } from './lib/adapters/install.mjs';
import { exitCode, gatherFacts, readOnlyGh, renderReport, reportHeader, runChecks } from './lib/doctor.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

let repo = arg('repo') ?? process.env.GITHUB_REPOSITORY ?? null;
const tool = (name, args) => execFileSync(name, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const gh = (args) => tool('gh', args);
if (!repo) {
  try {
    repo = tool('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim() || null;
  } catch {
    repo = null;
  }
}

// Files of a skill folder, for the comparison with skills-lock.json.
const readFolder = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const path = `${dir}/${e.name}`;
  if (e.isDirectory()) return readFolder(path).map((f) => ({ ...f, path: `${e.name}/${f.path}` }));
  return e.isFile() ? [{ path: e.name, content: readFileSync(path) }] : [];
});

const repoTop = (() => {
  try {
    return tool('git', ['rev-parse', '--show-toplevel']).trim() || null;
  } catch {
    return null;
  }
})();

const facts = gatherFacts({
  adapters: () => adapterFacts({ root: repoTop, home: homedir() }),
  tool,
  gh: readOnlyGh(gh),
  exists: existsSync,
  read: (p) => readFileSync(p, 'utf8'),
  listDir: (p) => readdirSync(p),
  skillDirs: ['.claude/skills', '.agents/skills', `${homedir()}/.claude/skills`],
  git: (args) => tool('git', args),
  readFolder,
  repo,
});
const results = runChecks(facts);
console.log(process.argv.includes('--json') ? JSON.stringify(results, null, 2) : renderReport(results, { header: reportHeader(facts), all: process.argv.includes('--all') }));
process.exit(exitCode(results));
