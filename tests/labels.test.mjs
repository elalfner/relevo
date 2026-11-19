import test from 'node:test';
import assert from 'node:assert/strict';
import { LABELS, LABEL_KEYS, clearAll, labelDefinitions, resolveLabelNames, transition } from '../scripts/lib/labels.mjs';

test('label set matches the lifecycle spec', () => {
  const states = LABELS.filter((l) => l.kind === 'state').map((l) => l.key);
  assert.deepEqual(states, ['ready', 'queued', 'building', 'built', 'in-review', 'pr-open']);
  const exits = LABELS.filter((l) => l.kind !== 'state').map((l) => l.key);
  assert.deepEqual(exits.sort(), ['blocked', 'build-failed', 'changes-requested', 'go', 'local', 'needs-reviewer', 'needs-spec', 'ship', 'urgent']);
  assert.ok(!LABEL_KEYS.includes('merged'), 'there is no merged label: the final state is the closed issue');
});

test('every label has a unique name, a color and a description', () => {
  const names = LABELS.map((l) => l.name);
  assert.equal(new Set(names).size, names.length);
  LABELS.forEach((l) => {
    assert.match(l.color, /^[0-9a-f]{6}$/);
    assert.ok(l.description.length > 0);
    assert.ok(l.name.length <= 50);
  });
});

test('Scenario: One state at a time - moving to a state removes the previous one in the same operation', () => {
  const change = transition(['relevo:ready', 'bug'], 'building');
  assert.deepEqual(change, { add: ['relevo:building'], remove: ['relevo:ready'] });
});

test('side exits replace the lifecycle label', () => {
  assert.deepEqual(transition(['relevo:building'], 'build-failed'), { add: ['relevo:build-failed'], remove: ['relevo:building'] });
  assert.deepEqual(transition(['relevo:build-failed'], 'built'), { add: ['relevo:built'], remove: ['relevo:build-failed'] });
  assert.deepEqual(transition(['relevo:pr-open'], 'changes-requested'), {
    add: ['relevo:changes-requested'],
    remove: ['relevo:pr-open'],
  });
});

test('needs-reviewer is an overlay: added next to the current state, nothing removed', () => {
  assert.deepEqual(transition(['relevo:pr-open'], 'needs-reviewer'), { add: ['relevo:needs-reviewer'], remove: [] });
});

test('Scenario: Label applied - ship is an overlay next to pr-open', () => {
  assert.deepEqual(transition(['relevo:pr-open'], 'ship'), { add: ['relevo:ship'], remove: [] });
  assert.deepEqual(transition(['relevo:pr-open', 'relevo:ship'], 'changes-requested'), {
    add: ['relevo:changes-requested'],
    remove: ['relevo:pr-open'],
  });
});

test('Scenario: Label applied to a queued issue - urgent is an overlay, nothing is removed', () => {
  assert.deepEqual(transition(['relevo:queued'], 'urgent'), { add: ['relevo:urgent'], remove: [] });
  assert.deepEqual(transition(['relevo:queued', 'relevo:urgent'], 'urgent'), { add: [], remove: [] });
});

test('Scenario: Label stays through the lifecycle - a state change keeps urgent and clearAll removes it', () => {
  assert.deepEqual(transition(['relevo:queued', 'relevo:urgent'], 'building'), { add: ['relevo:building'], remove: ['relevo:queued'] });
  assert.deepEqual(clearAll(['relevo:built', 'relevo:urgent', 'bug']).remove.sort(), ['relevo:built', 'relevo:urgent']);
});

test('Scenario: Renamed label - labels.urgent renames the urgent label', () => {
  assert.equal(resolveLabelNames({ urgent: 'prio:now' }).urgent, 'prio:now');
  assert.equal(labelDefinitions({ urgent: 'prio:now' }).find((l) => l.key === 'urgent').name, 'prio:now');
  assert.deepEqual(transition(['relevo:queued'], 'urgent', { urgent: 'prio:now' }), { add: ['prio:now'], remove: [] });
});

