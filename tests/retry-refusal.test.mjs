import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBranchKind, resumeRefusal, retryRefusal } from '../scripts/lib/retry-refusal.mjs';

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

// --- resume-a-cut-build: where a refused retry or a refused resume sends the person ---
const RESUMABLE = { state: 'resume', reason: null };

test('Scenario: The branch holds checkpoints that can be resumed - a refused retry names --resume, and fix only when the check refuses', () => {
  const text = retryRefusal({ issue: 20, branch: 'feature/20-x', kind: 'implementation', resume: RESUMABLE });
  assert.match(text, /it holds code/);
  assert.match(text, /\/relevo:go 20 --resume/);
  assert.doesNotMatch(text, /\/relevo:fix/);
  assert.doesNotMatch(text, /git push origin --delete/);
  const refused = retryRefusal({ issue: 20, branch: 'feature/20-x', kind: 'implementation', resume: { state: 'existing', reason: 'the tip of the branch is not a checkpoint' } });
  assert.match(refused, /\/relevo:fix 20/);
  assert.match(refused, /needs no description of the defect/);
  assert.equal(retryRefusal({ issue: 20, branch: 'feature/20-x', kind: 'implementation' }), retryRefusal({ issue: 20, branch: 'feature/20-x', kind: 'implementation', resume: null }), 'without the answer of the check the text is the old one');
});

test('a refused retry on a branch that holds only the specification, or cannot be read, does not change with the check', () => {
  for (const kind of ['spec-only', null]) {
    assert.equal(retryRefusal({ issue: 20, branch: 'feature/20-x', kind, resume: RESUMABLE }), retryRefusal({ issue: 20, branch: 'feature/20-x', kind }));
  }
});

test('Scenario: A resume is refused with the reason and the step that fits it', () => {
  const refuse = (check, kind = 'implementation') => resumeRefusal({ issue: 42, branch: 'feature/42-x', check, kind });
  const changed = refuse({ state: 'existing', reason: 'the text of the issue changed since the last checkpoint' });
  assert.match(changed, /text of the issue changed/);
  assert.match(changed, /\/relevo:issue 42/);
  assert.match(changed, /git push origin --delete feature\/42-x/);
  assert.match(changed, /--retry/);
  const rejected = refuse({ state: 'existing', reason: 'the tip of the branch is not a checkpoint' });
  assert.match(rejected, /QA rejected|rejected by QA/);
  assert.match(rejected, /\/relevo:fix 42/);
  assert.doesNotMatch(rejected, /git push origin --delete/);
  const foreign = refuse({ state: 'existing', reason: 'a commit that is not one of Relevo\'s for this issue: "fix typo by hand"' });
  assert.match(foreign, /fix typo by hand/);
  assert.match(foreign, /git push origin --delete feature\/42-x/);
  assert.match(foreign, /\/relevo:go 42 --retry/);
  assert.doesNotMatch(foreign, /\/relevo:fix/);
  const specOnly = refuse({ state: 'existing', reason: 'the tip of the branch is not a checkpoint' }, 'spec-only');
  assert.match(specOnly, /holds only the specification/);
  assert.match(specOnly, /git push origin --delete feature\/42-x/);
  assert.match(specOnly, /\/relevo:go 42 --retry/);
});

test('a resume of a branch that cannot be read says so and deletes nothing; with no branch it says that there is nothing to continue', () => {
  const unreadable = resumeRefusal({ issue: 42, branch: 'feature/42-x', check: { state: 'existing', reason: 'git could not read the branch: boom' }, kind: null });
  assert.match(unreadable, /could not be read/);
  assert.doesNotMatch(unreadable, /git push origin --delete/);
  const absent = resumeRefusal({ issue: 42, branch: null, check: { state: 'absent', reason: null }, kind: null });
  assert.match(absent, /nothing to continue/);
  assert.match(absent, /\/relevo:go 42 --retry/);
});
