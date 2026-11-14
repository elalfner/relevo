import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialMatches, findCredentials, formatFindings, scanDiff } from '../scripts/lib/scan.mjs';
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

test('Scenario: Reference, call and member access - code that only names a secret is not a possible credential', () => {
  [
    'token: someLongVariableName',
    'password = readPasswordFromVault(options)',
    'secret = configurationObjectOfTheApp.value',
    'secret = items[index_of_the_secret_item]',
    'passwd = read_the_password_from_vault',
    'api-key: the-key-of-the-current-user',
  ].forEach((line) => assert.deepEqual(findCredentials(line), [], line));
  assert.deepEqual(scanDiff(diff('+  password = readPasswordFromVault(options);\n+  final token = someLongVariableName;\n')), []);
});

test('Scenario: Quoted literal and unquoted literal with the look of a secret are possible credentials', () => {
  [
    'api_key = "abcdefghijklmnopqrstuvwx"',
    "secret: 'someLongQuotedLiteralValue'",
    '"token": "AbCdEfGhIjKlMnOp"',
    'password: hunter2hunter2hunter2',
    'token=dGhpcyBpcyBhIHRlc3Q=',
    'API_KEY=abcdef0123456789abcdef',
  ].forEach((line) => assert.equal(findCredentials(line)[0]?.name, 'assigned-secret', line));
});

test('a literal is found even when an earlier assignment on the line is only code', () => {
  assert.equal(findCredentials('token: someLongVariableName; api_key=abcdefghijklmnop1234')[0]?.name, 'assigned-secret');
});

test('Scenario: Provider key - found whatever the variable is called, and the value is never in a finding', () => {
  const secret = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
  const findings = scanDiff(diff(`+const harmless = "${secret}";\n`));
  assert.equal(findings[0].detail, 'github-token');
  const literal = 'hunter2hunter2hunter2';
  const assigned = scanDiff(diff(`+password: ${literal}\n`));
  assert.equal(assigned[0].detail, 'assigned-secret');
  assert.ok(!JSON.stringify(assigned).includes(literal));
  assert.ok(!formatFindings(assigned).includes(literal));
});

test('strict mode still flags a long opaque token in a configuration value', () => {
  assert.equal(findCredentials('abcdefghijklmnopqrstuvwxyz0123456789ABCDEF', { strict: true })[0]?.name, 'opaque-token');
  assert.deepEqual(findCredentials('abcdefghijklmnopqrstuvwxyz0123456789ABCDEF'), []);
});

test('Scenario: safe staging - never add everything', () => {
  assert.deepEqual(explicitStageArgs(['lib/a.dart', 'test/a_test.dart']), ['add', '--', 'lib/a.dart', 'test/a_test.dart']);
  ['.', '*', '-A', '--all', '-u'].forEach((bad) => assert.throws(() => explicitStageArgs([bad]), /refusing/));
  assert.throws(() => explicitStageArgs([]), /explicit list/);
  assert.throws(() => explicitStageArgs(['../outside']), /leaves the repository/);
});

test('credentialMatches: the same kinds as findCredentials, every match with where it sits, and only the accepted assignments (#163)', () => {
  const key = 'AKIAIOSFODNN7EXAMPLE';
  const other = 'AKIAABCDEFGHIJKLMNOP';
  const text = `A=${key} B=${other} token = readTokenFromVault(x) password: 'hunter2hunter2hunter2'`;
  const found = credentialMatches(text);
  assert.deepEqual(found.filter((m) => m.name === 'aws-access-key').map((m) => text.slice(m.start, m.end)), [key, other]);
  assert.equal(found.filter((m) => m.name === 'assigned-secret').length, 1, 'a call is not an assigned secret');
  assert.deepEqual([...new Set(found.map((m) => m.name))].sort(), findCredentials(text).map((c) => c.name).sort());
  assert.deepEqual(credentialMatches('const answer = 42;'), []);
  [`ghp_${'a1'.repeat(18)}`, 'sk-ant-api03-abcdefghijklmnop', '-----BEGIN RSA PRIVATE KEY-----', 'xoxb-1234567890-abcdef'].forEach((t) => {
    assert.deepEqual(credentialMatches(t).map((m) => m.name), findCredentials(t).map((c) => c.name), t);
  });
});
