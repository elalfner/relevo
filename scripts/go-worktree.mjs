#!/usr/bin/env node
// The worktree of an interactive `go` in Claude Code. Usage:
//   node scripts/go-worktree.mjs create <issue> [--config relevo.yml]   prints {"worktree","base","state"} as JSON
//   node scripts/go-worktree.mjs remove <issue>
//   exit 0: done   1: git failed   2: bad usage   3: the worktree of the issue already exists   4: already in a linked worktree
// The skill reads exit 3 as "stop" and exit 4 as "build where you are".

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { createWorktree, EXIT, removeWorktree } from './lib/go-worktree.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';
import { resetStateDir } from './lib/worktree-path.mjs';
import { writeBuildStart } from './lib/build-state.mjs';

const args = process.argv.slice(2);
const [command, issue] = args;
const configAt = args.indexOf('--config');
const fail = (message, code = EXIT.usage) => {
  console.error(message);
  process.exit(code);
};

const runner = {
  capture: (cmd, cmdArgs, options) => execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: options.cwd }),
};

let result;
if (command === 'create') {
  const configPath = resolve(configAt === -1 ? 'relevo.yml' : args[configAt + 1]);
  if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`);
  const loaded = loadConfig(readFileSync(configPath, 'utf8'));
  if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));
  result = createWorktree({ issue, config: loaded.config, runner, exists: existsSync, // The state folder of an interactive build starts here, with its issue and its start, as a local build's does.
    prepareState: (dir) => resetStateDir(dir) && writeBuildStart(dir, { issue }) });
  if (result.status === EXIT.ok) console.log(JSON.stringify({ worktree: result.worktree, base: result.base, state: result.state }));
} else if (command === 'remove') {
  result = removeWorktree({ issue, runner, exists: existsSync });
} else {
  fail('usage: go-worktree.mjs create|remove <issue>');
}
result.messages.forEach((m) => console.error(m));
process.exit(result.status);
