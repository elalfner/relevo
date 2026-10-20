import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { firstSentences, MAX_LINE, reviewBrief } from '../scripts/lib/review-brief.mjs';

const BODY = `## Summary

Shows who has a birthday today. It is for the front desk. A third sentence. A fourth one.

## Outcome

The list shows today's birthdays. Nothing else.

## Scenarios
- **WHEN** 3 clients have a birthday today
- **THEN** the list shows 3 names

- **WHEN** nobody has a birthday
- **THEN** the screen says so

## Edge cases
- a client without a phone: the send button is disabled
`;
const BUILT = 'built ✅\n\nRiskiest area, check it first: the send button on small screens\nYour next step: /relevo:review 42\n';

test('Scenario: Brief shown first - about five lines: title, what was asked, outcome, risk, counts', () => {
  const lines = reviewBrief({ issue: { number: 42, title: 'Birthday list', body: BODY }, built: BUILT }).split('\n');
  assert.deepEqual(lines, [
    '#42 Birthday list',
    'Asked: Shows who has a birthday today. It is for the front desk.',
    "Outcome: The list shows today's birthdays.",
    'Check first: the send button on small screens',
    'To check: 2 scenario(s), 1 edge case(s)',
  ]);
});

test('Scenario: Long summary - only the first two sentences are kept', () => {
  assert.equal(firstSentences('One. Two. Three. Four.'), 'One. Two.');
  assert.equal(firstSentences('<!-- note --> Only one'), 'Only one');
  assert.equal(firstSentences(''), '');
});

test('a missing outcome or risk leaves the line out, and every line is capped', () => {
  const lines = reviewBrief({ issue: { number: 7, title: 'Short', body: `## Summary\n\n${'word '.repeat(100)}\n\n## Scenarios\n- **WHEN** a\n- **THEN** b\n\n## Edge cases\n- c\n` } }).split('\n');
  assert.equal(lines.length, 3);
  lines.forEach((l) => assert.ok(l.length <= MAX_LINE, `${l.length} characters`));
  assert.match(lines[1], /…$/);
});

test('the brief and the risk line follow the language', () => {
  const es = reviewBrief({ issue: { number: 42, title: 'Lista', body: BODY }, built: 'Zona más riesgosa, revísala primero: el botón\n', language: 'es' });
  assert.match(es, /Se pidió: /);
  assert.match(es, /Revisa primero: el botón/);
  assert.match(es, /Por revisar: 2 escenario\(s\), 1 caso\(s\) borde/);
});

test('the script prints the brief and exits 2 without arguments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-rb-'));
  writeFileSync(join(dir, 'i.md'), BODY);
  writeFileSync(join(dir, 'c.md'), BUILT);
  const cli = new URL('../scripts/review-brief.mjs', import.meta.url).pathname;
  const r = spawnSync('node', [cli, '--issue', '42', '--title', 'Birthday list', '--body-file', join(dir, 'i.md'), '--built-file', join(dir, 'c.md')], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^#42 Birthday list\n/);
  assert.equal(spawnSync('node', [cli], { encoding: 'utf8' }).status, 2);
});
