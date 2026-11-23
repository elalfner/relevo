import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decidePr, ownerOf } from '../scripts/lib/review-state.mjs';

const CLI = new URL('../scripts/review-state.mjs', import.meta.url).pathname;
const items = (...titles) => titles.map((title, i) => ({ id: i + 1, title, status: 'pending' }));

// ---------- the comparison by content (check-review-state-owner-by-content)

test('Scenario: Older state of another review - no line of it is a scenario of the change', () => {
  const r = ownerOf({ kind: 'device', items: items('Alpha', 'Beta') }, { change: 'add-login', kind: 'device', titles: ['Gamma', 'Delta'] });
  assert.deepEqual([r.ok, r.foreign, r.unknown, r.lines], [false, true, undefined, 2]);
  assert.match(r.reason, /another review: none of its 2 lines is a scenario of add-login/);
  assert.match(ownerOf({ kind: 'device', items: items('Alpha') }, { change: 'x', kind: 'device', titles: ['B'] }).reason, /none of its 1 line is a scenario/);
});

test('Scenario: Older state - a state that shares a line stays of unknown owner', () => {
  const r = ownerOf({ kind: 'device', items: items('Alpha', 'Beta') }, { change: 'add-login', kind: 'device', titles: ['Beta', 'Gamma'] });
  assert.deepEqual([r.ok, r.unknown, r.foreign], [false, true, undefined]);
});

test('Scenario: Older state without lines - nothing to compare, so the owner is unknown', () => {
  const r = ownerOf({ kind: 'device', items: [] }, { change: 'add-login', kind: 'device', titles: ['Gamma'] });
  assert.deepEqual([r.ok, r.unknown, r.foreign], [false, true, undefined]);
});

test('a state that records its change is decided by the name alone, whatever its lines are', () => {
  assert.deepEqual(ownerOf({ kind: 'device', change: 'add-login', items: items('Alpha') }, { change: 'add-login', kind: 'device', titles: ['Gamma'] }), { ok: true });
  assert.match(ownerOf({ kind: 'device', change: 'other', items: items('Gamma') }, { change: 'add-login', kind: 'device', titles: ['Gamma'] }).reason, /for the change other, not add-login/);
});

test('without titles the comparison is by name and kind only, as before', () => {
  assert.equal(ownerOf({ kind: 'device', items: items('Alpha') }, { change: 'x', kind: 'device' }).unknown, true);
  assert.match(ownerOf({ kind: 'api', items: items('A') }, { change: 'x', kind: 'device', titles: ['A'] }).reason, /api review, not a device review/);
});

// ---------- init and owner through the command: the older state of another issue

