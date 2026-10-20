import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIssueBody } from '../scripts/lib/issue-parse.mjs';
import { branchName, changeId, slugify } from '../scripts/lib/branch.mjs';

const GOOD = `## Scenarios
- **WHEN** the user opens the screen
- **THEN** the total is shown

## Edge cases
- the list is empty
- the device is offline
`;

test('a complete issue has scenarios and edge cases and nothing missing', () => {
  const r = parseIssueBody(GOOD);
  assert.equal(r.scenarios, 1);
  assert.equal(r.edgeCases, 2);
  assert.deepEqual(r.missing, []);
});

test('Scenario: Spec incomplete - no scenarios', () => {
  const r = parseIssueBody('## Edge cases\n- empty\n');
  assert.equal(r.scenarios, 0);
  assert.ok(r.missing.some((m) => /WHEN\/THEN/.test(m)));
});

test('Scenario: Spec incomplete - no edge cases', () => {
  const r = parseIssueBody('- **WHEN** a\n- **THEN** b\n');
  assert.equal(r.edgeCases, 0);
  assert.ok(r.missing.some((m) => /edge cases/.test(m)));
});

test('a WHEN without a THEN is not a scenario', () => {
  assert.equal(parseIssueBody('- **WHEN** only a trigger\n## Edge cases\n- x\n').scenarios, 0);
});

test('plain WHEN/THEN lines and Spanish edge-case headings are understood', () => {
  const r = parseIssueBody('WHEN algo pasa\nTHEN se muestra\n\n### Casos borde\n1. lista vacía\n');
  assert.equal(r.scenarios, 1);
  assert.equal(r.edgeCases, 1);
});

test('edge cases only count under their own heading', () => {
  const r = parseIssueBody('## Edge cases\n- one\n\n## Notes\n- not an edge case\n');
  assert.equal(r.edgeCases, 1);
});

test('code blocks are ignored', () => {
  const r = parseIssueBody('```\n- **WHEN** x\n- **THEN** y\n```\n## Edge cases\n- z\n');
  assert.equal(r.scenarios, 0);
});

test('Depends-on lines list issue numbers, once each, in either language', () => {
  assert.deepEqual(parseIssueBody('Depends-on: #12, #13\nDepends on: #12\n').dependsOn, [12, 13]);
  assert.deepEqual(parseIssueBody('Depende de: #7\n').dependsOn, [7]);
  assert.deepEqual(parseIssueBody('no dependencies here, see #99').dependsOn, []);
});

test('an empty or missing body reports everything missing', () => {
  assert.equal(parseIssueBody('').missing.length, 2);
  assert.equal(parseIssueBody(null).missing.length, 2);
});

test('branch and change names come from the issue number and title', () => {
  assert.equal(slugify('Pantalla de Resumen: ¡nueva!'), 'pantalla-de-resumen-nueva');
  assert.equal(changeId(31, 'Summary screen'), '31-summary-screen');
  assert.equal(branchName(31, 'Summary screen'), 'feature/31-summary-screen');
  assert.equal(slugify('???'), 'task');
  const long = slugify('a very long title that keeps going well past the forty character limit');
  assert.ok(long.length <= 40);
  assert.ok(!long.endsWith('-'));
  assert.equal(long, 'a-very-long-title-that-keeps-going-well');
});

test('Allow-paths lines list the dependency files the change may touch, once each', () => {
  assert.deepEqual(parseIssueBody('Allow-paths: pubspec.yaml, pubspec.lock\n').allowPaths, ['pubspec.yaml', 'pubspec.lock']);
  assert.deepEqual(parseIssueBody('- Allow-paths: `package.json`,`package-lock.json`\nAllow-paths: package.json\n').allowPaths, ['package.json', 'package-lock.json']);
  assert.deepEqual(parseIssueBody('allow-paths:  apps/web/*  \n').allowPaths, ['apps/web/*']);
});

test('an issue without an Allow-paths line allows nothing, and the line inside a code block is only an example', () => {
  assert.deepEqual(parseIssueBody(GOOD).allowPaths, []);
  assert.deepEqual(parseIssueBody('```\nAllow-paths: pubspec.lock\n```\n').allowPaths, []);
  assert.deepEqual(parseIssueBody('').allowPaths, []);
});

test('an Allow-paths line does not count as a scenario, an edge case or a dependency', () => {
  const r = parseIssueBody(`${GOOD}\nAllow-paths: pubspec.yaml\n`);
  assert.deepEqual([r.scenarios, r.edgeCases, r.dependsOn, r.missing], [1, 2, [], []]);
});

test('Platform lines: one name, several names, a name in a code block ignored, none gives an empty list', () => {
  assert.deepEqual(parseIssueBody(`${GOOD}\nPlatform: web\n`).platform, ['web']);
  assert.deepEqual(parseIssueBody(`${GOOD}\n- Platform: \`api\`\n`).platform, ['api']);
  assert.deepEqual(parseIssueBody(`${GOOD}\nPlatform: web, api\n`).platform, ['web', 'api']);
  assert.deepEqual(parseIssueBody(`${GOOD}\n\`\`\`\nPlatform: web\n\`\`\`\n`).platform, []);
  assert.deepEqual(parseIssueBody(GOOD).platform, []);
});
