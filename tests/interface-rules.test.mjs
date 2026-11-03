import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadKnowledge, mergeRepositoryRules } from '../scripts/lib/interface-knowledge.mjs';
import { coverageGaps, kindsOf, renderRules, selectRules, tagsOf } from '../scripts/lib/interface-rules.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CLI = `${ROOT}/scripts/interface-rules.mjs`;
const knowledge = loadKnowledge(ROOT);
const ids = (s) => s.rules.map((r) => r.id);
const select = (o) => selectRules({ knowledge, kinds: kindsOf({ interfaceKind: 'web' }), stack: 'vue', ...o });

test('Scenario: A change that touches forms - the core rules and the form rules, each with its build line', () => {
  const s = select({ role: 'dev', text: 'Add a sign up form with email and password fields' });
  assert.ok(ids(s).includes('focus-visible'), 'core');
  ['inline-field-error', 'form-labels', 'input-types'].forEach((id) => assert.ok(ids(s).includes(id), id));
  const labels = s.rules.find((r) => r.id === 'form-labels');
  assert.equal(labels.line, knowledge.rules.find((r) => r.id === 'form-labels').build);
});

test('the face depends on the role: the question, the build line or the check line', () => {
  const rule = knowledge.rules.find((r) => r.id === 'form-labels');
  const line = (role) => select({ role, text: 'a form' }).rules.find((r) => r.id === 'form-labels').line;
  assert.equal(line('think'), rule.ask);
  assert.equal(line('issue'), rule.ask);
  assert.equal(line('dev'), rule.build);
  assert.equal(line('qa'), rule.review);
  assert.equal(line('review'), rule.review);
});

test('the words of a change in Spanish select the same tags', () => {
  assert.ok(tagsOf('Agregar un formulario de inicio de sesión con contraseña', knowledge.keywords).includes('forms'));
  assert.ok(tagsOf('Add a form', knowledge.keywords).includes('forms'));
  assert.ok(tagsOf('Mostrar una tabla de resultados', knowledge.keywords).includes('tables'));
  assert.deepEqual(tagsOf('', knowledge.keywords), []);
  assert.ok(select({ role: 'dev', text: 'Agregar un formulario' }).rules.some((r) => r.id === 'inline-field-error'));
});

test('Scenario: A stack for the web only - no rule that applies only to mobile', () => {
  const s = select({ role: 'dev', text: 'a form with a swipe gesture and touch targets and a back button' });
  s.rules.forEach((r) => assert.notEqual(knowledge.rules.find((x) => x.id === r.id).applies, 'mobile'));
  assert.ok(!ids(s).includes('target-size-touch'));
});

test('Scenario: A mobile stack that builds for the web - the web rules are selected as well', () => {
  const only = selectRules({ knowledge, role: 'dev', stack: 'flutter', kinds: kindsOf({ interfaceKind: 'mobile', targets: ['android'] }), text: '' });
  const both = selectRules({ knowledge, role: 'dev', stack: 'flutter', kinds: kindsOf({ interfaceKind: 'mobile', targets: ['android', 'web'] }), text: '' });
  assert.ok(ids(only).includes('target-size-touch') && !ids(only).includes('target-size-web'));
  assert.ok(ids(both).includes('target-size-touch') && ids(both).includes('target-size-web'));
});

test('a stack with no interface gets nothing', () => {
  assert.equal(kindsOf({ interfaceKind: 'none' }).size, 0);
  assert.deepEqual(selectRules({ knowledge, role: 'dev', stack: 'supabase', kinds: kindsOf({ interfaceKind: 'none' }), text: 'a form' }).rules, []);
});

test('Scenario: Over the budget - advisory rules and examples go first, the blocking core rules stay, and the count is said', () => {
  const text = 'form table chips navigation video search dialog toast carousel images animation';
  const full = select({ role: 'dev', text, budget: 10_000_000 });
  const tight = select({ role: 'dev', text, budget: 5000 });
  assert.equal(full.left_out, 0);
  assert.ok(tight.left_out > 0);
  knowledge.rules.filter((r) => r.core && r.weight === 'blocking' && r.applies !== 'mobile').forEach((r) => assert.ok(ids(tight).includes(r.id), `core rule ${r.id} was dropped`));
  assert.ok(tight.rules.every((r) => r.core || r.weight === 'blocking' || ids(full).includes(r.id)));
  assert.match(renderRules(tight), new RegExp(`${tight.left_out} more matching rules? w`));
});

test('Scenario: An example for another stack - only the examples of the stack and the neutral ones', () => {
  const s = selectRules({ knowledge, role: 'dev', stack: 'flutter', kinds: kindsOf({ interfaceKind: 'mobile' }), text: 'icon button' });
  const name = s.rules.find((r) => r.id === 'accessible-name');
  const tags = name.examples.map((e) => knowledge.rules.find((r) => r.id === 'accessible-name').examples.find((x) => x.good === e.good).stack);
  assert.ok(tags.every((t) => ['flutter', 'neutral'].includes(t)), tags.join(','));
  assert.ok(tags.includes('flutter'));
  assert.ok(!JSON.stringify(s).includes('aria-label'));
});

test('think and issue get the questions and no examples', () => {
  const s = select({ role: 'think', text: 'a form' });
  assert.ok(s.rules.every((r) => r.examples === undefined));
});

