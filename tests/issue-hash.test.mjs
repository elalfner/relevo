import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkIssueHash, issueHash, shortHash } from '../scripts/lib/issue-hash.mjs';

const CLI = new URL('../scripts/issue-hash.mjs', import.meta.url).pathname;
const issue = { title: 'Reset the counter', body: '## Scenarios\n- **WHEN** the button is tapped\n- **THEN** the counter is 0\n' };
const run = (...args) => spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
const save = (data) => {
  const path = join(mkdtempSync(join(tmpdir(), 'relevo-hash-')), 'issue.json');
  writeFileSync(path, JSON.stringify(data));
  return path;
};

test('Scenario: Issue unchanged - the same text gives the same hash', () => {
  assert.equal(issueHash(issue), issueHash({ ...issue }));
  assert.match(issueHash(issue), /^[0-9a-f]{64}$/);
});

test('Scenario: Only whitespace differs - line endings and trailing spaces do not change the hash', () => {
  const crlf = { title: 'Reset the counter  ', body: issue.body.replace(/\n/g, '\r\n') };
  const spaces = { title: issue.title, body: issue.body.replace('tapped', 'tapped   ').replace('is 0', 'is 0\t') };
  assert.equal(issueHash(crlf), issueHash(issue));
  assert.equal(issueHash(spaces), issueHash(issue));
});

test('Scenario: Issue edited after ready - one changed word gives another hash', () => {
  assert.notEqual(issueHash({ ...issue, body: issue.body.replace('0', '1') }), issueHash(issue));
  assert.notEqual(issueHash({ ...issue, title: 'Reset the total' }), issueHash(issue));
});

test('a title and a body cannot be swapped to give the same hash', () => {
  assert.notEqual(issueHash({ title: 'a', body: 'b' }), issueHash({ title: 'b', body: 'a' }));
});

test('a missing body is the same as an empty one', () => {
  assert.equal(issueHash({ title: 'x' }), issueHash({ title: 'x', body: '' }));
});

test('checkIssueHash compares with the claimed hash, ignoring the case of the expected value', () => {
  const claimed = issueHash(issue);
  assert.equal(checkIssueHash({ expected: claimed, ...issue }).ok, true);
  assert.equal(checkIssueHash({ expected: claimed.toUpperCase(), ...issue }).ok, true);
  assert.equal(checkIssueHash({ expected: claimed, ...issue, body: 'other' }).ok, false);
  assert.equal(checkIssueHash({ expected: undefined, ...issue }).ok, false);
});

test('shortHash keeps the first 8 characters', () => {
  assert.equal(shortHash('0123456789abcdef'), '01234567');
  assert.equal(shortHash(undefined), '');
});

test('the command exits 0 for the same text and prints the short hash', () => {
  const r = run('--input', save(issue), '--expect', issueHash(issue));
  assert.equal(r.status, 0);
  assert.match(r.stdout, /unchanged \([0-9a-f]{8}\)/);
});

test('Scenario: Run started by hand - the command exits 1 when the text differs', () => {
  const r = run('--input', save({ ...issue, body: 'something else' }), '--expect', issueHash(issue));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /changed after it was claimed/);
});

test('without --expect the command prints the hash, and it fails clearly on bad arguments', () => {
  assert.equal(run('--input', save(issue)).stdout.trim(), issueHash(issue));
  const bad = run('--repo', 'owner/name');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /usage: issue-hash\.mjs/);
  assert.equal(run('--input', '/nonexistent/issue.json', '--expect', 'x').status, 2);
});
