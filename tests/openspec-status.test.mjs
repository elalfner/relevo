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
