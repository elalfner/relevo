import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';
import { LABEL_KEYS } from '../scripts/lib/labels.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const text = readFileSync(root('skills/review/SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const meta = parse(front);

const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields; the hint is quoted so YAML reads it as text', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'review');
  assert.equal(meta['argument-hint'], '[issue-number]');
  assert.equal(meta['disable-model-invocation'], true);
  assert.ok(String(meta.description).length <= 1536);
});

test('every script the skill runs exists', () => {
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 8);
  new Set(scripts).forEach((s) => assert.ok(existsSync(root(`scripts/${s}`)), `scripts/${s} is referenced but does not exist`));
});

test('every review-state subcommand the skill uses is implemented', () => {
  const source = readFileSync(root('scripts/review-state.mjs'), 'utf8');
  const used = [...body.matchAll(/review-state\.mjs (init|set|capture|audit|agree|decide|show)\b/g)].map((m) => m[1]);
  ['init', 'set', 'capture', 'audit', 'agree', 'decide'].forEach((c) => assert.ok(used.includes(c), `the skill never uses "${c}"`));
  new Set(used).forEach((c) => assert.ok(source.includes(`case '${c}'`), `review-state has no "${c}" command`));
});

test('every label and agent it uses is real', () => {
  const keys = [...body.matchAll(/label-change\.mjs --to ([\w-]+)/g)].map((m) => m[1]);
  assert.ok(keys.includes('in-review') && keys.includes('pr-open'));
  new Set(keys).forEach((k) => assert.ok(LABEL_KEYS.includes(k), `"${k}" is not a label key`));
  assert.ok(LABEL_KEYS.includes('needs-reviewer'));
  [...new Set([...body.matchAll(/`relevo:(\w+)`/g)].map((m) => m[1]))].forEach((a) => assert.ok(existsSync(root(`agents/${a}.md`)), `agents/${a}.md is missing`));
});

test('the only adb commands in the skill are devices, logcat and the screenshot script', () => {
  const lines = body.split('\n').filter((l) => /\badb\b/.test(l));
  assert.ok(lines.length > 0);
  lines.forEach((l) => {
    const prohibition = /never|must not|only .*adb|no `adb/i.test(l);
    const allowed = /logcat|devices|device\.mjs|capture\.mjs/.test(l);
    assert.ok(prohibition || allowed, `adb line is neither a prohibition nor an allowed command: ${l}`);
  });
  // Every code block line that runs adb must be a log command.
  const code = [...body.matchAll(/```[\w]*\n([\s\S]*?)```/g)].flatMap((m) => m[1].split('\n')).filter((l) => /\badb\b/.test(l));
  code.forEach((l) => assert.match(l, /logcat/, `adb in a code block must be a logcat command: ${l}`));
});

test('the observer rules are stated', () => {
  assert.match(body, /Never tap, swipe, type or press keys on the device/);
  assert.match(body, /Never send a message, make a call or press a send button in any other app/);
  assert.match(body, /Never open the screenshots/);
  assert.match(body, /Never patch code during the review/);
  assert.match(body, /Never commit the `evidence\/` folder, and never force-push/);
  assert.match(body, /\*\*Then end your turn\.\*\*/);
  assert.match(body, /Never go to step 5 without an explicit `done`/);
});

test('the pull request opens only when the script allows it, ready for review, with no images or session links', () => {
  assert.match(body, /Only when `decide` exited 0/);
  assert.match(body, /\*\*Do not open the pull request\.\*\*/);
  assert.match(body, /ready for review, not as a draft/);
  assert.match(body, /No images, no links to this session, no attribution lines/);
  assert.match(body, /Closes #\$ARGUMENTS/);
});

test('it admits it cannot attach images (spec: Screenshots attached by the person)', () => {
  assert.match(body, /GitHub has no API for attaching images, so you cannot upload them/);
  assert.match(body, /`evidence\.policy: local_only`: delete the `evidence\/` folder now/);
});

test('it synchronises with the base branch and re-runs QA when the merge changed something', () => {
  assert.match(body, /git merge --no-edit origin\/<base>/);
  assert.match(body, /git merge --abort/);
  assert.match(body, /launch the `relevo:qa` agent again/);
});

test('the skill mentions neither private sources nor personal data', () => {
  assert.doesNotMatch(text, /claude\.ai|session_[0-9A-Za-z]{6}|co-authored/i);
});

test('Scenario: Another app logs an error - the audit is limited to the app under review', () => {
  assert.match(body, /app-id\.mjs/);
  assert.match(body, /audit --package "\$package"/);
  assert.match(body, /ask the person to start the app, or restart it/i);
  assert.match(body, /may hold other apps' data/);
});
