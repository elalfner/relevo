import test from 'node:test';
import assert from 'node:assert/strict';
import { findCredentials, formatFindings, scanDiff } from '../scripts/lib/scan.mjs';
import { explicitStageArgs } from '../scripts/lib/staging.mjs';

const diff = (body) => `diff --git a/lib/a.dart b/lib/a.dart\nindex 111..222 100644\n--- a/lib/a.dart\n+++ b/lib/a.dart\n@@ -10,2 +10,4 @@\n context\n${body}`;

test('Scenario: Temporary marker staged - names the file and line', () => {
  const findings = scanDiff(diff('+var x = 1; // NOCOMMIT remove me\n+ok\n'));
  assert.deepEqual(findings, [{ file: 'lib/a.dart', line: 11, kind: 'marker', detail: 'NOCOMMIT' }]);
});

test('markers in every comment style', () => {
  const body = ['+// TEMP', '+# DO NOT COMMIT', '+<!-- NOCOMMIT -->', '+/* TEMP */'].join('\n');
  assert.equal(scanDiff(diff(`${body}\n`)).length, 4);
});

test('only added lines count: context and removed lines are ignored', () => {
  const findings = scanDiff(diff('-// NOCOMMIT old\n // TEMP in context\n+clean\n'));
  assert.deepEqual(findings, []);
});

test('words that merely contain a marker are not findings', () => {
  assert.deepEqual(scanDiff(diff('+// attempt to template the temperature\n')), []);
});

test('Scenario: Credential in diff - detected, and the secret is never echoed', () => {
  const secret = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
  const findings = scanDiff(diff(`+const t = "${secret}";\n`));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'credential');
  assert.equal(findings[0].detail, 'github-token');
  assert.ok(!JSON.stringify(findings).includes(secret));
  assert.ok(!formatFindings(findings).includes(secret));
});

test('credential kinds', () => {
  assert.equal(findCredentials('sk-ant-api03-abcdefghijklmnop')[0].name, 'anthropic-key');
  assert.equal(findCredentials('AKIAABCDEFGHIJKLMNOP')[0].name, 'aws-access-key');
  assert.equal(findCredentials('-----BEGIN RSA PRIVATE KEY-----')[0].name, 'private-key');
  assert.equal(findCredentials('api_key = "abcdefghijklmnopqrstuvwx"')[0].name, 'assigned-secret');
  assert.deepEqual(findCredentials('just a normal sentence'), []);
  assert.deepEqual(findCredentials('feature/31-summary'), []);
});

test('Scenario: safe staging - never add everything', () => {
  assert.deepEqual(explicitStageArgs(['lib/a.dart', 'test/a_test.dart']), ['add', '--', 'lib/a.dart', 'test/a_test.dart']);
  ['.', '*', '-A', '--all', '-u'].forEach((bad) => assert.throws(() => explicitStageArgs([bad]), /refusing/));
  assert.throws(() => explicitStageArgs([]), /explicit list/);
  assert.throws(() => explicitStageArgs(['../outside']), /leaves the repository/);
});
