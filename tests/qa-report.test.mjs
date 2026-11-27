import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from '../scripts/lib/cli.mjs';
import { attemptOf, recordMarker } from '../scripts/lib/qa-record.mjs';

const CLI = new URL('../scripts/cli.mjs', import.meta.url).pathname;
const found = (text) => [attemptOf({ findings: [{ lens: 'spec', class: 'fixable', text }] }), attemptOf()];
const marker = (over = {}) => recordMarker({ command: 'go', passed: true, rounds: found('Scenario 2 has no code'), withText: true, ...over });
const comment = (issue, body, over = {}) => ({ user: { type: 'Bot' }, issue_url: `https://api.github.com/repos/acme/app/issues/${issue}`, created_at: '2026-03-09T10:00:00Z', body, ...over });

// `relevo qa-report` with a fake `gh` that answers every page with the comments given and logs its arguments.
function report(comments, ...args) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-report-'));
  writeFileSync(join(dir, 'comments.json'), JSON.stringify(comments));
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\necho "$*" >> "${dir}/calls"\ncat "${dir}/comments.json"\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  const r = spawnSync('node', [CLI, 'qa-report', '--repo', 'acme/app', ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
  return { ...r, calls: readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n') };
}

test('the options are checked', () => {
  assert.deepEqual(parseArgs(['qa-report']), { command: 'qa-report', repo: null, since: null, list: false });
  assert.deepEqual(parseArgs(['qa-report', '--repo=acme/app', '--since', '2026-03-01', '--list']), { command: 'qa-report', repo: 'acme/app', since: '2026-03-01', list: true });
  for (const bad of [['--since', 'yesterday'], ['--since', '2026-02-31'], ['--repo'], ['--repo', 'a/b/c'], ['--scope', 'user']]) assert.ok(parseArgs(['qa-report', ...bad]).error, bad.join(' '));
});

test('Scenario: No records - it says there is nothing recorded and gives no figures', () => {
  const r = report([comment(1, 'QA passed. 4 findings fixed.')]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'Nothing recorded: no comment of acme/app carries a QA record.\n');
});

test('Scenario: A run that failed - its findings are not counted as corrected before the hand-off; it only reads', () => {
  const r = report([
    comment(1, marker()),
    comment(2, marker({ passed: false, rounds: found('The total is wrong') })),
    comment(1, marker({ command: 'fix', kind: 'defect', rounds: [attemptOf()] })),
  ], '--list');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Blocking findings of the first attempt: 2, of which 1 in runs that ended passed$/m);
  assert.match(r.stdout, /^ {2}spec fixable: 2 \(1 in runs that ended passed\)$/m);
  assert.match(r.stdout, /^Runs recorded: 3 \(2 of go, 1 of fix\)\nRuns in which QA stopped something: 2\nCorrections of fix by kind: defect 1$/m);
  assert.match(r.stdout, /^#2 2026-03-09 go, not passed\n {2}attempt 1: spec fixable: The total is wrong$/m);
  assert.match(r.stdout, /^#1 2026-03-09 fix, passed, kind defect$/m);
  assert.deepEqual(r.calls, ['api repos/acme/app/issues/comments?per_page=100&page=1']);
});

test('Scenario: A stranger types a marker, and two markers in one comment - neither is counted', () => {
  const r = report([
    comment(1, marker(), { user: { type: 'User' }, author_association: 'NONE' }),
    comment(2, `${marker()}\n${marker()}`),
    comment(3, marker(), { user: { type: 'User' }, author_association: 'MEMBER' }),
  ]);
  assert.match(r.stdout, /^Runs recorded: 1 /m);
  assert.doesNotMatch(r.stdout, /Scenario 2 has no code/, 'the texts only with --list');
});

test('--since keeps the comments created from that day', () => {
  const r = report([comment(1, marker(), { created_at: '2026-02-01T00:00:00Z' }), comment(2, marker())], '--since', '2026-03-01');
  assert.match(r.stdout, /since 2026-03-01\n/);
  assert.match(r.stdout, /^Runs recorded: 1 /m);
  assert.match(r.calls[0], /&since=2026-03-01T00%3A00%3A00Z$/);
});
