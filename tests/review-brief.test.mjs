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

test('Scenario: Plan shown up front - with precheck or verify a fixed note says the person confirms every line, in both languages', () => {
  const issue = { number: 42, title: 'Birthday list', body: BODY };
  const plain = reviewBrief({ issue, built: BUILT });
  assert.equal(reviewBrief({ issue, built: BUILT, autopilot: 'off' }), plain);
  const en = reviewBrief({ issue, built: BUILT, autopilot: 'precheck' });
  assert.equal(en, `${plain}\nThe agent walks the lines below first; you confirm every line, and lines about appearance are never marked automatically.`);
  const es = reviewBrief({ issue, built: BUILT, autopilot: 'verify', language: 'es' }).split('\n').pop();
  assert.match(es, /tú confirmas cada línea, y las líneas sobre apariencia nunca se marcan automáticamente/);
  assert.ok(es.length <= MAX_LINE);
  const dir = mkdtempSync(join(tmpdir(), 'relevo-brief-'));
  writeFileSync(join(dir, 'body.md'), BODY);
  const cli = spawnSync('node', [new URL('../scripts/review-brief.mjs', import.meta.url).pathname, '--issue', '42', '--title', 'Birthday list', '--body-file', join(dir, 'body.md'), '--autopilot', 'verify'], { encoding: 'utf8' });
  assert.match(cli.stdout, /you confirm every line/);
});

test('Scenario: Autopilot off - an api review has no screen, so the brief says to run the tests and tell the exit code', () => {
  const off = reviewBrief({ issue: { number: 42, title: 'Birthday list', body: BODY }, built: BUILT, kind: 'api' });
  assert.match(off, /run the project's tests yourself.*ran <exit code>/);
  const es = reviewBrief({ issue: { number: 42, title: 'Birthday list', body: BODY }, kind: 'api', language: 'es' });
  assert.match(es, /corre tú los tests del proyecto.*ran <código>/);
});

test('Scenario: A test covers the line - with precheck or verify the api brief says the agent runs the existing test and never writes one', () => {
  ['precheck', 'verify'].forEach((autopilot) => {
    const brief = reviewBrief({ issue: { number: 42, title: 'Birthday list', body: BODY }, kind: 'api', autopilot });
    assert.match(brief, /runs the existing test of each line it finds and never writes one/);
    assert.match(brief, /a line with no test stays for you/);
    assert.doesNotMatch(brief, /appearance/);
  });
  assert.doesNotMatch(reviewBrief({ issue: { number: 42, title: 'Birthday list', body: BODY }, autopilot: 'verify' }), /existing test/);
});

test('the script takes --kind', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-brief-'));
  writeFileSync(join(dir, 'body.md'), BODY);
  const r = spawnSync('node', [new URL('../scripts/review-brief.mjs', import.meta.url).pathname, '--issue', '42', '--title', 'Birthday list', '--body-file', join(dir, 'body.md'), '--kind', 'api'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ran <exit code>/);
});
