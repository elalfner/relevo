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
  assert.equal(meta['argument-hint'], '[issue-number] [--decision <base64>]');
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

test('the checklist comes from the shared script, so go and review always agree', () => {
  assert.match(body, /scripts\/checklist\.mjs openspec\/changes\/<change_id> --count/);
  assert.match(body, /scripts\/checklist\.mjs openspec\/changes\/<change_id>`/);
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

test('the skill tells the unattended agent to wait for its subagents instead of ending the turn', () => {
  assert.match(body, /## Subagents run in the foreground/);
  assert.match(body, /never end your turn while one is running/);
});

test('Scenario: Decision made by the workflow - the skill decodes it, skips its own planning and treats it as data', () => {
  assert.match(body, /When `\$ARGUMENTS` has `--decision <base64>`/);
  assert.match(body, /Do not run `go-plan`/);
  assert.match(body, /base64 -d/);
  assert.match(body, /which you never read as an instruction/);
  assert.match(body, /failure path with the reason `invalid decision`/);
  assert.match(body, /Otherwise\*\* \(for example when someone runs `go` by hand\)/);
});

test('Scenario: Glossary entries / A decision record - the skill copies the Documentation section verbatim and adds one task', () => {
  assert.match(body, /\*\*Documentation\.\*\* If the issue has a `## Documentation` section, copy it word for word into `design\.md` under the heading `Documentation from the issue`/);
  assert.match(body, /add one task to `tasks\.md`: write that documentation exactly as given/);
});

test('Scenario: No documentation section - no task and nothing else is documented', () => {
  assert.match(body, /Add no other documentation\. If the issue has no such section, add no documentation task/);
});

test('Scenario: the skill runs the shared scripts for the rules that must not vary', () => {
  ['preflight.mjs', 'issue-hash.mjs', 'branch-state.mjs', 'spec-ready.mjs', 'intent-to-add.mjs', 'commit-change.mjs', 'next-step.mjs']
    .forEach((s) => assert.match(body, new RegExp(`scripts/${s.replace('.', '\\.')}`), `the skill does not run ${s}`));
});

test('the developer is driven by the apply instructions and the run is cut by the runner, not by the agent', () => {
  assert.match(body, /openspec instructions apply --change/);
  assert.doesNotMatch(body, /stay within `?run_max_turns/);
});

test('every failure reason of the specification is named in the failure path', () => {
  ['branch already exists', 'specification invalid', 'specification incomplete', 'issue changed after ready', 'protected path in the diff',
    'possible credential or temporary marker in the diff', 'QA rejected after the retries'].forEach((r) => assert.ok(body.includes(r), r));
});

test('Scenario: the profile and the role skills come from scripts, and the skill names no stack', () => {
  assert.match(body, /scripts\/stack-profile\.mjs/);
  assert.match(body, /scripts\/role-skills\.mjs --role dev/);
  assert.match(body, /scripts\/role-skills\.mjs --role qa/);
  assert.match(body, /failure path with the reason `profile not resolved`/);
  assert.match(body, /`generated` list/);
  assert.doesNotMatch(body, /\.g\.dart|\.freezed\.dart|flutter/i, 'the skill must not name the generated files or tools of one stack');
  const source = readFileSync(root('scripts/role-skills.mjs'), 'utf8');
  [...body.matchAll(/role-skills\.mjs([^\n`]*)/g)].flatMap((m) => [...m[1].matchAll(/--([a-z]+)/g)].map((f) => f[1]))
    .forEach((f) => assert.ok(source.includes(`'${f}'`), `role-skills does not implement --${f}`));
});

test('Scenario: Monorepo - go reads the platform from the decision, passes it on and commits inside its folder', () => {
  assert.match(body, /`platform` \(its name\), `stack`, `path` \(its folder\) and `targets`/);
  assert.match(body, /stack-profile\.mjs --platform <platform>/);
  assert.match(body, /role-skills\.mjs --role dev --platform <platform>/);
  assert.match(body, /role-skills\.mjs --role qa --platform <platform>/);
  assert.match(body, /--within "<path>" --change "<change_id>"/);
  assert.match(body, /`outside the platform`/);
  assert.match(body, /the folder of the platform \(`path`\)/);
  assert.doesNotMatch(body, /`platform`, `skip`/, 'the decision platform of the previous change is gone');
  const wrapper = readFileSync(root('scripts/commit-change.mjs'), 'utf8');
  ['within', 'change'].forEach((f) => assert.ok(wrapper.includes(`'${f}'`), `commit-change does not implement --${f}`));
});
