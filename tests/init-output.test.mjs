// A plan larger than the buffer of a pipe (64 KB) has to arrive whole: a script that calls `process.exit` right
// after writing drops what has not been flushed, and still exits 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LABELS } from '../scripts/lib/labels.mjs';

const INIT = fileURLToPath(new URL('../scripts/init.mjs', import.meta.url));

// A `gh` that knows only the labels of the repository, each with a long description, so that the plan is large.
function plan(...flags) {
  const dir = mkdtempSync(join(tmpdir(), 'init-output-'));
  const labels = LABELS.map((l) => ({ name: l.name, description: `${'x'.repeat(10000)} end of ${l.name}` }));
  writeFileSync(join(dir, 'gh'), `#!/usr/bin/env node
if (process.argv[2] !== 'api') { // its version, which must say something, and its sign-in
  process.stdout.write('gh version 2.0.0');
  process.exit(0);
}
if (process.argv.at(-1) !== 'repos/o/r/labels?per_page=100') process.exit(1);
process.stdout.write(${JSON.stringify(JSON.stringify([labels]))});
`);
  chmodSync(join(dir, 'gh'), 0o755);
  const env = { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}`, CLAUDE_CODE_REMOTE: '' };
  return spawnSync(process.execPath, [INIT, 'plan', '--repo', 'o/r', ...flags], { cwd: dir, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

test('a JSON plan larger than 64 KB arrives whole through a pipe', () => {
  const r = plan('--json');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.length > 65536, `${r.stdout.length} characters`);
  assert.equal(JSON.parse(r.stdout).find((i) => i.id === 'labels.describe').changes.length, 11);
});

test('a text plan larger than 64 KB arrives whole through a pipe', () => {
  const r = plan();
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.length > 65536, `${r.stdout.length} characters`);
  assert.match(r.stdout, /change\(s\) to make\.\n$/);
});
