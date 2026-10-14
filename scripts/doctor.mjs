#!/usr/bin/env node
// Checks that the machine, the repository and GitHub are ready for Relevo. Read-only: it changes nothing.
//   node scripts/doctor.mjs [--repo owner/name] [--json]
// exit 0: no check failed (warnings allowed)   exit 1: at least one check failed

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { gatherFacts, readOnlyGh, renderReport, runChecks } from './lib/doctor.mjs';

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

let platform = null;
if (existsSync('relevo.yml')) platform = (/^platform:\s*(\S+)/m.exec(readFileSync('relevo.yml', 'utf8')) ?? [])[1] ?? null;

const facts = gatherFacts({
  tool,
  gh: readOnlyGh(gh),
  exists: existsSync,
  read: (p) => readFileSync(p, 'utf8'),
  listDir: (p) => readdirSync(p),
  skillDirs: ['.claude/skills', '.agents/skills', `${homedir()}/.claude/skills`],
  repo,
  platform,
});
const results = runChecks(facts);
console.log(process.argv.includes('--json') ? JSON.stringify(results, null, 2) : renderReport(results));
process.exit(results.some((x) => x.status === 'fail') ? 1 : 0);
