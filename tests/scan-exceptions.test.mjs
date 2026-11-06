import test from 'node:test';
import assert from 'node:assert/strict';
import { entryProblem, formatExceptionReport, parseExceptions, scanWithExceptions } from '../scripts/lib/scan-exceptions.mjs';

// The marker is built here so that this file does not trip the scan it tests.
const MARKER = ['NO', 'COMMIT'].join('');
const diff = (file, body, start = 10) => `diff --git a/${file} b/${file}\nindex 111..222 100644\n--- a/${file}\n+++ b/${file}\n@@ -${start},1 +${start},3 @@\n context\n${body}`;
const LINE = "+  password: 'hunter2hunter2hunter2',\n";
const list = (...entries) => JSON.stringify({ exceptions: entries });
const entry = { path: 'src/schema.ts', pattern: "password: 'hunter2", reason: 'form schema, not a secret' };

test('Scenario: A listed line goes through, and the report says one exception was applied', () => {
  const r = scanWithExceptions(diff('src/schema.ts', LINE), list(entry));
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.applied, [{ path: 'src/schema.ts', reason: 'form schema, not a secret' }]);
  assert.match(formatExceptionReport(r), /scan exceptions applied: 1\n {2}src\/schema\.ts {2}reviewed: form schema, not a secret/);
});

test('Scenario: The line moved - the match does not depend on the line number', () => {
  const r = scanWithExceptions(diff('src/schema.ts', LINE, 400), list(entry));
  assert.deepEqual(r.findings, []);
  assert.equal(r.applied.length, 1);
});

test('Scenario: A finding that is not listed is still reported', () => {
  const other = scanWithExceptions(diff('src/other.ts', LINE), list(entry));
  assert.equal(other.findings.length, 1);
  const otherLine = scanWithExceptions(diff('src/schema.ts', "+  token: 'abcdefghijklmnop1234',\n"), list(entry));
  assert.equal(otherLine.findings.length, 1);
  assert.equal(scanWithExceptions(diff('src/schema.ts', LINE), null).findings.length, 1);
});

test('a glob of files covers files of the same name pattern, one folder at a time', () => {
  const e = { ...entry, path: 'src/forms/*.ts' };
  assert.deepEqual(scanWithExceptions(diff('src/forms/login.ts', LINE), list(e)).findings, []);
  assert.equal(scanWithExceptions(diff('src/forms/deep/login.ts', LINE), list(e)).findings.length, 1);
});

test('Scenario: Too broad an entry is never applied and is named', () => {
  const bad = [
    { ...entry, path: 'src/' },
    { ...entry, path: 'src/**' },
    { ...entry, path: 'src/*' },
    { ...entry, pattern: 'secret' },
    { ...entry, reason: '  ' },
    { ...entry, reason: undefined },
    'text',
  ];
  bad.forEach((b) => assert.notEqual(entryProblem(b), null, JSON.stringify(b)));
  const r = scanWithExceptions(diff('src/schema.ts', LINE), list(...bad));
  assert.equal(r.findings.length, 1);
  assert.equal(r.refused.length, bad.length);
  assert.match(formatExceptionReport(r), /scan exception refused: src\/ \(entry 1\) {2}the path is a folder/);
});

test('a file that is missing, empty or not valid applies nothing', () => {
  assert.deepEqual(parseExceptions(null), { entries: [], refused: [] });
  assert.deepEqual(parseExceptions(' \n'), { entries: [], refused: [] });
  assert.equal(parseExceptions('{nope').refused.length, 1);
  assert.equal(parseExceptions('{"other":[]}').refused.length, 1);
  assert.equal(scanWithExceptions(diff('src/schema.ts', LINE), '{nope').findings.length, 1);
});

test('Scenario: A marker on a listed line is still refused', () => {
  const body = `+  password: 'hunter2hunter2hunter2', // ${MARKER}\n`;
  const r = scanWithExceptions(diff('src/schema.ts', body), list(entry));
  assert.deepEqual(r.applied, []);
  assert.ok(r.findings.some((f) => f.kind === 'marker'));
  const alone = scanWithExceptions(diff('src/schema.ts', `+// ${MARKER}\n`), list({ ...entry, pattern: MARKER }));
  assert.equal(alone.findings.length, 1);
});

test('the report never carries the pattern or the secret', () => {
  const text = formatExceptionReport(scanWithExceptions(diff('src/schema.ts', LINE), list(entry)));
  assert.ok(!text.includes('hunter2'));
});
