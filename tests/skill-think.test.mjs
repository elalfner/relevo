import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const text = readFileSync(root('skills/think/SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const meta = parse(front);

const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields and Claude never starts it on its own', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'think');
  assert.equal(meta['argument-hint'], '[idea]');
  assert.equal(meta['disable-model-invocation'], true);
  assert.match(meta.description, /writes nothing by default/);
  assert.ok(String(meta.description).length <= 1536);
});

test('Scenario: A decision opens new questions - rounds follow the frontier', () => {
  assert.match(body, /tree of decisions/);
  assert.match(body, /frontier/);
  assert.match(body, /Ask the whole frontier in one round/);
  assert.match(body, /belongs to a later round/);
  assert.match(body, /Recommended:/);
});

test('Scenario: A question needs a fact from the code - facts are looked up, decisions are asked', () => {
  assert.match(body, /Finding facts is your job/);
  assert.match(body, /subagent/);
});

test('Scenario: Idea still vague - it explores before it interviews', () => {
  assert.ok(body.indexOf('## 2. Explore') < body.indexOf('## 3. Interview in rounds'));
  assert.match(body, /thinking partner/);
  assert.match(body, /plain ASCII/);
});

test('Scenario: Unknown answer - it is an open question, never invented behaviour', () => {
  assert.match(body, /Do not invent answers/);
  assert.match(body, /open questions/);
  assert.match(body, /Silence is not acceptance/);
});

test('Scenario: Keeping the agreement - a file is written only when asked, after a yes or no question', () => {
  assert.match(body, /Only if the person asks to keep the agreement/);
  assert.match(body, /direct yes\/no question/);
  assert.match(body, /Never write a file the person did not ask for/);
});

test('it does not write an OpenSpec change itself any more', () => {
  assert.ok(!/openspec (new|instructions|archive)/.test(body));
});

test('think never commits, pushes, creates issues or labels, and points to create', () => {
  assert.match(body, /Never write code, commit, push, create issues or apply labels/);
  assert.ok(!/gh issue create|git push|git commit|--add-label/.test(body.replace(/Never write code, commit, push, create issues or apply labels\./, '')), 'think must not run those commands');
  assert.match(body, /\/relevo:create/);
  assert.ok(existsSync(root('skills/create/SKILL.md')));
});
