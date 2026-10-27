import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planReviewEvent } from '../scripts/lib/review-events.mjs';
import { renderMessage } from '../scripts/lib/messages.mjs';
import { loadConfig } from '../scripts/lib/config.mjs';

const root = new URL('../', import.meta.url).pathname;
const tpl = readFileSync(`${root}templates/relevo.yml`, 'utf8');
const { config } = loadConfig(tpl);
const pr = { number: 40, url: 'https://x/pull/40', author: 'ana' };
const issue = (labels) => ({ number: 12, labels });
const review = (state, extra = {}) => ({ kind: 'review', state, reviewer: 'beto', body: 'Rename the field', url: 'https://x/pull/40#r1', ...extra });

test('Scenario: Changes requested - the issue is labelled and the author is mentioned with the summary', () => {
  const d = planReviewEvent({ config, event: review('changes_requested'), pr, issue: issue(['relevo:pr-open']) });
  assert.deepEqual(d.labels, { add: ['relevo:changes-requested'], remove: ['relevo:pr-open'] });
  assert.equal(d.comment.kind, 'changes_requested');
  const text = renderMessage(d.comment.kind, d.comment.data);
  assert.match(text, /@ana/);
  assert.match(text, /Rename the field/);
  assert.match(text, /\/relevo:fix 12/);
});

test('an empty review body still gives a summary', () => {
  const d = planReviewEvent({ config, event: review('changes_requested', { body: '  ' }), pr, issue: issue(['relevo:pr-open']) });
  assert.ok(d.comment.data.summary.length > 0);
});

test('a push after changes were requested returns the issue to pr-open, silently', () => {
  const d = planReviewEvent({ config, event: { kind: 'push' }, pr, issue: issue(['relevo:changes-requested']) });
  assert.deepEqual(d.labels, { add: ['relevo:pr-open'], remove: ['relevo:changes-requested'] });
  assert.equal(d.comment, null);
  assert.equal(planReviewEvent({ config, event: { kind: 'push' }, pr, issue: issue(['relevo:pr-open']) }), null);
});

test('Scenario: Approval - the issue stays pr-open and the approver (merger: approver) is mentioned', () => {
  const d = planReviewEvent({ config, event: review('approved'), pr, issue: issue(['relevo:pr-open']) });
  assert.deepEqual(d.labels, { add: [], remove: [] });
  assert.equal(d.comment.data.recipient, 'beto');
  assert.match(renderMessage(d.comment.kind, d.comment.data), /\/relevo:ship 12/);
});

test('Scenario: Approval - with the ship workflow installed, the label is named next to the command', () => {
  const d = planReviewEvent({ config, event: review('approved'), pr, issue: issue(['relevo:pr-open']), shipWorkflow: true });
  assert.equal(d.comment.data.ship_label, 'relevo:ship');
  const text = renderMessage(d.comment.kind, d.comment.data);
  assert.match(text, /\/relevo:ship 12/);
  assert.match(text, /Or apply the label relevo:ship/);
  const without = planReviewEvent({ config, event: review('approved'), pr, issue: issue(['relevo:pr-open']) });
  assert.equal(without.comment.data.ship_label, undefined);
});

test('with merger: author the author is told to run ship', () => {
  const c = { ...config, review: { ...config.review, merger: 'author' } };
  const d = planReviewEvent({ config: c, event: review('approved'), pr, issue: issue(['relevo:pr-open']) });
  assert.equal(d.comment.data.recipient, 'ana');
});

test('plain comments, the author\'s own reviews and review.mode none change nothing', () => {
  assert.equal(planReviewEvent({ config, event: review('commented'), pr, issue: issue(['relevo:pr-open']) }), null);
  assert.equal(planReviewEvent({ config, event: review('approved', { reviewer: 'ana' }), pr, issue: issue(['relevo:pr-open']) }), null);
  const solo = { ...config, review: { ...config.review, mode: 'none' } };
  assert.equal(planReviewEvent({ config: solo, event: review('changes_requested'), pr, issue: issue(['relevo:pr-open']) }), null);
});

test('reviews on issues that are not in review are ignored', () => {
  assert.equal(planReviewEvent({ config, event: review('changes_requested'), pr, issue: issue(['relevo:built']) }), null);
});

test('the review workflow never checks out or runs the pull request code', () => {
  const wf = readFileSync(`${root}templates/workflows/relevo-review.yml`, 'utf8');
  assert.match(wf, /pull_request_review:/);
  assert.match(wf, /types: \[synchronize\]/);
  assert.doesNotMatch(wf, /pull_request_target/);
  assert.match(wf, /ref: \$\{\{ github\.event\.pull_request\.base\.ref \}\}/);
  assert.doesNotMatch(wf, /head\.sha/);
});
