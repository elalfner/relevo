import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';
import { LABEL_KEYS } from '../scripts/lib/labels.mjs';
import { MESSAGE_KINDS } from '../scripts/lib/messages.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const text = readFileSync(root('skills/go/SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const meta = parse(front);

// Claude Code ignores unknown skill fields silently, so a typo would disable a setting unnoticed.
const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'go');
  assert.equal(meta['argument-hint'], '[issue-number]');
});

test('go pushes code and spends money, so Claude can never start it on its own', () => {
  assert.equal(meta['disable-model-invocation'], true);
  assert.match(meta.description, /never starts on its own/);
  assert.ok(String(meta.description).length <= 1536);
});

test('every script the skill runs exists', () => {
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 5);
  new Set(scripts).forEach((s) => assert.ok(existsSync(root(`scripts/${s}`)), `scripts/${s} is referenced but does not exist`));
});

test('every agent the skill launches exists', () => {
  const agents = [...body.matchAll(/`relevo:(\w+)`/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(agents)].sort(), ['dev', 'qa']);
  new Set(agents).forEach((a) => assert.ok(existsSync(root(`agents/${a}.md`)), `agents/${a}.md is missing`));
});

test('every go-plan flag the skill uses is implemented', () => {
  const source = readFileSync(root('scripts/go-plan.mjs'), 'utf8');
  const used = [...body.matchAll(/go-plan\.mjs([^\n`]*)/g)].flatMap((m) => [...m[1].matchAll(/--([a-z]+)/g)].map((f) => f[1]));
  assert.ok(used.includes('claim') && used.includes('only') && used.includes('apply'));
  new Set(used).forEach((f) => assert.ok(source.includes(`'${f}'`) || source.includes(`--${f}`), `go-plan does not implement --${f}`));
});

test('every label the skill moves an issue to is a real label key', () => {
  const keys = [...body.matchAll(/label-change\.mjs --to ([\w-]+)/g)].map((m) => m[1]);
  assert.ok(keys.includes('qa-failed') && keys.includes('built') && keys.includes('needs-spec'));
  new Set(keys).forEach((k) => assert.ok(LABEL_KEYS.includes(k), `"${k}" is not a label key`));
});

test('every message the skill renders is a real message kind', () => {
  const kinds = [...body.matchAll(/render-message\.mjs (\w+)/g)].map((m) => m[1]);
  assert.ok(kinds.includes('qa_failed') && kinds.includes('built') && kinds.includes('needs_spec'));
  new Set(kinds).forEach((k) => assert.ok(MESSAGE_KINDS.includes(k), `"${k}" is not a message kind`));
});

test('safety rules are stated', () => {
  assert.match(body, /never approve, merge or open a pull request/);
  assert.match(body, /never force-push/i);
  assert.match(body, /Do not push/);
  assert.match(body, /Never use `git add \.` or `-A`/);
  assert.match(body, /Do not add links to this session or attribution lines/);
  assert.match(body, /Nobody will answer questions/);
});

test('it uses the OpenSpec command line instead of the interactive propose workflow', () => {
  assert.match(body, /openspec new change/);
  assert.match(body, /openspec instructions/);
  assert.match(body, /openspec validate/);
  assert.match(body, /without the pauses of the interactive `propose` workflow/);
});

test('it points at the issue format document, which exists', () => {
  assert.ok(existsSync(root('docs/issue-format.md')));
});

test('the skill mentions neither private sources nor personal data', () => {
  assert.doesNotMatch(text, /claude\.ai|session_[0-9A-Za-z]{6}|co-authored/i);
});
