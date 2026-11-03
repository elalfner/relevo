#!/usr/bin/env node
// The `gh` subcommands that the commands of the person who writes issues use, for a session of Claude Code on the web,
// where GraphQL is blocked: in a remote session they are answered over the REST API; anywhere else the arguments go to
// `gh` unchanged. Usage, the same arguments as `gh`:
//   node scripts/gh-web.mjs issue view 42 --json title,body
//   node scripts/gh-web.mjs issue list --state open --search "words" --json number,title --limit 10
//   node scripts/gh-web.mjs issue create --title T --body-file f.md --milestone M --assignee login
//   node scripts/gh-web.mjs issue edit 42 --add-label x --remove-label y
//   node scripts/gh-web.mjs repo view --json nameWithOwner -q .nameWithOwner
//   node scripts/gh-web.mjs label create name --color ededed --description d --force
// exit 0: done   exit 1: refused or failed (the message says what and why)
// Any other subcommand or flag in a remote session stops with a message that names it and makes no request.

import { execFileSync, spawnSync } from 'node:child_process';
import { main } from './lib/gh-web.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const io = {
  env: process.env,
  api: (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }),
  git: (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
  passthrough: (args) => spawnSync('gh', args, { stdio: 'inherit' }).status ?? 1,
  readFile: (path) => readFileSync(path, 'utf8'),
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
};

process.exit(main(process.argv.slice(2), io));
