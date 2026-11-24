import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baseRef, branchRef, localRefs, readLocal } from '../scripts/lib/base-ref.mjs';

test('a github project compares with the remote and a files project with its own branches', () => {
  assert.equal(baseRef({ tracker: 'github' }, 'dev'), 'origin/dev');
  assert.equal(branchRef({ tracker: 'github' }, 'feature/1-x'), 'origin/feature/1-x');
  assert.equal(baseRef({ tracker: 'files' }, 'main'), 'main');
  assert.equal(branchRef({ tracker: 'files' }, 'feature/1-x'), 'feature/1-x');
  assert.equal(localRefs({}), false);
  assert.equal(localRefs(null), false);
});

test('readLocal reads relevo.yml and treats a missing or invalid file as a github project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-baseref-'));
  const file = join(dir, 'relevo.yml');
  assert.equal(readLocal(file), false);
  writeFileSync(file, 'limits:\n  run_max_cost: 5\ntracker: files\ngit_provider: local\n');
  assert.equal(readLocal(file), true);
  writeFileSync(file, 'limits:\n  run_max_cost: 5\n');
  assert.equal(readLocal(file), false);
  writeFileSync(file, 'tracker: files\n');
  assert.equal(readLocal(file), false, 'invalid (no cost limit)');
  rmSync(dir, { recursive: true });
});
