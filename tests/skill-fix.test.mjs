import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';
import { MESSAGE_KINDS } from '../scripts/lib/messages.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const text = readFileSync(root('skills/fix/SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const meta = parse(front);

const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields; Claude can never start it on its own', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'fix');
  assert.equal(meta['argument-hint'], '[issue-number] [what is wrong]');
  assert.equal(meta['disable-model-invocation'], true);
  assert.match(meta.description, /never starts on its own/);
  assert.ok(String(meta.description).length <= 1536);
});

test('every script the skill runs exists', () => {
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  ['fix-state.mjs', 'add-corrections.mjs', 'fix-guard.mjs', 'commit-change.mjs', 'platform-of.mjs', 'stack-profile.mjs', 'role-skills.mjs', 'render-message.mjs', 'review-state.mjs'].forEach((s) => assert.ok(scripts.includes(s), `the skill never uses ${s}`));
  new Set(scripts).forEach((s) => assert.ok(existsSync(root(`scripts/${s}`)), `scripts/${s} is referenced but does not exist`));
});

test('the agents it launches exist and are launched in the right modes', () => {
  [...new Set([...body.matchAll(/`relevo:(\w+)`/g)].map((m) => m[1]))].forEach((a) => assert.ok(existsSync(root(`agents/${a}.md`)), `agents/${a}.md is missing`));
  assert.match(body, /Launch the `relevo:dev` agent in \*\*build\*\* mode/);
  assert.match(body, /`relevo:dev` in \*\*fix\*\* mode with the complete QA report/);
});

test('the message it renders is a real kind, and the review-state command it uses is implemented', () => {
  assert.ok(MESSAGE_KINDS.includes('fix_done'));
  assert.match(body, /render-message\.mjs fix_done/);
  assert.match(body, /review-state\.mjs sync/);
  assert.ok(readFileSync(root('scripts/review-state.mjs'), 'utf8').includes("case 'sync'"));
});

test('the specification comes first, and a script checks it before the developer runs', () => {
  const guard = body.indexOf('fix-guard.mjs openspec/changes/<change>');
  const developer = body.indexOf('Launch the `relevo:dev` agent');
  assert.ok(guard > 0 && developer > guard, 'the guard must come before the developer');
  assert.match(body, /\*\*Do not launch the developer until it exits 0\.\*\*/);
  assert.match(body, /In this session you never write application code yourself/);
  assert.match(body, /Do not commit yet: the whole fix is committed together once QA passes/);
});

test('safety rules are stated', () => {
  assert.match(body, /Never change the project rules file/);
  assert.match(body, /make no commit and no push/);
  assert.match(body, /Never approve, merge or open a pull request, never use `git add \.` or `-A`, never force-push/);
  assert.match(body, /Do not add links to this session or attribution lines/);
});

test('the issue keeps its place: labels come from fix-state, and the reviewer is re-requested', () => {
  assert.match(body, /fix-state\.mjs --current/);
  assert.match(body, /gh pr edit <number> --add-reviewer <login>/);
  assert.match(body, /`qa-failed` issue to `built`, and a `changes-requested` one to `pr-open`/);
});

test('the review skill supports what fix relies on: retest and sync', () => {
  const review = readFileSync(root('skills/review/SKILL.md'), 'utf8');
  assert.match(review, /`retest <numbers>`/);
  assert.match(review, /review-state\.mjs sync/);
});

test('the skill mentions neither private sources nor personal data', () => {
  assert.doesNotMatch(text, /claude\.ai|session_[0-9A-Za-z]{6}|co-authored/i);
});

test('Scenario: Monorepo fix - the platform is found again from the issue, the agents get the profile and folder, the commit stays inside', () => {
  assert.match(body, /scripts\/platform-of\.mjs --issue <issue>/);
  assert.match(body, /scripts\/stack-profile\.mjs --platform <platform>/);
  assert.match(body, /scripts\/role-skills\.mjs --role fix --platform <platform>/);
  assert.match(body, /the resolved profile, the folder of the platform \(`path`\), the skill paths/);
  assert.match(body, /--within "<path>" --change "<change>"/);
  const wrapper = readFileSync(root('scripts/commit-change.mjs'), 'utf8');
  ['within', 'change', 'message'].forEach((f) => assert.ok(wrapper.includes(`'${f}'`), `commit-change does not implement --${f}`));
});

test('Scenario: Platform not resolvable - fix changes nothing and tells the person to correct the Platform line', () => {
  assert.match(body, /If `platform-of\.mjs` exits 1, change nothing more and tell the person what it printed/);
  assert.match(body, /correct the `Platform:` line and run `\/relevo:fix` again/);
});
