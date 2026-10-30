#!/usr/bin/env node
// Checks that an api review (Laravel) can run a test: PHP and Composer, the installed dependencies, and the database the
// test configuration declares. Run it from the folder of the platform. It installs nothing and never reads an environment file.
// Prints { ok, check, detail, install, database, needs_confirm } as JSON; `install` is the command for the person to run.
//   exit 0: ready   exit 3: PHP or Composer is missing   exit 4: no vendor/   exit 5: vendor/ does not match composer.lock
//   exit 6: ready, but the test database is not in-memory SQLite (or is unknown): the person confirms it first (confirm-env)

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { apiPreflight } from './lib/api-preflight.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const result = apiPreflight({ cwd: process.cwd() }, {
  which: (tool) => spawnSync(tool, ['--version'], { stdio: 'ignore' }).status === 0,
  exists: (path) => existsSync(path),
  read: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null),
});
const { exit, ...out } = result;
console.log(JSON.stringify(out));
process.exit(exit);
