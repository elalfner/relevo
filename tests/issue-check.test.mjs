import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkIssueDraft, PLACEHOLDERS, TITLE_MAX } from '../scripts/lib/issue-check.mjs';
import { parseIssueBody } from '../scripts/lib/issue-parse.mjs';

const GOOD = `## Summary
Shows who has a birthday today.

## Scenarios
- **WHEN** 3 clients have a birthday today
- **THEN** the list shows 3 names

## Edge cases
- a client without a phone: the send button is disabled

Depends-on: #12
`;

test('a complete draft passes and reports what it found', () => {
  const r = checkIssueDraft({ title: 'Birthday list', body: GOOD });
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
  assert.equal(r.scenarios, 1);
  assert.equal(r.edgeCases, 1);
  assert.deepEqual(r.dependsOn, [12]);
});

test('Scenario: Missing edge cases - the check fails and says what is missing', () => {
  const r = checkIssueDraft({ title: 'Birthday list', body: GOOD.replace(/## Edge cases[\s\S]*?\n\n/, '') });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /edge cases/);
});

test('a draft that go would send back is never ready (same rules as the spec gate)', () => {
  const bodies = [GOOD, 'just words', GOOD.replace('**THEN**', 'then maybe')];
  bodies.forEach((body) => {
    const gate = parseIssueBody(body).missing.length === 0;
    assert.equal(checkIssueDraft({ title: 'x', body }).ok, gate);
  });
});

test('Scenario: Credential in the text - the check fails without echoing the secret', () => {
  const secret = 'sk-ant-abcdefghijklmnop12345';
  const r = checkIssueDraft({ title: 'x', body: `${GOOD}\nkey: ${secret}` });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /credential/);
  assert.ok(!r.problems.join('\n').includes(secret));
});

test('titles: no emoji, not empty, not longer than the limit', () => {
  assert.match(checkIssueDraft({ title: '🚨 Alerts', body: GOOD }).problems.join(), /emoji/);
  assert.match(checkIssueDraft({ title: '  ', body: GOOD }).problems.join(), /empty/);
  assert.match(checkIssueDraft({ title: 'a'.repeat(TITLE_MAX + 1), body: GOOD }).problems.join(), /characters/);
  assert.equal(checkIssueDraft({ title: 'a'.repeat(TITLE_MAX), body: GOOD }).ok, true);
  assert.equal(checkIssueDraft({ title: 'Reporte de cumpleaños (año bisiesto)', body: GOOD }).ok, true);
});

test('the untouched template is rejected because it still holds template text', () => {
  const template = readFileSync(new URL('../templates/issue.md', import.meta.url), 'utf8');
  const r = checkIssueDraft({ title: 'Something', body: template });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /template text/);
  PLACEHOLDERS.forEach((p) => assert.ok(template.includes(p), `the template no longer contains ${p}`));
});

test('the CLI exits 0 for a good draft, 1 for a bad one, 2 for bad arguments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  const cli = new URL('../scripts/check-issue.mjs', import.meta.url).pathname;
  writeFileSync(join(dir, 'good.md'), GOOD);
  writeFileSync(join(dir, 'bad.md'), 'nothing here');
  const run = (...args) => spawnSync('node', [cli, ...args], { encoding: 'utf8' });
  assert.equal(run('--title', 'Birthday list', '--body-file', join(dir, 'good.md')).status, 0);
  const bad = run('--title', 'Birthday list', '--body-file', join(dir, 'bad.md'));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /problem:/);
  assert.equal(run().status, 2);
  assert.equal(run('--title', 'x', '--body-file', join(dir, 'missing.md')).status, 2);
});

// ---------- the optional Documentation section

const DOC_SECTION = `
## Documentation

- Add these entries to \`GLOSSARY.md\`, under its existing heading, after the existing ones, exactly as written. They are vocabulary only; nothing else in that file changes.

**Build number**:
The number after the \`+\` in the version of pubspec.yaml, shown in the app bar subtitle.
_Avoid_: Build label, build
`;

test('Scenario: Issue with the section - the check passes and counts only the scenarios and edge cases', () => {
  const without = checkIssueDraft({ title: 'Birthday list', body: GOOD });
  const body = GOOD.replace('\nDepends-on: #12\n', `${DOC_SECTION}\nDepends-on: #12\n`);
  const withDoc = checkIssueDraft({ title: 'Birthday list', body });
  assert.equal(withDoc.ok, true, withDoc.problems.join('; '));
  assert.equal(withDoc.scenarios.length, without.scenarios.length);
  assert.equal(withDoc.edgeCases.length, without.edgeCases.length);
  assert.deepEqual(withDoc.dependsOn, without.dependsOn);
});

test('an issue without the section stays valid', () => {
  assert.equal(checkIssueDraft({ title: 'Birthday list', body: GOOD }).ok, true);
});

test('a Documentation section that still has the template placeholders is rejected', () => {
  const body = GOOD.replace('\nDepends-on: #12\n', '\n## Documentation\n\n**<term>**:\n<definition>\n_Avoid_: <words to avoid>\n\nDepends-on: #12\n');
  const r = checkIssueDraft({ title: 'Birthday list', body });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /template text: .*<term>/);
});

test('the Documentation section never hides a missing edge case', () => {
  const body = `## Scenarios\n- **WHEN** a\n- **THEN** b\n${DOC_SECTION}`;
  const r = checkIssueDraft({ title: 'Birthday list', body });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /edge case/i);
});
