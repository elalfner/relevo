import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NEVER, OPENSPEC_COMMANDS, isAllowed, openspecSubcommand } from '../scripts/lib/openspec-commands.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SKILL = read('skills/go/SKILL.md');

/** Every `openspec ...` found in code fences and inline code, with the line it is on. */
function commandsIn(text) {
  const found = [];
  let fenced = false;
  text.split('\n').forEach((line) => {
    if (line.startsWith('```')) { fenced = !fenced; return; }
    const spans = fenced ? [line] : [...line.matchAll(/`([^`]*)`/g)].map((m) => m[1]);
    spans.forEach((span) => {
      const m = span.match(/(?:^|\s)openspec\s+([^\n|;&]*)/);
      if (m) found.push({ line, tokens: m[1].trim().split(/\s+/) });
    });
  });
  return found;
}
const section = (text, heading) => text.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)\\n## `))?.[1] ?? '';

test('Scenario: the OpenSpec commands section of go equals the table', () => {
  const listed = [...section(SKILL, 'OpenSpec commands').matchAll(/^- `openspec ([^`]+)`/gm)]
    .map((m) => openspecSubcommand(m[1].split(/\s+/).filter((t) => t !== '--json')));
  assert.deepEqual([...listed].sort(), [...OPENSPEC_COMMANDS.go].sort());
});

test('Scenario: any other openspec command in the skill is on the list, unless the line says never or do not', () => {
  const rest = SKILL.replace(/## OpenSpec commands\n[\s\S]*?\n## /, '## ');
  commandsIn(rest).forEach(({ line, tokens }) => {
    if (/\b(never|do not|Do not|Never)\b/.test(line)) return;
    assert.ok(isAllowed('go', tokens), `go uses "openspec ${tokens.join(' ')}", which is not on its list`);
  });
});

test('no allowed command is one that no unattended run may use', () => {
  Object.values(OPENSPEC_COMMANDS).flat().forEach((c) => assert.ok(!NEVER.includes(c.split(' ')[0]), c));
});

test('the agents use only their own lists', () => {
  ['dev', 'qa'].forEach((part) => {
    commandsIn(read(`agents/${part}.md`)).forEach(({ line, tokens }) => {
      if (/\b(never|do not|Do not|Never)\b/.test(line)) return;
      assert.ok(isAllowed(part, tokens), `${part} uses "openspec ${tokens.join(' ')}", which is not on its list`);
    });
  });
});

test('think and issue use only their own read-only lists', () => {
  ['think', 'issue'].forEach((part) => {
    const files = part === 'issue' ? ['skills/issue/SKILL.md', 'skills/issue/references/update.md'] : ['skills/think/SKILL.md'];
    files.forEach((f) => commandsIn(read(f).replace(/## 1\. Check the skills first[\s\S]*?\n## 2\./, '## 2.')).forEach(({ line, tokens }) => {
      if (/\b(never|do not|Do not|Never)\b/.test(line)) return;
      assert.ok(isAllowed(part, tokens), `${part} uses "openspec ${tokens.join(' ')}" in ${f}, which is not on its list`);
    }));
  });
  assert.deepEqual(OPENSPEC_COMMANDS.think, ['list', 'show', 'status']);
});
