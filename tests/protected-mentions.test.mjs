import test from 'node:test';
import assert from 'node:assert/strict';
import { mentionText, protectedMentions } from '../scripts/lib/protected-mentions.mjs';

const wrap = (inner, extra = '') => `## Summary\nA summary.\n\n## Scenarios\n${inner}\n\n## Edge cases\n- none: nothing\n${extra}`;
const find = (inner, opts = {}, extra = '') => protectedMentions({ body: wrap(inner, extra), rulesFile: 'CLAUDE.md', ...opts });

test('Scenario: A task edits the rules file - a change mention that names the path, why and both ways out', () => {
  const [m] = find('- **WHEN** the build runs\n- **THEN** it updates CLAUDE.md with the new rule');
  assert.deepEqual([m.kind, m.path, m.tier, m.rule, m.section], ['change', 'CLAUDE.md', 'hard', 'CLAUDE.md', 'Scenarios']);
  const text = mentionText(m);
  assert.match(text, /asks to change CLAUDE\.md/);
  assert.match(text, /never changes/);
  assert.match(text, /a person makes that edit/);
  assert.match(text, /rewritten/);
  assert.doesNotMatch(text, /Allow-paths: line/);
});

test('Scenario: The rules file is only named in prose - a named mention, not a change', () => {
  const r = find('- **WHEN** a person opens the list, as CLAUDE.md describes\n- **THEN** it shows');
  assert.deepEqual(r.map((m) => [m.kind, m.path]), [['named', 'CLAUDE.md']]);
  assert.match(mentionText(r[0]), /names CLAUDE\.md/);
});

test('a workflow, relevo.yml and a skill folder are hard paths', () => {
  const r = protectedMentions({ body: wrap('- **WHEN** x\n- **THEN** it edits `.github/workflows/ci.yml` and relevo.yml and adds `.claude/skills/foo/SKILL.md`') });
  assert.deepEqual(r.map((m) => m.path).sort(), ['.claude/skills/foo/SKILL.md', '.github/workflows/ci.yml', 'relevo.yml']);
  assert.ok(r.every((m) => m.kind === 'change' && m.tier === 'hard'));
});

test('the skill folder of a platform is protected too', () => {
  const r = protectedMentions({ body: wrap('- **WHEN** x\n- **THEN** it adds `web/.claude/skills/a.md`'), platformPaths: ['web'] });
  assert.deepEqual(r.map((m) => m.path), ['web/.claude/skills/a.md']);
});

test('Scenario: A dependency manifest that is not allowed - the way out includes Allow-paths', () => {
  const [m] = find('- **WHEN** x\n- **THEN** it adds a package to package.json');
  assert.equal(m.tier, 'soft');
  assert.match(mentionText(m), /Allow-paths: line/);
});

test('Scenario: A dependency manifest that is allowed - nothing is reported', () => {
  assert.deepEqual(find('- **WHEN** x\n- **THEN** it adds a package to package.json', { allow: ['package.json'] }), []);
});

test('a manifest that is only named is not reported', () => {
  assert.deepEqual(find('- **WHEN** x\n- **THEN** the list uses the version in package.json'), []);
});

test('Scenario: Only a pointer or an exclusion - the sections that point or exclude, code and negations are not read', () => {
  const body = `## Scenarios\n- **WHEN** x\n- **THEN** y\n\n## Edge cases\n- a: b\n\n## Out of scope\n- changing CLAUDE.md\n\n## Code pointers\n- \`CLAUDE.md\`: the rules\n\n## Constraints\n- C1: do not change CLAUDE.md\n- C2: never edit relevo.yml\n\n## Design reference\n- \`.github/workflows/ci.yml\`: layout\n\n## Verification\n\`\`\`\nedit CLAUDE.md\n\`\`\`\n`;
  assert.deepEqual(protectedMentions({ body, rulesFile: 'CLAUDE.md' }), []);
});

test('an Allow-paths line is not a mention (the check already refuses it)', () => {
  assert.deepEqual(protectedMentions({ body: wrap('- **WHEN** x\n- **THEN** y', '\nAllow-paths: CLAUDE.md\n'), rulesFile: 'CLAUDE.md' }), []);
});

test('Spanish verbs count as a change', () => {
  const [m] = find('- **WHEN** x\n- **THEN** se actualiza CLAUDE.md');
  assert.equal(m.kind, 'change');
});

test('each path is reported once per line and a rules file that is not set protects nothing extra', () => {
  assert.equal(find('- **WHEN** x\n- **THEN** it edits CLAUDE.md and CLAUDE.md').length, 1);
  assert.deepEqual(protectedMentions({ body: wrap('- **WHEN** x\n- **THEN** it edits CLAUDE.md') }), []);
});
