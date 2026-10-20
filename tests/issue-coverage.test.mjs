import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agreementIds, coverage } from '../scripts/lib/issue-coverage.mjs';

const CLI = new URL('../scripts/issue-coverage.mjs', import.meta.url).pathname;
const AGREEMENT = `Settled so far
- D1: sort by name
- D2: no pagination
- C1: loads in under one second
- A1: birthdays come from the clients table
- Q1: should clients without a phone be listed?
- D10: keep the old export
`;
const ISSUE = `## Decisions

### D1. Sort by name
Decided: by name

### D2. No pagination
Decided: all in one list

## Constraints

- C1: loads in under one second

## Assumptions

- A1: birthdays come from the clients table

## Open questions

- Q1: should clients without a phone be listed?
`;

test('the ids of an agreement are read from the start of each line, once', () => {
  assert.deepEqual(agreementIds(AGREEMENT), ['D1', 'D2', 'C1', 'A1', 'Q1', 'D10']);
  assert.deepEqual(agreementIds('- **D3** bold\n- D3 again\n'), ['D3']);
  assert.deepEqual(agreementIds(''), []);
});

test('Scenario: An id with no destination - D10 is not mistaken for D1, and is listed as without destination', () => {
  const r = coverage({ agreement: AGREEMENT, issues: [{ name: '1.md', body: ISSUE }] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['D10']);
  assert.deepEqual(r.found.map((f) => [f.id, f.section]), [['D1', 'Decisions'], ['D2', 'Decisions'], ['C1', 'Constraints'], ['A1', 'Assumptions'], ['Q1', 'Open questions']]);
});

test('Scenario: Discarded on purpose - the id is listed as discarded and the check passes', () => {
  const r = coverage({ agreement: AGREEMENT, issues: [{ name: '1.md', body: ISSUE }], discarded: ['D10'] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.discarded, ['D10']);
});

test('with two issues an id counts if any of them holds it, and the table names which', () => {
  const second = '## Decisions\n\n### D10. Keep the old export\nDecided: yes\n';
  const r = coverage({ agreement: AGREEMENT, issues: [{ name: '1.md', body: ISSUE }, { name: '2.md', body: second }] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.found.find((f) => f.id === 'D10'), { id: 'D10', issue: '2.md', section: 'Decisions' });
});

test('the script prints the table and exits 1 or 0, or 2 for bad arguments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-cov-'));
  writeFileSync(join(dir, 'a.md'), AGREEMENT);
  writeFileSync(join(dir, 'i.md'), ISSUE);
  const run = (...a) => spawnSync('node', [CLI, '--agreement', join(dir, 'a.md'), '--issue', join(dir, 'i.md'), ...a], { encoding: 'utf8' });
  const bad = run();
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /D10\tWITHOUT DESTINATION/);
  const ok = run('--discarded', 'D10');
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /D10\t\(discarded\)/);
  assert.equal(spawnSync('node', [CLI], { encoding: 'utf8' }).status, 2);
});
