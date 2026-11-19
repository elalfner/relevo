import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIssueModels } from '../scripts/lib/issue-model.mjs';

test('both lines are read', () => {
  const r = parseIssueModels('## Summary\n\nsomething\n\nModel: haiku\nQA-model: sonnet\n');
  assert.deepEqual(r, { dev: 'haiku', qa: 'sonnet', problems: [] });
});

test('no line gives nothing and no problem', () => {
  assert.deepEqual(parseIssueModels('## Summary\n\nnothing about a model\n'), { dev: null, qa: null, problems: [] });
  assert.deepEqual(parseIssueModels(undefined), { dev: null, qa: null, problems: [] });
});

test('the key is read in any case, in a bullet, and QA-model is not read as Model', () => {
  const r = parseIssueModels('- model: opus\n* qa-MODEL: sonnet\n');
  assert.equal(r.dev, 'opus');
  assert.equal(r.qa, 'sonnet');
  assert.equal(parseIssueModels('QA-model: sonnet\n').dev, null, 'a QA-model line is not the developer line');
});

test('a repeated line - the first wins and the plan is told', () => {
  const r = parseIssueModels('Model: haiku\nModel: opus\n');
  assert.equal(r.dev, 'haiku');
  assert.match(r.problems.join('|'), /Model: appears more than once/);
});

test('a value with spaces or nothing is ignored with the reason', () => {
  const spaced = parseIssueModels('Model: the strongest one\n');
  assert.equal(spaced.dev, null);
  assert.match(spaced.problems[0], /single model name/);
  assert.equal(parseIssueModels('Model:\n').dev, null);
  assert.equal(parseIssueModels('QA-model: a b\n').qa, null);
});

test('a line inside a fenced code block is an example, not a request', () => {
  const body = 'Text\n\n```\nModel: opus\nQA-model: opus\n```\n\nModel: haiku\n';
  const r = parseIssueModels(body);
  assert.equal(r.dev, 'haiku');
  assert.equal(r.qa, null);
});

test('a full identifier is a name', () => {
  assert.equal(parseIssueModels('Model: claude-sonnet-5-5\n').dev, 'claude-sonnet-5-5');
});
