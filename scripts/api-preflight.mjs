#!/usr/bin/env node
// Checks that an api review can run a test. Run it from the folder of the platform. It installs nothing, starts nothing and
// never reads an environment file. Prints { ok, check, detail, install, ... } as JSON; `install` is the command for the person to run.
//
// Laravel (the default):  PHP and Composer, the installed dependencies, and the database the test configuration declares.
//   exit 0: ready   exit 3: PHP or Composer is missing   exit 4: no vendor/   exit 5: vendor/ does not match composer.lock
//   exit 6: ready, but the test database is not in-memory SQLite (or is unknown): the person confirms it first (confirm-env)
//
// Supabase (--stack supabase):  the CLI, Docker, supabase/config.toml and the local stack.
//   exit 0: ready   exit 3: the CLI or Docker is missing   exit 4: the Docker daemon does not answer   exit 5: no supabase/config.toml
//   exit 7: ready, but the local stack is stopped: ask before running supabase start

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { apiPreflight, supabasePreflight } from './lib/api-preflight.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const si = process.argv.indexOf('--stack');
const stack = si === -1 ? 'laravel' : process.argv[si + 1];
if (!['laravel', 'supabase'].includes(stack)) {
  console.error('usage: api-preflight.mjs [--stack laravel|supabase]');
  process.exit(2);
}
const which = (tool) => spawnSync(tool, ['--version'], { stdio: 'ignore' }).status === 0;
const exists = (path) => existsSync(path);
const result = stack === 'supabase'
  ? supabasePreflight({ cwd: process.cwd() }, { which, exists, run: (command, args) => ({ status: spawnSync(command, args, { stdio: 'ignore' }).status ?? 1 }) })
  : apiPreflight({ cwd: process.cwd() }, { which, exists, read: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null) });
const { exit, ...out } = result;
console.log(JSON.stringify(out));
process.exit(exit);
