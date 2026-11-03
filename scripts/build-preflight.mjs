#!/usr/bin/env node
// The checks that need no model, before a build spends one. Usage:
//   node scripts/build-preflight.mjs --stage issue --issue-file issue.md [--manifest .relevo-design/manifest.json]
//        [--base dev] [--variables variables.json] [--config relevo.yml] [--repo-root .]
//   node scripts/build-preflight.mjs --stage spec --issue-file issue.md --change-dir openspec/changes/<id> [--config relevo.yml]
// `--stage issue` reads what the issue says: the references the fetcher refused and the inputs the issue declares
// (a `file` must exist on the base branch, a `link` must have been fetched, a `variable` must be set, a `secret` counts
// only when the workflow exposed it, a `manual` input never blocks). `--stage spec` reads the task lines of tasks.md:
// a task that changes a protected path, a restricted file, or adds a dependency that the issue does not allow.
// It prints JSON: { stage, decision, reason, findings, unverified, missing }. A value of a secret is never read, printed or stored.
// This is an optimisation and not a control: the guards that already enforce each rule stay in force.
//   exit 0: decision ok   exit 1: decision needs-spec (the reason is in the output)   exit 2: bad arguments
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { allowPathsOf, checkIssueStage, checkSpecStage, missingText } from './lib/build-preflight.mjs';
import { platformFolders } from './lib/protected-paths.mjs';
import { restrictedList, restrictedListFromText } from './lib/restricted-paths.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const stage = arg('stage');
if (!['issue', 'spec'].includes(stage) || !arg('issue-file') || (stage === 'spec' && !arg('change-dir'))) {
  fail('usage: build-preflight.mjs --stage issue --issue-file <file> [--manifest <file>] [--base <branch>] [--variables <file>]\n       build-preflight.mjs --stage spec --issue-file <file> --change-dir <dir>');
}
const read = (file, what) => {
  try {
    return readFileSync(file, 'utf8');
  } catch (err) {
    return fail(`cannot read ${what}: ${err.message}`);
  }
};

const body = read(arg('issue-file'), 'the issue');
const root = resolve(arg('repo-root') ?? '.');
const configPath = resolve(arg('config') ?? 'relevo.yml');
const configText = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
// The restricted list is read from the text, so a relevo.yml that does not validate still restricts what it lists.
const restricted = configText ? restrictedListFromText(configText) : restrictedList();
const loaded = configText ? loadConfig(configText) : { ok: false };

let result;
if (stage === 'issue') {
  const base = arg('base');
  const exists = (path) => {
    if (base) {
      try {
        execFileSync('git', ['cat-file', '-e', `origin/${base}:${path}`], { cwd: root, stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }
    return existsSync(join(root, path));
  };
  const manifest = arg('manifest') && existsSync(arg('manifest')) ? JSON.parse(read(arg('manifest'), 'the manifest')) : null;
  let variables = null;
  if (arg('variables')) {
    try {
      // Only the names are kept: the values of variables are never needed.
      variables = Object.keys(JSON.parse(read(arg('variables'), 'the variables')) ?? {});
    } catch {
      variables = null;
    }
  }
  result = checkIssueStage({ body, manifest, exists, env: process.env, variables });
} else {
  const tasks = join(resolve(arg('change-dir')), 'tasks.md');
  result = checkSpecStage({
    tasksText: read(tasks, 'tasks.md'),
    allow: allowPathsOf(body),
    rulesFile: loaded.ok ? loaded.config.qa.rules_from : null,
    platformPaths: loaded.ok ? platformFolders(loaded.config.platforms) : [],
    restricted,
  });
}
console.log(JSON.stringify({ stage, ...result, unverified: result.unverified ?? [], missing: missingText(result), note: 'an optimisation and not a security control: the guards that enforce each rule stay in force' }));
process.exit(result.decision === 'ok' ? 0 : 1);
