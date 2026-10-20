import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveState } from '../scripts/lib/archive-state.mjs';

test('a change among the active ones is active', () => {
  assert.equal(archiveState({ active: ['31-summary'], archived: [], change: '31-summary' }), 'active');
});

test('Scenario: Merge failed after the archive was pushed - the dated folder means archived', () => {
  assert.equal(archiveState({ active: [], archived: ['2026-10-14-31-summary'], change: '31-summary' }), 'archived');
});

test('missing when it is neither active nor archived', () => {
  assert.equal(archiveState({ active: ['40-other'], archived: ['2026-10-14-30-x'], change: '31-summary' }), 'missing');
});

test('a change whose name ends like another one is not mistaken for it', () => {
  assert.equal(archiveState({ active: [], archived: ['2026-10-14-131-summary'], change: '31-summary' }), 'missing');
  assert.equal(archiveState({ active: ['131-summary'], archived: [], change: '31-summary' }), 'missing');
});

test('names with regular-expression characters are matched literally', () => {
  assert.equal(archiveState({ active: [], archived: ['2026-10-14-3x-a.b'], change: '3x-a.b' }), 'archived');
  assert.equal(archiveState({ active: [], archived: ['2026-10-14-3x-aXb'], change: '3x-a.b' }), 'missing');
});

test('the script reads the real archive folder and exits 1 for a missing change', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-as-'));
  mkdirSync(join(dir, 'openspec/changes/archive/2026-10-14-31-summary'), { recursive: true });
  const cli = (change) => spawnSync('node', [new URL('../scripts/archive-state.mjs', import.meta.url).pathname, '--change', change], { cwd: dir, encoding: 'utf8' });
  const archived = cli('31-summary');
  assert.equal(archived.stdout.trim(), 'archived');
  assert.equal(archived.status, 0);
  assert.equal(cli('99-none').status, 1);
});
