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
  assert.match(meta.description, /openspec-explore/);
  assert.match(meta.description, /grill-with-docs/);
  assert.ok(String(meta.description).length <= 1536);
});

test('Scenario: Shape of the idea is clear - it runs openspec-explore and then grill-with-docs', () => {
  assert.ok(body.indexOf('## 2. Explore') < body.indexOf('## 3. Grill'));
  assert.match(body, /Invoke the `openspec-explore` skill with the Skill tool/);
  assert.match(body, /Invoke the `grill-with-docs` skill with the Skill tool in the same conversation/);
});

test('Scenario: Idea still vague - it stays in the exploration', () => {
  assert.match(body, /Stay in it while the idea is still shapeless/);
});

test('it does not restate the rules of the skills it runs', () => {
  assert.match(body, /do not restate them, shorten them or override them/);
  assert.ok(!/frontier|tree of decisions|Recommended:/.test(body), 'the interview rules belong to grill-with-docs');
  assert.ok(!/GLOSSARY\.md|docs\/adr/.test(body.replace(/\(glossary, decision records, OpenSpec artifacts\)/, '')), 'the language rules belong to grill-with-docs');
});

test('Scenario: A skill is not installed - it stops and shows how to install them', () => {
  assert.ok(body.indexOf('## 1. Check the skills first') < body.indexOf('## 2. Explore'));
  for (const name of ['openspec-explore', 'grill-with-docs', 'grilling', 'domain-modeling']) {
    assert.ok(body.includes(`\`${name}\``), `${name} must be named`);
  }
  assert.match(body, /If any is missing, stop/);
  assert.match(body, /npx skills add mattpocock\/skills/);
  assert.match(body, /openspec init/);
  assert.match(body, /Never continue when a required skill is missing/);
});

test('it does not bundle or copy the skills', () => {
  assert.match(body, /Never copy a skill's content into the repository/);
  assert.ok(!existsSync(root('skills/grill-with-docs')) && !existsSync(root('skills/openspec-explore')));
});

test('Scenario: Invoked skill suggests another next step - it points to create', () => {
  assert.match(body, /whatever next step those skills suggested themselves/);
  assert.match(body, /\/opsx:propose/);
  assert.match(body, /\/relevo:create/);
  assert.ok(existsSync(root('skills/create/SKILL.md')));
});

test('Scenario: Keeping the agreement - the agreement file is written only on request', () => {
  assert.match(body, /Only if the person asks to keep the agreement/);
  assert.match(body, /agreement file only on request/);
});

test('Scenario: Hand-off - documentation is never committed and the files are named', () => {
  assert.match(body, /Name the documentation files the session created or changed/);
  assert.match(body, /not committed/);
});

test('think never builds, commits, pushes, creates issues or labels, and does not write an OpenSpec change itself', () => {
  assert.match(body, /Never write code, commit, push, create issues or apply labels/);
  assert.match(body, /Never run `openspec new change`/);
  const rest = body.replace(/Never write code, commit, push, create issues or apply labels\./g, '').replace(/Never run `openspec new change`[^\n]*/, '');
  assert.ok(!/gh issue create|git push|git commit|--add-label|openspec (new|instructions|archive)/.test(rest), 'think must not run those commands');
});
