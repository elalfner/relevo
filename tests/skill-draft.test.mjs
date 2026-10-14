import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const text = readFileSync(root('skills/draft/SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const meta = parse(front);

const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields and Claude never starts it on its own', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'draft');
  assert.equal(meta['argument-hint'], '[what to build]');
  assert.equal(meta['disable-model-invocation'], true);
  assert.match(meta.description, /never applies the ready label/);
  assert.ok(String(meta.description).length <= 1536);
});

test('every script, template and document it points at exists', () => {
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  assert.ok(scripts.includes('check-issue.mjs'));
  scripts.forEach((s) => assert.ok(existsSync(root(`scripts/${s}`)), `scripts/${s} does not exist`));
  [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/((?:templates|docs)\/[\w.-]+)/g)].forEach((m) => assert.ok(existsSync(root(m[1])), `${m[1]} does not exist`));
});

test('Scenario: Issues created - the skill never applies a lifecycle label and creates only after approval', () => {
  assert.match(body, /Do \*\*not\*\* add the `ready` label/);
  assert.match(body, /Never apply `ready`/);
  assert.match(body, /Create nothing before a clear yes/);
  assert.ok(!/gh issue edit|--add-label|--label/.test(body), 'the skill must not add labels');
});

test('the check comes before creation, and creation is in dependency order', () => {
  assert.ok(body.indexOf('check-issue.mjs') < body.indexOf('gh issue create'));
  assert.match(body, /in dependency order/);
  assert.match(body, /Create nothing while any draft fails/);
});

test('the keywords go reads are kept in English and the language setting is honoured', () => {
  assert.match(body, /Keep the keywords `WHEN`, `THEN`, `Edge cases` and `Depends-on`/);
  assert.match(body, /`language` in `relevo.yml`/);
});

test('it carries nothing from any private origin', () => {
  assert.ok(!/jira|atlassian|funcionario|FUN-\d+/i.test(`${text}${readFileSync(root('templates/issue.md'), 'utf8')}`));
});
