import test from 'node:test';
import assert from 'node:assert/strict';
import { LABELS, LABEL_KEYS, clearAll, labelDefinitions, resolveLabelNames, transition } from '../scripts/lib/labels.mjs';

test('label set matches the lifecycle spec', () => {
  const states = LABELS.filter((l) => l.kind === 'state').map((l) => l.key);
  assert.deepEqual(states, ['ready', 'queued', 'building', 'built', 'in-review', 'pr-open']);
  const exits = LABELS.filter((l) => l.kind !== 'state').map((l) => l.key);
  assert.deepEqual(exits.sort(), ['blocked', 'changes-requested', 'needs-reviewer', 'needs-spec', 'qa-failed', 'ship', 'urgent']);
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
  assert.deepEqual(transition(['relevo:building'], 'qa-failed'), { add: ['relevo:qa-failed'], remove: ['relevo:building'] });
  assert.deepEqual(transition(['relevo:qa-failed'], 'built'), { add: ['relevo:built'], remove: ['relevo:qa-failed'] });
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
