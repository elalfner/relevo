import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

// Claude Code ignores unknown frontmatter fields without any warning, so a typo
// would silently disable a setting. These tests pin the field names we rely on.
const KNOWN_FIELDS = new Set([
  'name', 'description', 'tools', 'disallowedTools', 'model', 'effort', 'maxTurns', 'permissionMode',
  'skills', 'mcpServers', 'hooks', 'memory', 'background', 'omitClaudeMd', 'isolation', 'color', 'initialPrompt', 'experimental',
]);
const EFFORT = ['low', 'medium', 'high', 'xhigh', 'max'];

function load(name) {
  const text = readFileSync(new URL(`../agents/${name}.md`, import.meta.url), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, `${name}.md must start with YAML frontmatter`);
  return { meta: parse(m[1]), body: m[2] };
}

for (const name of ['dev', 'qa']) {
  test(`${name}: frontmatter uses only documented fields and sane values`, () => {
    const { meta } = load(name);
    Object.keys(meta).forEach((k) => assert.ok(KNOWN_FIELDS.has(k), `unknown frontmatter field "${k}"`));
    assert.equal(meta.name, name);
    assert.ok(String(meta.description).length >= 80, 'description must say when to use the agent');
    assert.equal(meta.model, 'sonnet');
    assert.ok(EFFORT.includes(meta.effort));
  });

  test(`${name}: plugin agents must not rely on fields that are ignored for plugins`, () => {
    const { meta } = load(name);
    ['hooks', 'mcpServers', 'permissionMode'].forEach((k) => assert.ok(!(k in meta), `${k} is ignored for plugin agents`));
  });
}

test('qa is read-only: it cannot write or edit files', () => {
  const { meta } = load('qa');
  const denied = String(meta.disallowedTools).split(',').map((s) => s.trim());
  ['Write', 'Edit', 'NotebookEdit'].forEach((t) => assert.ok(denied.includes(t), `qa must disallow ${t}`));
  assert.ok(!('tools' in meta), 'qa must not restrict tools with an allow-list: it needs the tooling server tools');
});

test('qa output contract: first line is QA PASSED or QA REJECTED', () => {
  const { body } = load('qa');
  assert.match(body, /first line is exactly\*\* `QA PASSED` or `QA REJECTED`/);
});

test('qa never passes code it could not check (spec: Validation tooling missing)', () => {
  const { body } = load('qa');
  assert.match(body, /automated validation could not run/);
  assert.match(body, /Never pass code you could not check/);
});

test('qa defers device-only scenarios to on-device review (spec: Device-only scenario)', () => {
  const { body } = load('qa');
  assert.match(body, /left for on-device review/);
});

test('qa checks tasks, scenarios and project rules read from the rules file', () => {
  const { body } = load('qa');
  assert.match(body, /\[x\]/);
  assert.match(body, /qa\.rules_from/);
  assert.match(body, /Never assume a rule from memory/);
});

test('dev never commits, never edits the specification and never automates the device', () => {
  const { body } = load('dev');
  assert.match(body, /run `git commit`, `git push`, `git add`/);
  assert.match(body, /edit anything under `openspec\/` other than the checkboxes in `tasks\.md`/);
  assert.match(body, /automate the app or the device/);
});

test('dev stops on an ambiguous specification instead of guessing', () => {
  const { body } = load('dev');
  assert.match(body, /stop and report what is unclear/);
});

test('both agents prefer the Dart tooling server and fall back to the terminal', () => {
  ['dev', 'qa'].forEach((n) => {
    const { body } = load(n);
    assert.match(body, /Dart tooling server/);
    assert.match(body, /flutter analyze --no-pub/);
  });
});

test('neither agent mentions private sources or personal data', () => {
  ['dev', 'qa'].forEach((n) => {
    const text = readFileSync(new URL(`../agents/${n}.md`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /claude\.ai|session_[0-9A-Za-z]{6}|co-authored/i);
  });
});
