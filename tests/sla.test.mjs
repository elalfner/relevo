import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planSla, slaCommands, MARKERS } from '../scripts/lib/sla.mjs';
import { issueFromBranch } from '../scripts/lib/branch.mjs';
import { loadConfig } from '../scripts/lib/config.mjs';

const root = new URL('../', import.meta.url).pathname;
const { config } = loadConfig(readFileSync(`${root}templates/relevo.yml`, 'utf8').replace('spec_writer: null', 'spec_writer: luz'));
const NOW = new Date('2026-03-10T20:00:00Z');
const ago = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();
const pr = (extra) => ({ number: 40, issue: 12, url: 'https://x/pull/40', reviewer: 'beto', requested_at: ago(9), reviewed: false, reminded: false, escalated: false, labels: ['relevo:pr-open'], ...extra });

test('Scenario: Peer does not review - one reminder after the SLA', () => {
  const [d] = planSla({ config, prs: [pr()], now: NOW });
  assert.equal(d.action, 'remind');
  assert.equal(d.comment.kind, 'review_reminder');
  assert.deepEqual(d.labels.add, []);
  assert.deepEqual(planSla({ config, prs: [pr({ reminded: true })], now: NOW }), []);
});

test('nothing happens before the SLA or once a review exists', () => {
  assert.deepEqual(planSla({ config, prs: [pr({ requested_at: ago(7) })], now: NOW }), []);
  assert.deepEqual(planSla({ config, prs: [pr({ reviewed: true })], now: NOW }), []);
});

test('Scenario: Review is overdue - after a second period the spec writer is mentioned and needs-reviewer is added', () => {
  const [d] = planSla({ config, prs: [pr({ requested_at: ago(17), reminded: true })], now: NOW });
  assert.equal(d.action, 'escalate');
  assert.deepEqual(d.labels.add, ['relevo:needs-reviewer']);
  assert.equal(d.comment.data.spec_writer, 'luz');
  assert.deepEqual(planSla({ config, prs: [pr({ requested_at: ago(30), escalated: true })], now: NOW }), []);
});

test('an escalation does not add the label twice and still says who is waiting', () => {
  const [d] = planSla({ config, prs: [pr({ requested_at: ago(20), labels: ['relevo:pr-open', 'relevo:needs-reviewer'] })], now: NOW });
  assert.deepEqual(d.labels.add, []);
});

test('commands carry a marker so the message is sent once', () => {
  const [d] = planSla({ config, prs: [pr()], now: NOW });
  const [cmd] = slaCommands(d, { repo: 'o/r', config });
  assert.deepEqual(cmd.slice(0, 3), ['issue', 'comment', '40']);
  assert.ok(cmd[cmd.length - 1].endsWith(MARKERS.review_reminder));
});

test('the issue number comes from the feature branch', () => {
  assert.equal(issueFromBranch('feature/12-add-total'), 12);
  assert.equal(issueFromBranch('main'), null);
});

test('the SLA workflow runs on a schedule and writes only comments and labels', () => {
  const wf = readFileSync(`${root}templates/workflows/relevo-sla.yml`, 'utf8');
  assert.match(wf, /schedule:/);
  assert.match(wf, /contents: read/);
  assert.match(wf, /review-sla\.mjs/);
});
