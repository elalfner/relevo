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
  assert.match(meta.description, /never commits/);
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

test('Scenario: Summary not confirmed - nothing is written before a clear yes', () => {
  assert.ok(body.indexOf('## 3. Agree') < body.indexOf('openspec new change'));
  assert.match(body, /Do not write the change before a clear yes/);
});

test('the change is written with the OpenSpec command line and validated', () => {
  ['openspec new change', 'openspec status --change', 'openspec instructions', 'openspec validate'].forEach((c) => assert.ok(body.includes(c), `missing ${c}`));
});

test('Scenario: Unknown answer - it is an open question, never invented behaviour', () => {
  assert.match(body, /open question/i);
  assert.match(body, /Do not invent answers/);
});

test('think never commits, pushes, creates issues or labels, and points to create', () => {
  assert.match(body, /Never commit, push, create issues or apply labels/);
  assert.ok(!/gh issue create|git push|git commit|--add-label/.test(body.replace(/Never commit, push, create issues or apply labels\./, '')), 'think must not run those commands');
  assert.match(body, /\/relevo:create/);
  assert.ok(existsSync(root('skills/create/SKILL.md')));
});
