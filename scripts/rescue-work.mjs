#!/usr/bin/env node
// Keeps the work of a cloud run that was cut. Usage:
//   node scripts/rescue-work.mjs --decision <base64> [--config relevo.yml] [--github-output <file>]
// It commits what the run left in the working tree as `wip: stopped by limit (#N)`, through the same scans as any commit
// of Relevo, and pushes it to the branch of the issue. It never pushes after a refusal, never force-pushes and never
// touches a branch that already exists on the remote. The decision is the one the workflow gave the agent.
// Prints one line of JSON { state, branch, files, commit, detail }; with --github-output it also appends `state=`,
// `branch=` and `detail=` to that file, for the step that reports the run.
// It never fails: exit 0 always, so the step that calls it cannot fail a run that was already cut.

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { platformFolders } from './lib/protected-paths.mjs';
import { restrictedListFromText } from './lib/restricted-paths.mjs';
import { readDecision, rescueWork } from './lib/rescue-work.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

function emit(result) {
  console.log(JSON.stringify(result));
  const out = arg('github-output');
  if (out) {
    // A value goes on one line: the detail may hold several lines of a refusal.
    const flat = (v) => String(v ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 600);
    try {
      appendFileSync(out, `state=${result.state}\nbranch=${flat(result.branch)}\ndetail=${flat(result.detail)}\n`);
    } catch { /* the step that reads it simply finds nothing */ }
  }
}

try {
  const decision = readDecision(arg('decision'));
  if (!decision) {
    emit({ state: 'nothing', branch: null, files: 0, commit: null, detail: 'the decision of the run could not be read' });
  } else {
    // The run is committed under the identity of the workflow when the repository has none of its own.
    let identity = [];
    try {
      if (!execFileSync('git', ['config', 'user.email'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()) throw new Error('empty');
    } catch {
      identity = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'];
    }
    const git = (args) => execFileSync('git', [...identity, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    const configPath = resolve(arg('config') ?? 'relevo.yml');
    let rulesFile = null;
    let platformPaths = [];
    let text = '';
    if (existsSync(configPath)) {
      text = readFileSync(configPath, 'utf8');
      const loaded = loadConfig(text);
      if (loaded.ok) {
        rulesFile = loaded.config.qa.rules_from;
        platformPaths = platformFolders(loaded.config.platforms);
      }
    }
    // The list is read from the text, so a relevo.yml that does not validate still restricts what it lists.
    emit(rescueWork({ git, decision, rulesFile, platformPaths, restricted: restrictedListFromText(text) }));
  }
} catch (error) {
  process.stderr.write(`rescue-work: ${error.message}\n`);
  emit({ state: 'not_pushed', branch: null, files: 0, commit: null, detail: `the rescue failed: ${String(error.message).slice(0, 200)}` });
}
process.exit(0);
