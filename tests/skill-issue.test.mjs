import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const text = readFileSync(root('skills/issue/SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const meta = parse(front);

const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields and Claude never starts it on its own', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'issue');
  assert.equal(meta['argument-hint'], '[what to build, the path of a saved agreement, or the number of an issue to update]');
  assert.equal(meta['disable-model-invocation'], true);
  assert.match(meta.description, /never applies the ready label/);
  assert.ok(String(meta.description).length <= 1536);
});

test('every script, template and document it points at exists', () => {
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  assert.ok(scripts.includes('check-issue.mjs'));
  assert.ok(scripts.includes('can-edit-issue.mjs'));
  scripts.forEach((s) => assert.ok(existsSync(root(`scripts/${s}`)), `scripts/${s} does not exist`));
  [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/((?:templates|docs)\/[\w.-]+)/g)].forEach((m) => assert.ok(existsSync(root(m[1])), `${m[1]} does not exist`));
});

test('Scenario: Issues created - the skill never applies a lifecycle label and creates only after approval', () => {
  assert.match(body, /Do \*\*not\*\* add the `ready` label/);
  assert.match(body, /Never apply `ready`/);
  assert.match(body, /Create nothing before a clear yes/);
  assert.ok(!/--add-label|--remove-label|--label/.test(body), 'the skill must not touch labels');
  const edits = body.match(/gh issue edit[^\n]*/g) ?? [];
  assert.ok(edits.length > 0);
  edits.forEach((e) => assert.match(e, /--body-file/, 'gh issue edit may only replace the body'));
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

// ---------- the documentation the agreement settled

test('Scenario: Terms handed over - the skill reads To document and writes the exact text in a Documentation section', () => {
  assert.match(body, /part of that agreement named \*\*To document\*\*/);
  assert.match(body, /optional `## Documentation` section of the template with the exact text of each, word for word as agreed/);
  assert.match(body, /after the existing entries/);
});

test('Scenario: A decision record handed over - it has no number, it is numbered when written', () => {
  assert.match(body, /a title and a text, to be added to `docs\/adr\/`, with no number \(it is numbered when it is written\)/);
});

test('Scenario: Nothing to document - the section is left out', () => {
  assert.match(body, /When "To document" says nothing, leave the section out/);
});

test('Scenario: A request to document something else - the section only carries the glossary and decision records', () => {
  assert.match(body, /names only `GLOSSARY\.md` and `docs\/adr\/`/);
  assert.match(body, /for example the README, do not put that in the section/);
  assert.match(body, /Never put anything in `Documentation` except glossary entries and decision records/);
});

test('Scenario: Approval - the Documentation section is shown whole with the rest of the draft', () => {
  assert.match(body, /Show the `Documentation` section too, whole, like the rest of the draft/);
});

test('the issue template and the format doc describe the optional section', () => {
  const template = readFileSync(new URL('../templates/issue.md', import.meta.url), 'utf8');
  const doc = readFileSync(new URL('../docs/issue-format.md', import.meta.url), 'utf8');
  assert.match(template, /## Documentation/);
  assert.match(template, /Optional\. Only when the agreement settled terms/);
  assert.match(doc, /### 4\. Documentation \(optional\)/);
  assert.match(doc, /numbered when it is written/);
  assert.match(doc, /an issue is valid with or without it/);
});

// ---------- update mode

const update = body.slice(body.indexOf('## Updating an existing issue'), body.indexOf('## Never'));

test('Scenario: Number given - the mode comes from the argument', () => {
  assert.match(body, /starts with an issue number \(`42` or `#42`\)/);
  assert.ok(update.length > 0);
});

test('Scenario: Issue ready - the refusal names the label and the way forward, and edits nothing', () => {
  assert.match(update, /can-edit-issue\.mjs/);
  assert.match(update, /the text is what `go` builds/);
  assert.match(update, /remove `ready` by hand, edit, and apply `ready` again/);
  assert.match(update, /wait for the build to finish or fail first/);
});

test('Scenario: Approved - nothing is edited before a clear yes, labels are read again and only the body changes', () => {
  assert.match(update, /Apply nothing before a clear yes/);
  assert.ok(update.indexOf('check-issue.mjs') < update.indexOf('gh issue edit'));
  assert.ok(update.indexOf('clear yes') < update.indexOf('gh issue edit'));
  assert.match(update, /Read the issue again with `gh issue view <n> --json state,labels`/);
  assert.match(body, /Never change the labels, title, milestone or assignee of an existing issue/);
});

test('Scenario: Dependency does not exist - every Depends-on is checked, and not against the issue itself', () => {
  assert.match(update, /Every `Depends-on: #N` in the new body must name an existing issue \(`gh issue view N`\) other than this one/);
});

test('Scenario: Section not mentioned - the Documentation section is kept and still carries only glossary and decision records', () => {
  assert.match(update, /existing `## Documentation` section stays exactly as it is unless the person asks to change it/);
  assert.match(update, /only glossary entries and decision records/);
});
