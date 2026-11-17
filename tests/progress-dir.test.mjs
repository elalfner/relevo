import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { progressDir, stateDir, STATE_FOLDER } from '../scripts/lib/worktree-path.mjs';

const REPO = '/home/me/code/shop';

test('the state folder of an issue lies beside the worktrees, outside every working tree', () => {
  assert.equal(stateDir(REPO, 42), '/home/me/code/.relevo-worktrees/.state/shop-42');
  assert.equal(STATE_FOLDER, '.state');
});

test('Scenario: the variable wins', () => {
  assert.equal(progressDir({ env: { RELEVO_PROGRESS_DIR: '/run/x' }, cwd: '/home/me/code/.relevo-worktrees/shop-42', exists: () => true }), '/run/x');
});

test('inside a worktree with a state folder it returns that folder', () => {
  const seen = [];
  const dir = progressDir({
    env: {}, cwd: '/home/me/code/.relevo-worktrees/shop-42/src/deep',
    exists: (p) => { seen.push(p); return true; },
  });
  assert.equal(dir, '/home/me/code/.relevo-worktrees/.state/shop-42');
  assert.deepEqual(seen, [dir]);
});

test('inside a worktree without a state folder, or anywhere else, it returns none', () => {
  assert.equal(progressDir({ env: {}, cwd: '/home/me/code/.relevo-worktrees/shop-42', exists: () => false }), null);
  assert.equal(progressDir({ env: {}, cwd: '/home/me/code/shop', exists: () => true }), null);
  assert.equal(progressDir({ env: {}, cwd: '/home/me/code/.relevo-worktrees/.state/shop-42', exists: () => true }), null);
  assert.equal(progressDir({ env: {}, cwd: '/home/me/code/.relevo-worktrees', exists: () => true }), null);
  assert.equal(progressDir({ env: {}, cwd: '/home/me/code/.relevo-worktrees/shop', exists: () => true }), null);
  assert.equal(progressDir({ env: { RELEVO_PROGRESS_DIR: '' }, cwd: '/tmp', exists: () => true }), null);
});

test('it never throws', () => {
  assert.equal(progressDir({ env: {}, cwd: '/home/me/code/.relevo-worktrees/shop-42', exists: () => { throw new Error('x'); } }), null);
  assert.equal(progressDir({ env: undefined, cwd: undefined }), null);
});

test('with the real file system', () => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-pd-')));
  const wt = join(parent, '.relevo-worktrees', 'shop-7');
  mkdirSync(wt, { recursive: true });
  assert.equal(progressDir({ env: {}, cwd: wt }), null);
  mkdirSync(join(parent, '.relevo-worktrees', '.state', 'shop-7'), { recursive: true });
  assert.equal(progressDir({ env: {}, cwd: wt }), join(parent, '.relevo-worktrees', '.state', 'shop-7'));
});
