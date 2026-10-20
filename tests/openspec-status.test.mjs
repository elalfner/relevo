import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingArtifacts, planningComplete } from '../scripts/lib/openspec-status.mjs';

// Saved from `openspec status --change harden-go-and-agents --json` (OpenSpec 1.14.3), keeping the fields that matter.
const artifact = (id, status, requires = []) => ({ id, status, requires });
const JUST_CREATED = { applyRequires: ['tasks'], isPlanningComplete: false, artifacts: [artifact('proposal', 'ready'), artifact('specs', 'blocked', ['proposal']), artifact('design', 'blocked', ['proposal']), artifact('tasks', 'blocked', ['specs', 'design'])] };
const ALL_DONE = { applyRequires: ['tasks'], isPlanningComplete: true, artifacts: [artifact('proposal', 'done'), artifact('specs', 'done', ['proposal']), artifact('design', 'done', ['proposal']), artifact('tasks', 'done', ['specs', 'design'])] };

test('Scenario: All artifacts done - the specification is complete', () => {
  assert.equal(planningComplete(ALL_DONE), true);
  assert.deepEqual(pendingArtifacts(ALL_DONE), []);
});

test('Scenario: An artifact is missing - the specification is not complete and the missing ones are named', () => {
  assert.equal(planningComplete(JUST_CREATED), false);
  assert.deepEqual(pendingArtifacts(JUST_CREATED), ['proposal', 'specs', 'design', 'tasks']);
  const oneLeft = { artifacts: [artifact('proposal', 'done'), artifact('specs', 'done'), artifact('design', 'ready'), artifact('tasks', 'done')] };
  assert.equal(planningComplete(oneLeft), false);
  assert.deepEqual(pendingArtifacts(oneLeft), ['design']);
});

test('a skipped artifact counts as complete (a change that declares skip_specs)', () => {
  const skipped = { artifacts: [artifact('proposal', 'done'), artifact('specs', 'skipped', ['proposal']), artifact('design', 'done'), artifact('tasks', 'done')] };
  assert.equal(planningComplete(skipped), true);
});

test('writing tasks first does not make the change complete: status is file existence only', () => {
  const early = { artifacts: [artifact('proposal', 'done'), artifact('specs', 'ready'), artifact('design', 'ready'), artifact('tasks', 'done', ['specs', 'design'])] };
  assert.equal(planningComplete(early), false);
});

test('an empty or missing status is never complete', () => {
  assert.equal(planningComplete({ artifacts: [] }), false);
  assert.equal(planningComplete({}), false);
  assert.equal(planningComplete(null), false);
  assert.deepEqual(pendingArtifacts(undefined), []);
});

test('the rule agrees with isPlanningComplete on both saved examples', () => {
  [JUST_CREATED, ALL_DONE].forEach((status) => assert.equal(planningComplete(status), status.isPlanningComplete));
});

// ---------- The command

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../scripts/spec-ready.mjs', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'relevo-spec-ready-'));
const saved = (status) => {
  const path = join(tmp, `status-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(path, JSON.stringify(status));
  return path;
};
const cli = (...args) => spawnSync('node', [CLI, ...args], { encoding: 'utf8' });

test('Scenario: All artifacts done - the command exits 0', () => {
  const r = cli('--input', saved(ALL_DONE));
  assert.deepEqual([r.status, r.stdout.trim()], [0, 'the specification is complete']);
});

test('Scenario: An artifact is missing - the command exits 1 and names the missing artifacts', () => {
  const r = cli('--input', saved(JUST_CREATED));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /artifacts not done: proposal, specs, design, tasks/);
});

test('the command asks OpenSpec for the status of the change, and exits 2 when OpenSpec fails or arguments are missing', () => {
  const bin = join(tmp, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'openspec'), `#!/bin/sh\n[ "$1 $2 $3" = "status --change x" ] && echo '${JSON.stringify(ALL_DONE)}' && exit 0\necho "no such change" >&2; exit 1\n`);
  chmodSync(join(bin, 'openspec'), 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
  assert.equal(spawnSync('node', [CLI, '--change', 'x'], { env, encoding: 'utf8' }).status, 0);
  const missing = spawnSync('node', [CLI, '--change', 'nope'], { env, encoding: 'utf8' });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /openspec status failed: no such change/);
  assert.equal(cli().status, 2);
  assert.match(cli().stderr, /usage: spec-ready\.mjs/);
});
