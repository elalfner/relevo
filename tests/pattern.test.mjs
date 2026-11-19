import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOSE_WINDOW_MS, MAX_DIFF_BYTES, findPatternChange, patternFinding, renderDiff } from '../scripts/lib/pattern.mjs';

// A fake of `gh api <path>` that answers from a table of paths; a missing path fails like a 404.
function fakeGh(table) {
  return (args) => {
    const path = args[args.length - 1];
    if (!(path in table)) throw Object.assign(new Error('gh: Not Found (HTTP 404)'), { stderr: 'Not Found (HTTP 404)' });
    const value = table[path];
    if (value instanceof Error) throw value;
    return JSON.stringify(args.includes('--slurp') ? [value] : value);
  };
}
const R = 'acme/app';
const closedIssue = { number: 12, state: 'closed', closed_at: '2026-11-01T10:00:00Z' };
const crossRef = (n, merged = true) => ({ event: 'cross-referenced', source: { issue: { number: n, pull_request: { merged_at: merged ? '2026-11-01T10:00:00Z' : null } } } });
const pull = (extra = {}) => ({ merged_at: '2026-11-01T10:00:05Z', base: { ref: 'dev' }, merge_commit_sha: 'abc123', ...extra });
const files = [{ filename: 'src/a.vue', patch: '@@ +1 @@\n+<a/>' }, { filename: 'img.png' }];
const happy = {
  [`repos/${R}/issues/12`]: closedIssue,
  [`repos/${R}/issues/12/timeline?per_page=100`]: [crossRef(30), { event: 'labeled' }],
  [`repos/${R}/pulls/30`]: pull(),
  [`repos/${R}/pulls/30/files?per_page=100`]: files,
};
const find = (table, extra = {}) => findPatternChange({ repo: R, number: 12, base: 'dev', gh: fakeGh(table), ...extra });

test('Scenario: The pattern is merged - the files and the diff of the change are found', () => {
  const r = find(happy);
  assert.equal(r.state, 'merged');
  assert.equal(r.pr, 30);
  assert.equal(r.sha, 'abc123');
  assert.deepEqual(r.files, ['src/a.vue', 'img.png']);
  assert.match(r.diff, /--- src\/a\.vue\n@@ \+1 @@/);
  assert.match(r.diff, /no text diff/);
  assert.equal(patternFinding(12, r), null);
});

test('Scenario: The pattern is not merged - still open, or closed with no merged pull request, or merged elsewhere', () => {
  assert.equal(find({ ...happy, [`repos/${R}/issues/12`]: { number: 12, state: 'open' } }).state, 'not-merged');
  assert.equal(find({ ...happy, [`repos/${R}/issues/12/timeline?per_page=100`]: [crossRef(30, false)] }).state, 'not-merged');
  assert.equal(find({ ...happy, [`repos/${R}/pulls/30`]: pull({ base: { ref: 'other' } }) }).state, 'not-merged');
  const late = pull({ merged_at: new Date(Date.parse(closedIssue.closed_at) + CLOSE_WINDOW_MS + 60000).toISOString() });
  assert.equal(find({ ...happy, [`repos/${R}/pulls/30`]: late }).state, 'not-merged');
  const r = find({ ...happy, [`repos/${R}/issues/12`]: { number: 12, state: 'open' } });
  assert.deepEqual(patternFinding(12, r), { kind: 'input', input_kind: 'pattern', name: '#12', detail: 'the change of the pattern is not merged yet' });
});

test('Scenario: The pattern does not exist - a 404 or a pull request', () => {
  const r = find({});
  assert.equal(r.state, 'missing');
  assert.equal(patternFinding(12, r).detail, 'the pattern issue does not exist');
  assert.equal(find({ ...happy, [`repos/${R}/issues/12`]: { number: 12, state: 'closed', pull_request: {} } }).state, 'missing');
});

test('Scenario: The lookup fails - the state is unknown and never a finding', () => {
  const r = find({ [`repos/${R}/issues/12`]: new Error('network down') });
  assert.equal(r.state, 'unknown');
  assert.equal(patternFinding(12, r), null);
  assert.equal(find({ ...happy, [`repos/${R}/pulls/30/files?per_page=100`]: new Error('boom') }).state, 'unknown');
});

test('the diff is capped and says so', () => {
  const big = [{ filename: 'a', patch: 'x'.repeat(MAX_DIFF_BYTES) }, { filename: 'b', patch: 'y' }];
  const r = renderDiff(big);
  assert.equal(r.truncated, true);
  assert.equal(r.diff, '');
  assert.equal(renderDiff([{ filename: 'a', patch: 'x' }]).truncated, false);
});

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../scripts/pattern-check.mjs', import.meta.url).pathname;
const runCli = (body, extra = []) => {
  const file = join(mkdtempSync(join(tmpdir(), 'pat-')), 'issue.md');
  writeFileSync(file, body);
  const r = spawnSync('node', [CLI, '--issue-file', file, '--repo', R, '--base', 'dev', ...extra], { encoding: 'utf8' });
  return { status: r.status, out: JSON.parse(r.stdout) };
};

test('the command: no Pattern: line is state none, a wrong line or the issue itself exits 1', () => {
  assert.deepEqual([runCli('nothing').status, runCli('nothing').out.state], [0, 'none']);
  assert.deepEqual([runCli('Pattern: #3, #4').status, runCli('Pattern: #3, #4').out.state], [1, 'invalid']);
  const self = runCli('Pattern: #5', ['--issue', '5']);
  assert.equal(self.status, 1);
  assert.match(self.out.detail, /the issue itself/);
});
