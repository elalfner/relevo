import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBranchKind, retryRefusal } from '../scripts/lib/retry-refusal.mjs';

const BRANCH = 'feature/67-summary';
const DIR = 'openspec/changes/67-summary';

test('Scenario: The branch holds only the specification - the refusal names the deletion and the retry, not fix', () => {
  const text = retryRefusal({ issue: 67, branch: BRANCH, kind: 'spec-only' });
  assert.match(text, /git push origin --delete feature\/67-summary/);
  assert.match(text, /\/relevo:go 67 --retry/);
  assert.doesNotMatch(text, /\/relevo:fix/);
});

test('Scenario: The branch holds code or cannot be read - the refusal sends the person to fix', () => {
  for (const kind of ['implementation', null]) {
    const text = retryRefusal({ issue: 67, branch: BRANCH, kind });
    assert.match(text, /\/relevo:fix 67/);
    assert.doesNotMatch(text, /git push origin --delete/);
  }
});

test('Scenario: The branch holds checkpoints - the refusal says it holds code and that fix needs no description of the defect', () => {
  const text = retryRefusal({ issue: 20, branch: 'feature/20-x', kind: 'implementation' });
  assert.match(text, /it holds code/);
  assert.match(text, /\/relevo:fix 20/);
  assert.match(text, /needs no description of the defect/);
  assert.doesNotMatch(text, /git push origin --delete/);
  assert.doesNotMatch(text, /holds only the specification/);
});

test('the refusals for a branch that cannot be read and for one with only the specification are unchanged', () => {
  assert.equal(retryRefusal({ issue: 20, branch: 'feature/20-x', kind: null }), '#20 already has a branch on the remote (feature/20-x): run /relevo:fix 20 to correct it, or delete the branch to build again');
  assert.match(retryRefusal({ issue: 20, branch: 'feature/20-x', kind: 'spec-only' }), /holds only the specification, so there is no code to fix/);
});

function remoteWith(files) {
  const origin = mkdtempSync(join(tmpdir(), 'relevo-rr-'));
  const git = (...a) => execFileSync('git', a, { cwd: origin, encoding: 'utf8' });
  git('init', '-q', '-b', 'dev');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  writeFileSync(join(origin, 'README.md'), 'x\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  git('switch', '-q', '-c', BRANCH);
  files.forEach((f) => {
    mkdirSync(join(origin, f, '..'), { recursive: true });
    writeFileSync(join(origin, f), 'y\n');
  });
  git('add', '.');
  git('commit', '-q', '-m', 'work');
  git('switch', '-q', 'dev');
  const clone = mkdtempSync(join(tmpdir(), 'relevo-rr-clone-'));
  execFileSync('git', ['clone', '-q', origin, clone]);
  return clone;
}

const kindIn = (cwd) => {
  const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return readBranchKind({ base: 'dev', branch: BRANCH, git });
};

test('the branch of a remote is read as specification-only or as implementation, and nothing is deleted', () => {
  const spec = remoteWith([`${DIR}/tasks.md`, `${DIR}/specs/a/spec.md`, `${DIR}/.openspec.yaml`]);
  assert.equal(kindIn(spec), 'spec-only');
  const code = remoteWith([`${DIR}/tasks.md`, 'lib/main.dart']);
  assert.equal(kindIn(code), 'implementation');
  assert.match(execFileSync('git', ['ls-remote', '--heads', 'origin'], { cwd: spec, encoding: 'utf8' }), /feature\/67-summary/);
});

test('a branch that cannot be read is null', () => {
  const clone = remoteWith([`${DIR}/tasks.md`]);
  assert.equal(readBranchKind({ base: 'dev', branch: 'feature/missing', git: (...a) => execFileSync('git', a, { cwd: clone, stdio: 'pipe', encoding: 'utf8' }) }), null);
});
