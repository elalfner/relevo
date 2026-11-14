import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkKey, readStore, recordResult, reusable } from '../scripts/lib/check-store.mjs';

const dir = () => mkdtempSync(join(tmpdir(), 'relevo-store-'));
const rec = (root, key, exit_code) => recordResult(root, { key, name: 'test', command: 'c', exit_code, duration_ms: 5, output: 'out' });

test('The key changes with the diff, the command and the folder', () => {
  const base = { hash: 'h', command: 'npm test', path: 'app' };
  assert.equal(checkKey(base), checkKey({ ...base }));
  for (const change of [{ hash: 'h2' }, { command: 'npm run t' }, { path: 'web' }]) assert.notEqual(checkKey(base), checkKey({ ...base, ...change }));
});

test('A pass is reusable; nothing recorded is not', () => {
  const root = dir();
  assert.equal(reusable(readStore(root), 'k'), false);
  rec(root, 'k', 0);
  assert.equal(reusable(readStore(root), 'k'), true);
  assert.equal(readStore(root).k.last.output_tail, 'out');
});

test('A failure makes the key never reusable, even after a later pass', () => {
  const root = dir();
  rec(root, 'k', 1);
  assert.equal(reusable(readStore(root), 'k'), false);
  rec(root, 'k', 0);
  assert.deepEqual([readStore(root).k.passes, readStore(root).k.failures], [1, 1]);
  assert.equal(reusable(readStore(root), 'k'), false);
});

test('A damaged store reuses nothing', () => {
  assert.equal(reusable({ k: { passes: 1 } }, 'k'), false);
  assert.equal(reusable({ k: { passes: 1, failures: 0, last: { exit_code: 1 } } }, 'k'), false);
  assert.deepEqual(readStore(dir()), {});
});
