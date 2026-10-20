import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyBlock, section, sections } from '../scripts/lib/issue-sections.mjs';

const CLI = new URL('../scripts/issue-sections.mjs', import.meta.url).pathname;
const BODY = `## Summary

Short.

## Decisions

### D1. Sort by date
Decided: by date
Why: people look for the latest

| col | col |
|---|---|
| a | b |

\`\`\`dart
// ## Not a heading
final x = 1;
\`\`\`

## Constraints

- C1: the list loads in under one second

## Assumptions

## Out of scope

- nothing here
`;

test('sections are found by heading, in order; headings of level 3 and inside code are not sections', () => {
  assert.deepEqual(sections(BODY).map((s) => s.name), ['Summary', 'Decisions', 'Constraints', 'Assumptions', 'Out of scope']);
  assert.equal(section(BODY, 'decisions').name, 'Decisions');
  assert.equal(section(BODY, 'Nope'), null);
  assert.deepEqual(sections(''), []);
  assert.deepEqual(sections(undefined), []);
});

test('Scenario: Decisions in the issue - the text is copied byte for byte, tables and code blocks included', () => {
  const block = copyBlock(BODY, ['Decisions']);
  const original = section(BODY, 'Decisions').text;
  assert.ok(block.startsWith('## From the issue: Decisions\n\n'));
  assert.ok(block.includes(original), 'the section text is inside the block unchanged');
  assert.ok(block.includes('| a | b |') && block.includes('// ## Not a heading'));
});

test('Scenario: Section absent - nothing is written for it, and the order of the names is kept', () => {
  const block = copyBlock(BODY, ['Constraints', 'Data contract', 'Decisions', 'Assumptions']);
  assert.doesNotMatch(block, /Data contract/);
  assert.doesNotMatch(block, /Assumptions/, 'an empty section is not copied');
  assert.ok(block.indexOf('Constraints') < block.indexOf('Decisions'));
  assert.equal(copyBlock('', ['Decisions']), '');
});

test('the script lists, reads one section and copies', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-is-'));
  const file = join(dir, 'issue.md');
  writeFileSync(file, BODY);
  const run = (...a) => spawnSync('node', [CLI, '--body-file', file, ...a], { encoding: 'utf8' });
  assert.deepEqual(run('--list').stdout.trim().split('\n'), ['Summary', 'Decisions', 'Constraints', 'Out of scope']);
  assert.match(run('--section', 'Constraints').stdout, /C1: the list loads/);
  assert.equal(run('--section', 'Nope').status, 1);
  assert.equal(run('--copy', 'Decisions').stdout, copyBlock(BODY, ['Decisions']));
  assert.equal(run('--copy', 'Data contract').stdout, '');
  assert.equal(run().status, 2);
  assert.equal(spawnSync('node', [CLI, '--list'], { encoding: 'utf8' }).status, 2);
});
