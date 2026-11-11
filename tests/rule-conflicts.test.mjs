import test from 'node:test';
import assert from 'node:assert/strict';
import { conflictText, findConflicts, outOfScope, overridesOf, scenariosOf, terms } from '../scripts/lib/rule-conflicts.mjs';
import { parseRules } from '../scripts/lib/rules-file.mjs';

const RULES = parseRules('CLAUDE.md', `# Rules

- Every list must offer export and the enable/disable actions.
- Never offer a delete button without a confirmation.
- Prefer short names for the columns of a list. [advice]
`);
const issue = ({ out = '- export and the enable/disable actions', scenarios = '- **WHEN** a person opens the list\n- **THEN** the rows are shown', extra = '' } = {}) => `## Scenarios
${scenarios}

## Edge cases
- empty: an empty state

## Out of scope
${out}
${extra}`;

test('Scenario: Out of scope excludes a required action - both lines are quoted with the file and line of the rule', () => {
  const r = findConflicts({ body: issue(), rules: RULES });
  assert.equal(r.conflicts.length, 1);
  assert.deepEqual(r.conflicts[0].rule, { file: 'CLAUDE.md', line: 3, text: '- Every list must offer export and the enable/disable actions.' });
  const text = conflictText(r.conflicts[0]);
  assert.match(text, /"export and the enable\/disable actions"/);
  assert.match(text, /CLAUDE\.md:3/);
  assert.match(text, /Overrides: CLAUDE\.md:3/);
});

test('Scenario: Out of scope forbids what a scenario needs - the scenario and the limit are named, with no rules file', () => {
  const body = issue({ out: '- any change to the detail page', scenarios: '- **WHEN** the detail page opens\n- **THEN** no error shows' });
  const r = findConflicts({ body, rules: [] });
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].kind, 'scenario');
  assert.equal(r.conflicts[0].scenario.number, 1);
  assert.match(conflictText(r.conflicts[0]), /scenario 1 \(WHEN "the detail page opens"\)/);
});

test('Scenario: The rule is advice - nothing is reported', () => {
  assert.deepEqual(findConflicts({ body: issue({ out: '- short names for the columns of a list' }), rules: RULES }).conflicts, []);
});

test('Scenario: The issue overrides the rule on purpose - the pair is skipped', () => {
  const extra = '\n## Decisions\n\n### D1. Export waits\nDecided: no export yet\nWhy: the API is not ready\nOverrides: CLAUDE.md:3\n';
  assert.deepEqual(findConflicts({ body: issue({ extra }), rules: RULES }).conflicts, []);
});

test('an Overrides line outside a decision does not count, and one that names a line that is not a rule is a problem', () => {
  assert.equal(findConflicts({ body: issue({ extra: '\nOverrides: CLAUDE.md:3\n' }), rules: RULES }).conflicts.length, 1);
  const extra = '\n## Decisions\n\n### D1. x\nDecided: y\nOverrides: CLAUDE.md:99\n';
  const r = findConflicts({ body: issue({ extra }), rules: RULES });
  assert.match(r.problems[0], /CLAUDE\.md:99 is not a line of a rules file/);
  assert.deepEqual(overridesOf(issue({ extra })), [{ file: 'CLAUDE.md', line: 99 }]);
});

test('Scenario: A rule that forbids agrees with the exclusion', () => {
  const rules = parseRules('CLAUDE.md', '- Export must never be offered.');
  assert.deepEqual(findConflicts({ body: issue({ out: '- export' }), rules }).conflicts, []);
});

test('a rule without a requirement word, and a heading, are not requirements', () => {
  const rules = parseRules('CLAUDE.md', '# Export and enable/disable actions\n\nThe export and the enable/disable actions are nice.');
  assert.deepEqual(findConflicts({ body: issue(), rules }).conflicts, []);
});

test('a one-word exclusion matches a rule that names it; a vague overlap of one word does not', () => {
  assert.equal(findConflicts({ body: issue({ out: '- export' }), rules: RULES }).conflicts.length, 1);
  assert.deepEqual(findConflicts({ body: issue({ out: '- the list of invoices and the printing of them' }), rules: RULES }).conflicts, []);
});

test('a reference to another issue does not count as a word, and Spanish rules are read', () => {
  const rules = parseRules('CLAUDE.md', '- Toda lista debe ofrecer exportar y habilitar.');
  const r = findConflicts({ body: issue({ out: '- exportar y habilitar (queda en #130)' }), rules });
  assert.equal(r.conflicts.length, 1);
});

test('the sections are read: out of scope bullets, complete scenarios, no Out of scope', () => {
  assert.deepEqual(outOfScope(issue({ out: '- a\n- b: later' })), ['a', 'b: later']);
  assert.deepEqual(outOfScope('## Scenarios\n- x'), []);
  assert.equal(scenariosOf(issue()).length, 1);
  assert.equal(scenariosOf('## Scenarios\n- **WHEN** only a when').length, 0);
  assert.ok(terms('Exporting lists').has('export'));
});

test('an exclusion of the remainder ("any other change to the home screen") cannot contradict a scenario or a rule', () => {
  const body = issue({ out: '- Any other change to the home screen.', scenarios: '- **WHEN** the home screen is shown\n- **THEN** the greeting is on top' });
  assert.deepEqual(findConflicts({ body, rules: parseRules('CLAUDE.md', '- The home screen must show the greeting.') }).conflicts, []);
});
