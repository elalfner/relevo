import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canEditIssue, EDITABLE_LABELS } from '../scripts/lib/can-edit-issue.mjs';
import { LABELS } from '../scripts/lib/labels.mjs';

const issue = (labels, state = 'OPEN') => ({ number: 42, title: 't', body: 'b', state, labels: labels.map((name) => ({ name })) });
const name = (key) => LABELS.find((l) => l.key === key).name;

test('Scenario: Not started - an open issue with no lifecycle label may be edited', () => {
  assert.deepEqual(canEditIssue(issue([])), { editable: true });
  assert.deepEqual(canEditIssue(issue(['bug', 'good first issue'])), { editable: true });
});

test('Scenario: Returned to the spec writer - needs-spec may be edited', () => {
  assert.deepEqual(canEditIssue(issue([name('needs-spec')])), { editable: true });
});

test('Scenario: Issue sent back to the spec writer - needs-spec with urgent may still be edited', () => {
  assert.deepEqual(canEditIssue(issue([name('needs-spec'), name('urgent')])), { editable: true });
});

test('urgent next to a state that closes the issue does not open it', () => {
  const r = canEditIssue(issue([name('urgent'), name('queued')]));
  assert.equal(r.editable, false);
  assert.equal(r.label, name('queued'));
});

for (const [scenario, key] of [['Issue ready', 'ready'], ['Build in progress', 'building'], ['Waiting to start', 'blocked'], ['Waiting to start', 'queued'], ['Already built', 'built']]) {
  test(`Scenario: ${scenario} - ${key} is refused and names the label`, () => {
    const r = canEditIssue(issue([name(key)]));
    assert.equal(r.editable, false);
    assert.equal(r.label, name(key));
    assert.ok(r.reason.length > 0);
  });
}

test('Scenario: Closed issue - refused whatever its labels', () => {
  const r = canEditIssue(issue([], 'CLOSED'));
  assert.equal(r.editable, false);
  assert.match(r.reason, /closed/);
});

test('every lifecycle label is either editable or refused, so a new label cannot silently make an issue editable', () => {
  for (const { key } of LABELS) {
    const r = canEditIssue(issue([name(key)]));
    assert.equal(r.editable, EDITABLE_LABELS.includes(key), key);
    if (!r.editable) assert.ok(r.label && r.reason, `${key} needs a reason`);
  }
});

test('a label with a configured name is recognised, and the other labels do not matter', () => {
  assert.equal(canEditIssue(issue(['go-now']), { ready: 'go-now' }).editable, false);
  assert.equal(canEditIssue(issue([name('ready')]), { ready: 'go-now' }).editable, true);
});

test('the command prints editable or the refusal and exits 0, 1 or 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'can-edit-'));
  const run = (obj, extra = []) => {
    const file = join(dir, 'issue.json');
    writeFileSync(file, typeof obj === 'string' ? obj : JSON.stringify(obj));
    return spawnSync('node', ['scripts/can-edit-issue.mjs', '--input', file, '--config', join(dir, 'none.yml'), ...extra], { encoding: 'utf8' });
  };
  const ok = run(issue([]));
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout.trim(), 'editable');
  const no = run(issue([name('ready')]));
  assert.equal(no.status, 1);
  assert.match(no.stdout, /^refused: relevo:ready - /);
  assert.equal(run('not json').status, 2);
  assert.equal(run({ labels: [] }).status, 2);
});
