import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { realState, writeBuildEnd, writeBuildStart, writeTotals } from '../scripts/lib/build-state.mjs';
import { localStatus } from '../scripts/lib/local-status.mjs';
import { recordCheckpointed, recordGroups } from '../scripts/lib/group-progress.mjs';
import { writeClass } from '../scripts/lib/phase-log.mjs';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const { config } = loadConfig(readFileSync(`${root}templates/relevo.yml`, 'utf8'));
const T0 = Date.parse('2026-11-17T10:00:00Z');

function machine() {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-ls-')));
  const repo = join(parent, 'shop');
  mkdirSync(repo);
  const dir = join(parent, '.relevo-worktrees', '.state', 'shop-42');
  mkdirSync(dir, { recursive: true });
  const capture = (cmd, args) => {
    if (cmd === 'git') return `${repo}\n`;
    throw new Error('unexpected');
  };
  const status = (issue = 42, now = T0 + 8 * 60000) => localStatus({ issue, config, capture, state: realState, exists: (p) => spawnSync('test', ['-e', p]).status === 0, now: () => now });
  return { repo, dir, parent, status };
}

test('Scenario: Build in progress - the phase, "group 2 of 3", the tasks, the minutes and the time of the last change', () => {
  const m = machine();
  const wt = join(m.parent, '.relevo-worktrees', 'shop-42');
  mkdirSync(join(wt, 'openspec', 'changes', '42-x'), { recursive: true });
  writeFileSync(join(wt, 'openspec', 'changes', '42-x', 'tasks.md'), '- [x] 1.1 a\n- [ ] 1.2 b\n');
  writeBuildStart(m.dir, { issue: 42, changeId: '42-x', now: T0 });
  writeFileSync(join(m.dir, 'phase.json'), JSON.stringify({ phase: 'development' }));
  recordGroups(m.dir, 3);
  recordCheckpointed(m.dir, 1, 3);
  const r = m.status();
  assert.equal(r.status, 0);
  const text = r.lines.join('\n');
  assert.match(text, /\[8 min\] development · group 2 of 3 · tasks 1 of 2/);
  assert.match(text, /Last change: \d+ min ago/);
  assert.doesNotMatch(text, /Ended/);
});

test('Scenario: Build ended - how it ended, with the totals of the run', () => {
  const m = machine();
  writeBuildStart(m.dir, { issue: 42, changeId: '42-x', now: T0 });
  writeClass(m.dir, 'built');
  writeTotals(m.dir, { turns: 18, cost: 1.5, tokens: 1500 });
  writeBuildEnd(m.dir, { status: 0, now: T0 + 60000 });
  const text = m.status().lines.join('\n');
  assert.match(text, /Ended: built\./);
  assert.match(text, /18 turns/);
});

test('a build that ended without a class says its exit status', () => {
  const m = machine();
  writeBuildStart(m.dir, { issue: 42, changeId: null, now: T0 });
  writeBuildEnd(m.dir, { status: 3, now: T0 + 60000 });
  assert.match(m.status().lines.join('\n'), /Ended with status 3\./);
});

test('Scenario: No build here - it says that there is no local build of the issue', () => {
  const m = machine();
  const r = m.status(43);
  assert.equal(r.status, 0);
  assert.deepEqual(r.lines, ['There is no local build of #43 on this machine.']);
});

test('it reads only: the folder is the same after the command', () => {
  const m = machine();
  writeBuildStart(m.dir, { issue: 42, changeId: '42-x', now: T0 });
  const before = spawnSync('ls', ['-la', '--time-style=full-iso', m.dir], { encoding: 'utf8' }).stdout;
  m.status();
  assert.equal(spawnSync('ls', ['-la', '--time-style=full-iso', m.dir], { encoding: 'utf8' }).stdout, before);
});

test('a bad issue number and a folder that is not a repository are usage errors', () => {
  assert.equal(localStatus({ issue: 'x', config, capture: () => '', state: realState }).status, 2);
  assert.equal(localStatus({ issue: '1', config, capture: () => { throw new Error('no'); }, state: realState }).status, 2);
});

test('the command-line wrapper prints the status and does not need the build to be running', () => {
  const cli = `${root}scripts/go-local.mjs`;
  const r = spawnSync('node', [cli, 'status', '987654', '--config', `${root}templates/relevo.yml`], { encoding: 'utf8', cwd: root });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /There is no local build of #987654 on this machine\./);
});
