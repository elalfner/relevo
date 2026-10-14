import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const text = readFileSync(root('skills/ship/SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const meta = parse(front);

const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields; Claude can never start it on its own', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'ship');
  assert.equal(meta['argument-hint'], '[issue-number]');
  assert.equal(meta['disable-model-invocation'], true);
  assert.match(meta.description, /never starts on its own/);
  assert.ok(String(meta.description).length <= 1536);
});

test('every script the skill runs exists', () => {
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  ['ship-check.mjs', 'check-archive.mjs', 'scan-diff.mjs', 'stage.mjs', 'label-change.mjs', 'validate-config.mjs'].forEach((s) => assert.ok(scripts.includes(s), `the skill never uses ${s}`));
  new Set(scripts).forEach((s) => assert.ok(existsSync(root(`scripts/${s}`)), `scripts/${s} is referenced but does not exist`));
});

test('the order is: check, confirm in writing, archive, check again, merge, close out', () => {
  const at = (needle) => {
    const i = body.indexOf(needle);
    assert.ok(i >= 0, `missing: ${needle}`);
    return i;
  };
  const order = [
    at('### 1. Check that it qualifies'),
    at('### 2. Confirm, in writing'),
    at('openspec archive "<change folder name>" -y'),
    at('### 4. Check again'),
    at('gh pr merge <number>'),
    at('### 6. Close out'),
  ];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('nothing is archived, pushed or merged before the person confirms', () => {
  assert.match(body, /Never merge, archive or push anything before the person's written confirmation/);
  assert.match(body, /\*\*stop: nothing is archived, pushed or merged\.\*\*/);
  assert.match(body, /Wait for a clear written yes/);
});

test('it never approves and never bypasses a rule', () => {
  assert.match(body, /Never approve a pull request/);
  assert.match(body, /no `--admin`/);
  assert.match(body, /no merging while `ship-check` says to stop/);
  assert.doesNotMatch(body.replace(/no `--admin`[^.]*\./, ''), /gh pr merge[^\n]*--admin/);
  assert.doesNotMatch(body, /gh pr review/);
});

test('the merge is a squash with a clean message that deletes the branch', () => {
  assert.match(body, /gh pr merge <number> --repo <owner\/name> --squash --delete-branch --subject/);
  assert.match(body, /--body "Issue #\$ARGUMENTS"/);
  assert.match(body, /no list of commits, no links, no attribution lines/);
});

test('it closes the issue explicitly, because the base branch is usually not the default', () => {
  assert.match(body, /gh issue close \$ARGUMENTS --reason completed/);
  assert.match(body, /only closes an issue by itself when the merge goes into the repository's default branch/);
  assert.match(body, /label-change\.mjs --clear/);
});

test('the archive may only touch the specifications folder, and is checked before it is committed', () => {
  const check = body.indexOf('check-archive.mjs');
  const commit = body.indexOf('git commit -m "chore(openspec): archive');
  assert.ok(check > 0 && commit > check, 'the archive check must come before the commit');
  assert.match(body, /changed anything outside `openspec\/`, or changed nothing/);
});

test('it handles approvals dismissed by the archive push, and reminds that releasing is separate', () => {
  assert.match(body, /an approval dismissed by the push/);
  assert.match(body, /promoting `<base>` to `<release>` is a separate pull request/);
});

test('the skill mentions neither private sources nor personal data', () => {
  assert.doesNotMatch(text, /claude\.ai|session_[0-9A-Za-z]{6}|co-authored/i);
});
