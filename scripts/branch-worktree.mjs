#!/usr/bin/env node
// Is the branch of an issue held by another worktree? Run it before `git switch <branch>`. Usage:
//   node scripts/branch-worktree.mjs --branch <name>
//   exit 0: free, or held only by the working tree this runs in   1: held by another worktree (its path is printed)   2: bad usage
// The skills read exit 1 as "stop, changing nothing" and show what it prints.

import { execFileSync } from 'node:child_process';
import { branchHolder, EXIT } from './lib/branch-worktree.mjs';

const args = process.argv.slice(2);
const at = args.indexOf('--branch');
const runner = {
  capture: (cmd, cmdArgs, options) => execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: options.cwd }),
};

const result = branchHolder({ branch: at === -1 ? null : args[at + 1], runner });
if (result.holder) console.log(result.holder);
result.messages.forEach((m) => console.error(m));
process.exit(result.status);
