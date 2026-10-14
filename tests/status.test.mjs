import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStatus, renderDigest, renderStatus } from '../scripts/lib/status.mjs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

const root = new URL('../', import.meta.url).pathname;
const tpl = readFileSync(`${root}templates/relevo.yml`, 'utf8')
  .replace('members: []', 'members: [ana, beto, luz]').replace('spec_writer: null', 'spec_writer: luz');
const { config } = loadConfig(tpl);
const NOW = new Date('2026-03-10T12:00:00Z'); // a Tuesday
const issue = (number, labels, assignee = 'ana', milestone = 1) => ({ number, title: `Issue ${number}`, labels, assignees: assignee ? [assignee] : [], milestone });
const pr = (extra) => ({ number: 40, issue: 12, url: 'https://x/pull/40', author: 'ana', reviewer: 'beto', requested_at: '2026-03-10T00:00:00Z', approved: false, behind_by: 0, ...extra });

test('Scenario: Assignee view - built issues first with their command, then reviews, then what waits on others', () => {
  const r = buildStatus({
    config, me: 'ana', now: NOW,
    issues: [issue(1, ['relevo:built']), issue(2, ['relevo:pr-open']), issue(3, ['relevo:qa-failed'])],
    prs: [pr({ issue: 5, author: 'beto', reviewer: 'ana', number: 41 })],
  });
  assert.deepEqual(r.onMe.map((e) => e.command), ['/relevo:review 1', '/relevo:fix 3']);
  assert.equal(r.toReview[0].number, 5);
  assert.deepEqual(r.waitingOnOthers.map((e) => e.number), [2]);
  const text = renderStatus(r);
  assert.ok(text.indexOf('Waiting on you') < text.indexOf('Pull requests to review'));
  assert.ok(text.indexOf('Pull requests to review') < text.indexOf('Waiting on others'));
});

test('Scenario: Returned specs - needs-spec and blocked come before anything else for the spec writer', () => {
  const r = buildStatus({ config, me: 'luz', now: NOW, issues: [issue(1, ['relevo:needs-spec']), issue(2, ['relevo:blocked']), issue(3, ['relevo:pr-open', 'relevo:needs-reviewer'])] });
  assert.equal(r.view, 'spec-writer');
  assert.equal(r.specWriter.needsSpec[0].number, 1);
  assert.equal(r.specWriter.blocked[0].number, 2);
  assert.equal(r.specWriter.needsReviewer[0].number, 3);
  assert.ok(renderStatus(r).startsWith('Back with the spec writer'));
});

test('approved pull requests appear for whoever runs ship', () => {
  const approved = pr({ approved: true });
  assert.equal(buildStatus({ config, me: 'beto', now: NOW, issues: [], prs: [approved] }).toShip[0].command, '/relevo:ship 12');
  assert.equal(buildStatus({ config, me: 'ana', now: NOW, issues: [], prs: [approved] }).toShip.length, 0);
});

test('Scenario: Overloaded milestone - a capacity warning when the work exceeds what can be reviewed', () => {
  const issues = Array.from({ length: 6 }, (_, i) => issue(i + 1, ['relevo:queued']));
  const r = buildStatus({ config, me: 'ana', now: NOW, issues, milestones: [{ number: 1, title: 'M1', due_on: '2026-03-12T00:00:00Z', closed_issues: 2 }] });
  assert.equal(r.milestones[0].capacity.workingDays, 2);
  assert.equal(r.milestones[0].capacity.reviews, 4); // two reviewers (the spec writer does not review) x 2 days
  assert.equal(r.milestones[0].warning, true);
  assert.match(renderStatus(r), /capacity warning/);
});

test('Scenario: Milestone without a due date - no warning is computed and status says so', () => {
  const r = buildStatus({ config, me: 'ana', now: NOW, issues: [issue(1, ['relevo:queued'])], milestones: [{ number: 1, title: 'M1', due_on: null, closed_issues: 0 }] });
  assert.equal(r.milestones[0].warning, false);
  assert.match(renderStatus(r), /no due date/);
});