function world() {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-owner-'));
  const change = (name, ...scenarios) => {
    mkdirSync(join(dir, name, 'specs', 'cap'), { recursive: true });
    writeFileSync(join(dir, name, 'specs', 'cap', 'spec.md'), `## ADDED Requirements\n### Requirement: R\n${scenarios.map((s) => `#### Scenario: ${s}\n- **WHEN** a\n- **THEN** b\n`).join('')}`);
    return join(dir, name);
  };
  const state = join(dir, 'evidence', 'review-state.json');
  const run = (...args) => spawnSync('node', [CLI, ...args, '--state', state], { encoding: 'utf8' });
  // A state as an earlier version wrote it: the same shape, with no `change`.
  const older = (dirOfChange) => {
    run('init', dirOfChange);
    const s = JSON.parse(readFileSync(state, 'utf8'));
    delete s.change;
    writeFileSync(state, JSON.stringify(s));
  };
  return { dir, change, state, run, older, read: () => readFileSync(state, 'utf8') };
}

test('Scenario: Older state of another review - init refuses and leaves the file, and owner exits 1 with the count', () => {
  const w = world();
  const a = w.change('issue-a', 'Alpha one', 'Alpha two');
  const b = w.change('issue-b', 'Beta one');
  w.older(a);
  const before = w.read();
  const init = w.run('init', b);
  assert.equal(init.status, 2);
  assert.match(init.stderr, /already holds a review that is not this one: it is the state of another review: none of its 2 lines is a scenario of issue-b/);
  assert.equal(w.read(), before, 'nothing was changed');
  const owner = w.run('owner', b);
  assert.equal(owner.status, 1);
  assert.match(owner.stdout, /is not the device review of issue-b: it is the state of another review: none of its 2 lines/);
});

test('Scenario: Older state - a state that shares a line is of unknown owner: owner exits 1 asking, and init does not refuse', () => {
  const w = world();
  const a = w.change('issue-a', 'Shared line', 'Alpha two');
  const b = w.change('issue-b', 'Shared line', 'Beta two');
  w.older(a);
  const owner = w.run('owner', b);
  assert.equal(owner.status, 1);
  assert.match(owner.stdout, /owner of .* is unknown.*ask the person whether it is theirs/);
  assert.equal(w.run('init', b).status, 0);
  assert.equal(JSON.parse(w.read()).change, 'issue-b');
});

test('Scenario: Older state without lines - init does not refuse it', () => {
  const w = world();
  const a = w.change('issue-a', 'Alpha one');
  w.older(a);
  const s = JSON.parse(w.read());
  s.items = [];
  writeFileSync(w.state, JSON.stringify(s));
  const b = w.change('issue-b', 'Beta one');
  assert.match(w.run('owner', b).stdout, /is unknown/);
  assert.equal(w.run('init', b).status, 0);
});

// ---------- decide with the change

function confirmed(w, dirOfChange, { withChange = true } = {}) {
  w.run('init', dirOfChange);
  const s = JSON.parse(w.read());
  if (!withChange) delete s.change;
  s.items.forEach((i) => { i.status = 'ok'; });
  s.audit = { verdict: 'REVIEW PASSED', findings: [] };
  s.agreed = true;
  writeFileSync(w.state, JSON.stringify(s));
}

test('Scenario: Pull request over another review - a state with every line confirmed is refused for another change, and without the change decide is as before', () => {
  const w = world();
  const a = w.change('issue-a', 'Alpha one');
  const b = w.change('issue-b', 'Beta one');
  confirmed(w, a);
  const refused = w.run('decide', b);
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /must NOT be opened yet/);
  assert.match(refused.stdout, /the state is not the review of this change: it is for the change issue-a, not issue-b/);
  assert.equal(w.run('decide').status, 0, 'Scenario: Decide without the change');
  assert.equal(w.run('decide', a).status, 0, 'the right change decides from the state');
});

test('Scenario: Pull request over another review - another kind and an older state of another review by content are refused', () => {
  const w = world();
  const a = w.change('issue-a', 'Alpha one');
  confirmed(w, a);
  const kind = w.run('decide', a, '--adapter', 'api');
  assert.equal(kind.status, 1);
  assert.match(kind.stdout, /it is for a device review, not an api review/);
  const old = world();
  const a2 = old.change('issue-a', 'Alpha one');
  const b2 = old.change('issue-b', 'Beta one');
  confirmed(old, a2, { withChange: false });
  const foreign = old.run('decide', b2);
  assert.equal(foreign.status, 1);
  assert.match(foreign.stdout, /another review: none of its 1 line is a scenario of issue-b/);
  const shares = world();
  const a3 = shares.change('issue-a', 'Shared line');
  const b3 = shares.change('issue-b', 'Shared line');
  confirmed(shares, a3, { withChange: false });
  assert.equal(shares.run('decide', b3).status, 0, 'an unknown owner that shares lines passes: the person resumed it knowingly');
});

test('decide refuses a change folder that does not exist', () => {
  const w = world();
  confirmed(w, w.change('issue-a', 'Alpha one'));
  assert.equal(w.run('decide', join(w.dir, 'nope')).status, 2);
});

test('owner and decide do not fail on a folder whose specification cannot be read: they compare the name and the kind only', () => {
  const w = world();
  const a = w.change('issue-a', 'Alpha one');
  confirmed(w, a);
  const nospec = join(w.dir, 'no-specs');
  mkdirSync(nospec);
  const owner = w.run('owner', nospec);
  assert.equal(owner.status, 1);
  assert.match(owner.stdout, /it is for the change issue-a, not no-specs/);
  assert.equal(w.run('decide', nospec).status, 1);
});