test('Scenario: A translated rule - the lines come from the override of the stack, others from the common text', () => {
  const overrides = { 'accessible-name': { build: 'Give the widget a Semantics label.', review: 'Check the Semantics label.', examples: [{ stack: 'flutter', good: 'Semantics(label: "x")' }] } };
  const s = selectRules({ knowledge, role: 'dev', stack: 'flutter', kinds: kindsOf({ interfaceKind: 'mobile' }), text: '', overrides });
  assert.equal(s.rules.find((r) => r.id === 'accessible-name').line, 'Give the widget a Semantics label.');
  assert.equal(s.rules.find((r) => r.id === 'focus-visible').line, knowledge.rules.find((r) => r.id === 'focus-visible').build);
});

test('Scenario: A gap - the coverage report lists the blocking rules with no example for the stack, and does not fail', () => {
  const gaps = coverageGaps({ knowledge, stack: 'flutter', kinds: kindsOf({ interfaceKind: 'mobile' }) });
  assert.ok(Array.isArray(gaps));
  const warn = spawnSync('node', [CLI, '--coverage'], { cwd: fixtureRepo('mobile'), encoding: 'utf8' });
  assert.equal(warn.status, 0);
  assert.match(warn.stdout, /^(warning: \d+ blocking rules? (has|have) no example for flutter|every blocking rule has an example for flutter)/);
});

test('Scenario: An added rule - a rule of the repository is selected like one of the plugin', () => {
  const added = { id: 'brand-logo-size', category: 'brand', title: 'Logo size', principle: 'The logo keeps its minimum size.', applies: 'all', weight: 'advisory', check: 'person', core: true, touches: ['images'], ask: 'q', build: 'Keep the logo at 32 px or more.', review: 'The logo is at least 32 px.', examples: [], source: { work: 'this project', numbers: [] } };
  const m = mergeRepositoryRules(knowledge.rules, JSON.stringify({ rules: [added] }));
  assert.deepEqual(m.added, ['brand-logo-size']);
  const s = selectRules({ knowledge: { ...knowledge, rules: m.rules }, role: 'dev', stack: 'vue', kinds: kindsOf({ interfaceKind: 'web' }), text: '' });
  assert.ok(ids(s).includes('brand-logo-size'));
});

test('Scenario: A rule that tries to lower a weight - the plugin rule is kept and the attempt is reported', () => {
  const lower = { ...knowledge.rules.find((r) => r.id === 'color-contrast'), weight: 'advisory' };
  const m = mergeRepositoryRules(knowledge.rules, JSON.stringify({ rules: [lower] }));
  assert.equal(m.rules.find((r) => r.id === 'color-contrast').weight, 'blocking');
  assert.equal(m.attempts.length, 1);
  assert.match(m.attempts[0].attempt, /lowers the weight/);
});

test('a rule with a missing field is reported and not added; a file that is not JSON is reported', () => {
  const m = mergeRepositoryRules(knowledge.rules, JSON.stringify({ rules: [{ id: 'x', weight: 'blocking' }] }));
  assert.deepEqual(m.added, []);
  assert.match(m.problems[0].problems.join(' '), /lacks "category"/);
  assert.match(mergeRepositoryRules(knowledge.rules, '{nope').problems[0].problems[0], /not valid JSON/);
  assert.deepEqual(mergeRepositoryRules(knowledge.rules, null).added, []);
});

function fixtureRepo(kind) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-iface-'));
  const stack = kind === 'mobile' ? 'flutter' : 'vue';
  writeFileSync(join(dir, 'relevo.yml'), readFileSync(`${ROOT}/templates/relevo.yml`, 'utf8').replace(/platforms:[\s\S]*?\n\n/, `platforms:\n  app:\n    path: .\n    stack: ${stack}\n    targets: [${kind === 'mobile' ? 'android' : 'web'}]\n\n`));
  mkdirSync(join(dir, '.relevo'), { recursive: true });
  return dir;
}

test('the command prints the rules for the platform and the text, and nothing for a stack without an interface', () => {
  const dir = fixtureRepo('web');
  const out = spawnSync('node', [CLI, '--role', 'dev', '--text', 'a form with a table'], { cwd: dir, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /Inputs have a visible label/);
  const json = JSON.parse(spawnSync('node', [CLI, '--role', 'qa', '--json'], { cwd: dir, encoding: 'utf8' }).stdout);
  assert.equal(json.role, 'qa');
  assert.equal(spawnSync('node', [CLI, '--role', 'nobody'], { cwd: dir, encoding: 'utf8' }).status, 2);
});

test('the translations name rules that exist and leave no blocking core rule without an example for Flutter or Vue', () => {
  for (const [stack, kind] of [['flutter', 'mobile'], ['vue', 'web'], ['laravel', 'web']]) {
    const k = loadKnowledge(ROOT, stack);
    Object.keys(k.overrides).forEach((id) => assert.ok(k.rules.some((r) => r.id === id), `${stack} overrides an unknown rule ${id}`));
    Object.values(k.overrides).forEach((o) => ['build', 'review', 'examples'].forEach((f) => assert.ok(o[f], `${stack}: an override lacks ${f}`)));
    const gaps = coverageGaps({ knowledge: k, stack, kinds: kindsOf({ interfaceKind: kind }), overrides: k.overrides });
    const coreGaps = gaps.filter((g) => k.rules.find((r) => r.id === g.id).core);
    assert.deepEqual(coreGaps, [], `${stack}: core rules without an example`);
    if (gaps.length) process.stderr.write(`warning: ${gaps.length} blocking rules have no example for ${stack}: ${gaps.map((g) => g.id).join(', ')}\n`);
  }
});