test('Scenario: Stale review - a pull request past the SLA is an alert with its age; far-behind branches too', () => {
  const r = buildStatus({ config, me: 'ana', now: NOW, issues: [], prs: [pr({ requested_at: '2026-03-09T20:00:00Z' }), pr({ number: 42, issue: 13, behind_by: 12, requested_at: '2026-03-10T10:00:00Z' })] });
  assert.deepEqual(r.alerts.map((a) => a.type), ['stale-review', 'stale-branch']);
  assert.equal(r.alerts[0].hours, 16);
});

test('Scenario: Daily digest - only who waits on what and the alerts; nothing when nothing is waiting', () => {
  assert.equal(renderDigest(buildStatus({ config, now: NOW, issues: [], prs: [] })), null);
  const text = renderDigest(buildStatus({ config, now: NOW, issues: [issue(1, ['relevo:built'])], prs: [] }));
  assert.match(text, /@ana: #1 \(built\)/);
  assert.doesNotMatch(text, /Milestone/);
});

test('the Spanish text uses the language of relevo.yml', () => {
  const { config: es } = loadConfig(tpl.replace('language: en', 'language: es'));
  assert.match(renderStatus(buildStatus({ config: es, me: 'ana', now: NOW, issues: [issue(1, ['relevo:built'])] }), es.language), /Esperando por ti/);
});

test('Scenario: Running status - the report is read-only and the skill runs nothing that writes', () => {
  assert.equal(buildStatus({ config, now: NOW, issues: [] }).readOnly, true);
  const text = readFileSync(`${root}skills/status/SKILL.md`, 'utf8');
  const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.equal(parse(front).name, 'status');
  assert.equal(parse(front)['disable-model-invocation'], undefined);
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(scripts)].sort(), ['status.mjs', 'validate-config.mjs']);
  scripts.forEach((s) => assert.ok(existsSync(`${root}scripts/${s}`)));
  assert.doesNotMatch(readFileSync(`${root}scripts/status.mjs`, 'utf8') + readFileSync(`${root}scripts/lib/status-data.mjs`, 'utf8'), /issue (edit|comment)|--add-label|'-X'|POST|PATCH/);
});

test('the scripts work from a state file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'status-'));
  writeFileSync(join(dir, 'relevo.yml'), tpl);
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ issues: [issue(1, ['relevo:built'])], prs: [], milestones: [] }));
  const s = spawnSync('node', [`${root}scripts/status.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json'), '--me', 'ana'], { encoding: 'utf8' });
  assert.equal(s.status, 0, s.stderr);
  assert.match(s.stdout, /\/relevo:review 1/);
  const d = spawnSync('node', [`${root}scripts/digest.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json'), '--now', '2026-03-10T12:00:00Z'], { encoding: 'utf8' });
  assert.equal(d.status, 0, d.stderr);
  assert.match(d.stdout, /@ana/);
  const weekend = spawnSync('node', [`${root}scripts/digest.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json'), '--now', '2026-03-14T12:00:00Z'], { encoding: 'utf8' });
  assert.equal(weekend.stdout, '');
});

test('the digest workflow runs on weekdays and posts through the script', () => {
  const wf = readFileSync(`${root}templates/workflows/relevo-digest.yml`, 'utf8');
  assert.match(wf, /cron: '\d+ \d+ \* \* 1-5'/);
  assert.match(wf, /digest\.mjs/);
  assert.match(wf, /contents: read/);
});

test('digest.issue is a validated optional setting', () => {
  assert.equal(config.digest.issue, null);
  assert.equal(loadConfig(tpl.replace('issue: null', 'issue: 7')).config.digest.issue, 7);
  assert.equal(loadConfig(tpl.replace('issue: null', 'issue: 0')).ok, false);
});