test('Scenario: Run ends - clearAll removes the ship label with the rest', () => {
  assert.deepEqual(clearAll(['relevo:pr-open', 'relevo:ship']).remove.sort(), ['relevo:pr-open', 'relevo:ship']);
});

test('no-op when the issue is already in the target state', () => {
  assert.deepEqual(transition(['relevo:built'], 'built'), { add: [], remove: [] });
});

test('renamed labels from relevo.yml are used everywhere', () => {
  const overrides = { ready: 'listo', building: 'construyendo' };
  assert.equal(resolveLabelNames(overrides).ready, 'listo');
  assert.equal(labelDefinitions(overrides).find((l) => l.key === 'ready').name, 'listo');
  assert.deepEqual(transition(['listo'], 'building', overrides), { add: ['construyendo'], remove: ['listo'] });
});

test('clearAll removes every Relevo label and leaves the others', () => {
  const { remove } = clearAll(['relevo:pr-open', 'relevo:needs-reviewer', 'bug']);
  assert.deepEqual(remove.sort(), ['relevo:needs-reviewer', 'relevo:pr-open']);
});

test('unknown keys are rejected', () => {
  assert.throws(() => transition([], 'merged'), /unknown label key/);
});

test('Scenario: the failed-build label is build-failed, with a description that says what it marks', () => {
  const l = LABELS.find((x) => x.key === 'build-failed');
  assert.equal(l.name, 'relevo:build-failed');
  assert.equal(l.kind, 'exit');
  assert.equal(l.description, 'The build did not end in a hand-off; the comment says why and what to do');
  assert.ok(!LABEL_KEYS.includes('qa-failed'));
});

test('Scenario: the go and local labels - default names, overlays, renamable', () => {
  const go = LABELS.find((l) => l.key === 'go');
  const local = LABELS.find((l) => l.key === 'local');
  assert.equal(go.name, 'relevo:go');
  assert.equal(go.kind, 'overlay');
  assert.equal(local.name, 'relevo:local');
  assert.equal(local.kind, 'overlay');
  assert.equal(resolveLabelNames({ go: 'team:build' }).go, 'team:build');
  assert.equal(labelDefinitions({ local: 'team:machine' }).find((l) => l.key === 'local').name, 'team:machine');
});

test('Scenario: ready is the approval - its description says that it starts nothing', () => {
  assert.match(LABELS.find((l) => l.key === 'ready').description, /starts nothing/);
});

test('Scenario: Local build ends - a move out of building removes local in the same operation', () => {
  assert.deepEqual(transition(['relevo:building', 'relevo:local'], 'built'), { add: ['relevo:built'], remove: ['relevo:building', 'relevo:local'] });
  assert.deepEqual(transition(['relevo:building', 'relevo:local'], 'build-failed'), {
    add: ['relevo:build-failed'],
    remove: ['relevo:building', 'relevo:local'],
  });
  assert.deepEqual(transition(['team:building', 'team:local'], 'built', { building: 'team:building', local: 'team:local' }), {
    add: ['relevo:built'],
    remove: ['team:building', 'team:local'],
  });
});

test('Scenario: Stray label - a local label on an issue that is not building is removed at its next state change', () => {
  assert.deepEqual(transition(['relevo:ready', 'relevo:local'], 'queued'), { add: ['relevo:queued'], remove: ['relevo:ready', 'relevo:local'] });
});

test('a move to another state leaves go and urgent alone', () => {
  assert.deepEqual(transition(['relevo:ready', 'relevo:go', 'relevo:urgent'], 'queued'), { add: ['relevo:queued'], remove: ['relevo:ready'] });
});

test('a move to building does not add local by itself', () => {
  assert.deepEqual(transition(['relevo:ready'], 'building'), { add: ['relevo:building'], remove: ['relevo:ready'] });
  assert.deepEqual(transition(['relevo:ready', 'relevo:local'], 'building'), { add: ['relevo:building'], remove: ['relevo:ready'] });
});
