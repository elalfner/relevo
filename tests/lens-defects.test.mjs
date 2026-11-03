import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCases } from '../scripts/lib/lens-cases.mjs';

const LENSES = ['spec', 'security', 'code', 'interface'];
const STACKS = ['flutter', 'vue', 'laravel', 'supabase'];
const REQUIRED = [
  'code/flutter/state-update-after-await',
  'security/laravel/unescaped-output',
  'security/supabase/table-without-policy',
  'security/vue/hard-coded-secret',
  'spec/vue/scenario-without-code',
  'spec/vue/task-without-implementation',
  'spec/vue/broken-decision',
  'spec/flutter/altered-documentation',
];

const cases = loadCases();

test('every defect of the design has a case', () => {
  const ids = cases.map((c) => c.id);
  for (const id of REQUIRED) assert.ok(ids.includes(id), `missing case ${id}`);
  assert.ok(cases.filter((c) => c.meta.lens === 'interface').length >= 1, 'no interface case');
});

for (const c of cases) {
  test(`case ${c.id} has a bad and a good variant and states the expected finding`, () => {
    assert.ok(LENSES.includes(c.meta.lens));
    assert.ok(STACKS.includes(c.meta.stack));
    assert.equal(c.id, `${c.meta.lens}/${c.meta.stack}/${c.meta.case}`);
    assert.ok(c.meta.description && c.meta.description.length > 10);
    assert.equal(c.meta.expected.lens, c.meta.lens);
    assert.ok(c.meta.expected.finding, 'expected finding');
    assert.doesNotThrow(() => new RegExp(c.meta.expected.finding, 'i'));
    assert.ok(Object.keys(c.bad).length > 0, 'bad variant is empty');
    assert.ok(Object.keys(c.good).length > 0, 'good variant is empty');
    assert.notDeepEqual(c.bad, c.good, 'bad and good are the same');
  });
}
