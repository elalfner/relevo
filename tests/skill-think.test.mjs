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
  assert.match(body, /If `grill-with-docs` is invocable, invoke it with the Skill tool in the same conversation/);
});

test('Scenario: Idea still vague - it stays in the exploration', () => {
  assert.match(body, /Stay in it while the idea is still shapeless/);
});

test('it does not restate the rules of the skills it runs', () => {
  assert.match(body, /do not restate them, shorten them or override them/);
  assert.ok(!/frontier|tree of decisions|Recommended:/.test(body), 'the interview rules belong to grill-with-docs');
  // The language rules belong to grill-with-docs; think names the glossary and the records only to redirect them.
  const outside = body.replace(/\*\*One exception to its rules\.\*\*[\s\S]*?probing boundaries with concrete scenarios and checking the code\./, '').replace(/- Never write `GLOSSARY\.md` or anything under `docs\/adr\/`[^\n]*/, '');
  assert.ok(!/GLOSSARY\.md|docs\/adr/.test(outside), 'the language rules belong to grill-with-docs');
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

test('Scenario: Invoked skill suggests another next step - it points to issue', () => {
  assert.match(body, /whatever next step those skills suggested themselves/);
  assert.match(body, /\/opsx:propose/);
  assert.match(body, /\/relevo:issue/);
  assert.ok(existsSync(root('skills/issue/SKILL.md')));
});

test('Scenario: Keeping the agreement - the agreement file is written only on request', () => {
  assert.match(body, /Only if the person asks to keep the agreement/);
  assert.match(body, /agreement file only on request/);
});

test('Scenario: Hand-off - OpenSpec artifacts the person asked for are named and reported as not committed', () => {
  assert.match(body, /If the session created or changed OpenSpec artifacts at the person's request, name them and say they are not committed/);
});

test('think never builds, commits, pushes, creates issues or labels, and does not write an OpenSpec change itself', () => {
  assert.match(body, /Never write code, commit, push, create issues or apply labels/);
  assert.match(body, /Never run `openspec new change`/);
  const rest = body.replace(/Never write code, commit, push, create issues or apply labels\./g, '').replace(/Never run `openspec new change`[^\n]*/, '');
  assert.ok(!/gh issue create|git push|git commit|--add-label|openspec (new|instructions|archive)/.test(rest), 'think must not run those commands');
});

test('Scenario: The skill would update the glossary - think redirects that one step to the To document list', () => {
  assert.match(body, /\*\*One exception to its rules\.\*\*/);
  assert.match(body, /do \*\*not\*\* write it/);
  assert.match(body, /Keep the entry in a list called "To document" instead/);
  assert.match(body, /a settled term: its name, a definition of one or two sentences and the words to avoid/);
  assert.match(body, /a decision record the person accepted: a title and its text, without a number/);
  assert.match(body, /Everything else that skill does stays as it is/);
});

test('Scenario: Nothing to document / Hand-off - the agreement has a To document part and says nothing was written', () => {
  assert.match(body, /part named \*\*To document\*\*, even when it is empty/);
  assert.match(body, /To document: nothing/);
  assert.match(body, /through `\/relevo:issue`, and that `think` wrote nothing to the repository/);
  assert.match(body, /Never write `GLOSSARY\.md` or anything under `docs\/adr\/`/);
});

test('the glossary and decision records are no longer reported as files think created', () => {
  assert.ok(!/Name the documentation files the session created or changed \(glossary/.test(body));
  assert.ok(!/glossary, decision records, OpenSpec artifacts/.test(body));
});

test('the exception keeps the rules for what an entry may hold', () => {
  assert.match(body, /An entry is vocabulary only: no implementation details, no decisions, no general programming terms/);
});

test('Scenario: A skill is installed but reserved for the person - think does not stop, it tells reserved from missing', () => {
  assert.match(body, /only a missing one stops `think`/);
  assert.match(body, /\*\*Reserved for the person\.\*\*/);
  assert.match(body, /`disable-model-invocation: true` line in the frontmatter of its `SKILL\.md`/);
  assert.match(body, /It is installed, so do not stop/);
  assert.match(body, /If the file cannot be read, treat the skill as invocable/);
  assert.match(body, /a skill that is only reserved for the person is not missing/);
});

test('Scenario: Grilling skill is reserved for the person - think asks for the command and does not replicate the flow', () => {
  assert.match(body, /If it is reserved for the person, which is how it is published, do \*\*not\*\* try to invoke it/);
  assert.match(body, /do not run its interview yourself by another route/);
  assert.match(body, /asks the person to run `\/grill-with-docs` in this same conversation/);
  assert.match(body, /Never invoke a skill whose `SKILL\.md` sets `disable-model-invocation`, and never replace it by running its flow yourself/);
});

test('Scenario: Hand-off when the person launches the skill - the same message gives the next command and says nothing was written', () => {
  assert.match(body, /Because you may not regain control when that skill ends, put the hand-off in that same message/);
  assert.match(body, /they should run `\/relevo:issue` in this conversation/);
  assert.match(body, /stay in "To document", and that you wrote nothing to the repository/);
});
