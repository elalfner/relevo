import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkIssueDraft, PLACEHOLDERS, TITLE_MAX } from '../scripts/lib/issue-check.mjs';
import { parseIssueBody } from '../scripts/lib/issue-parse.mjs';

const GOOD = `## Summary
Shows who has a birthday today.

## Scenarios
- **WHEN** 3 clients have a birthday today
- **THEN** the list shows 3 names

## Edge cases
- a client without a phone: the send button is disabled

Depends-on: #12
`;

test('a complete draft passes and reports what it found', () => {
  const r = checkIssueDraft({ title: 'Birthday list', body: GOOD });
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
  assert.equal(r.scenarios, 1);
  assert.equal(r.edgeCases, 1);
  assert.deepEqual(r.dependsOn, [12]);
});

test('Scenario: Missing edge cases - the check fails and says what is missing', () => {
  const r = checkIssueDraft({ title: 'Birthday list', body: GOOD.replace(/## Edge cases[\s\S]*?\n\n/, '') });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /edge cases/);
});

test('a draft that go would send back is never ready (same rules as the spec gate)', () => {
  const bodies = [GOOD, 'just words', GOOD.replace('**THEN**', 'then maybe')];
  bodies.forEach((body) => {
    const gate = parseIssueBody(body).missing.length === 0;
    assert.equal(checkIssueDraft({ title: 'x', body }).ok, gate);
  });
});

test('Scenario: Credential in the text - the check fails without echoing the secret', () => {
  const secret = 'sk-ant-abcdefghijklmnop12345';
  const r = checkIssueDraft({ title: 'x', body: `${GOOD}\nkey: ${secret}` });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /credential/);
  assert.ok(!r.problems.join('\n').includes(secret));
});

test('titles: no emoji, not empty, not longer than the limit', () => {
  assert.match(checkIssueDraft({ title: '🚨 Alerts', body: GOOD }).problems.join(), /emoji/);
  assert.match(checkIssueDraft({ title: '  ', body: GOOD }).problems.join(), /empty/);
  assert.match(checkIssueDraft({ title: 'a'.repeat(TITLE_MAX + 1), body: GOOD }).problems.join(), /characters/);
  assert.equal(checkIssueDraft({ title: 'a'.repeat(TITLE_MAX), body: GOOD }).ok, true);
  assert.equal(checkIssueDraft({ title: 'Reporte de cumpleaños (año bisiesto)', body: GOOD }).ok, true);
});

test('the untouched template is rejected because it still holds template text', () => {
  const template = readFileSync(new URL('../templates/issue.md', import.meta.url), 'utf8');
  const r = checkIssueDraft({ title: 'Something', body: template });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /template text/);
  PLACEHOLDERS.forEach((p) => assert.ok(template.includes(p), `the template no longer contains ${p}`));
});

test('the CLI exits 0 for a good draft, 1 for a bad one, 2 for bad arguments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  const cli = new URL('../scripts/check-issue.mjs', import.meta.url).pathname;
  writeFileSync(join(dir, 'good.md'), GOOD);
  writeFileSync(join(dir, 'bad.md'), 'nothing here');
  const run = (...args) => spawnSync('node', [cli, ...args], { encoding: 'utf8' });
  assert.equal(run('--title', 'Birthday list', '--body-file', join(dir, 'good.md')).status, 0);
  const bad = run('--title', 'Birthday list', '--body-file', join(dir, 'bad.md'));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /problem:/);
  assert.equal(run().status, 2);
  assert.equal(run('--title', 'x', '--body-file', join(dir, 'missing.md')).status, 2);
});

// ---------- the optional Documentation section

const DOC_SECTION = `
## Documentation

- Add these entries to \`GLOSSARY.md\`, under its existing heading, after the existing ones, exactly as written. They are vocabulary only; nothing else in that file changes.

**Build number**:
The number after the \`+\` in the version of pubspec.yaml, shown in the app bar subtitle.
_Avoid_: Build label, build
`;

test('Scenario: Issue with the section - the check passes and counts only the scenarios and edge cases', () => {
  const without = checkIssueDraft({ title: 'Birthday list', body: GOOD });
  const body = GOOD.replace('\nDepends-on: #12\n', `${DOC_SECTION}\nDepends-on: #12\n`);
  const withDoc = checkIssueDraft({ title: 'Birthday list', body });
  assert.equal(withDoc.ok, true, withDoc.problems.join('; '));
  assert.equal(withDoc.scenarios.length, without.scenarios.length);
  assert.equal(withDoc.edgeCases.length, without.edgeCases.length);
  assert.deepEqual(withDoc.dependsOn, without.dependsOn);
});

test('an issue without the section stays valid', () => {
  assert.equal(checkIssueDraft({ title: 'Birthday list', body: GOOD }).ok, true);
});

test('a Documentation section that still has the template placeholders is rejected', () => {
  const body = GOOD.replace('\nDepends-on: #12\n', '\n## Documentation\n\n**<term>**:\n<definition>\n_Avoid_: <words to avoid>\n\nDepends-on: #12\n');
  const r = checkIssueDraft({ title: 'Birthday list', body });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /template text: .*<term>/);
});

test('the Documentation section never hides a missing edge case', () => {
  const body = `## Scenarios\n- **WHEN** a\n- **THEN** b\n${DOC_SECTION}`;
  const r = checkIssueDraft({ title: 'Birthday list', body });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /edge case/i);
});

// ---------- Allow-paths: dependency files the change may touch

const WITH_ALLOW = (line) => `${GOOD}\n${line}\n`;

test('Scenario: Lock file with permission - an Allow-paths line naming dependency files passes the check', () => {
  const r = checkIssueDraft({ title: 'Add a chart', body: WITH_ALLOW('Allow-paths: pubspec.yaml, pubspec.lock') });
  assert.equal(r.ok, true);
  assert.deepEqual(r.allowPaths, ['pubspec.yaml', 'pubspec.lock']);
});

test('Scenario: Workflow edited - an Allow-paths line that names a path that can never be allowed fails the check', () => {
  const r = checkIssueDraft({ title: 'Add a chart', body: WITH_ALLOW('Allow-paths: pubspec.yaml, .github/workflows/ci.yml') });
  assert.equal(r.ok, false);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /Allow-paths lists "\.github\/workflows\/ci\.yml", which can never be allowed/);
});

test('a glob that would cover a protected path fails the check, and so does the project rules file', () => {
  assert.equal(checkIssueDraft({ title: 'Add a chart', body: WITH_ALLOW('Allow-paths: **') }).ok, false);
  assert.equal(checkIssueDraft({ title: 'Add a chart', body: WITH_ALLOW('Allow-paths: CLAUDE.md') }).ok, true, 'without a rules file it is an ordinary file');
  const r = checkIssueDraft({ title: 'Add a chart', body: WITH_ALLOW('Allow-paths: CLAUDE.md'), rulesFile: 'CLAUDE.md' });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /"CLAUDE\.md"/);
});

test('an issue without the line stays valid and allows nothing', () => {
  const r = checkIssueDraft({ title: 'Add a chart', body: GOOD });
  assert.deepEqual([r.ok, r.allowPaths], [true, []]);
});

test('the template placeholders of Out of scope and Allow-paths are recognised as template text', () => {
  const left = (text) => checkIssueDraft({ title: 'Add a chart', body: `${GOOD}\n${text}\n` }).problems.join(' ');
  assert.match(left('- <what is deliberately left out, with the issue that covers it when there is one>'), /template text/);
  assert.match(left('Allow-paths: <dependency files the change may touch, for example pubspec.yaml, pubspec.lock>'), /template text/);
});

test('the CLI prints what the issue allows and takes the rules file from --rules-file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-allow-'));
  const file = join(dir, 'issue.md');
  writeFileSync(file, WITH_ALLOW('Allow-paths: pubspec.lock'));
  const cli = new URL('../scripts/check-issue.mjs', import.meta.url).pathname;
  const ok = spawnSync('node', [cli, '--title', 'Add a chart', '--body-file', file], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /allows changes to pubspec\.lock/);
  writeFileSync(file, WITH_ALLOW('Allow-paths: docs/rules.md'));
  const bad = spawnSync('node', [cli, '--title', 'Add a chart', '--body-file', file, '--rules-file', 'docs/rules.md'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /docs\/rules\.md/);
});

test('Scenario: the platform of a draft is checked when the registry is given', () => {
  const two = { web: {}, api: {} };
  const missing = checkIssueDraft({ title: 'Add a chart', body: GOOD, platforms: two });
  assert.equal(missing.ok, false);
  assert.match(missing.problems.join('\n'), /the body has no Platform: line naming one of the platforms of relevo\.yml \(web, api\)/);
  const unknown = checkIssueDraft({ title: 'Add a chart', body: `${GOOD}\nPlatform: mobile\n`, platforms: two });
  assert.match(unknown.problems.join('\n'), /Platform: mobile, which is not a platform of relevo\.yml/);
  const both = checkIssueDraft({ title: 'Add a chart', body: `${GOOD}\nPlatform: web\nPlatform: api\n`, platforms: two });
  assert.match(both.problems.join('\n'), /names two platforms/);
  assert.equal(checkIssueDraft({ title: 'Add a chart', body: `${GOOD}\nPlatform: web\n`, platforms: two }).ok, true);
  assert.equal(checkIssueDraft({ title: 'Add a chart', body: GOOD, platforms: { app: {} } }).ok, true, 'one platform needs no line');
  assert.equal(checkIssueDraft({ title: 'Add a chart', body: GOOD }).ok, true, 'without the registry nothing about platforms is checked');
});

test('the template text of the Platform line is caught when it was not filled in', () => {
  const r = checkIssueDraft({ title: 'Add a chart', body: `${GOOD}\nPlatform: <name of a platform in relevo.yml>\n` });
  assert.match(r.problems.join('\n'), /still contains template text/);
});

test('Scenario: Not linked - a Depends-on on a repository outside links fails the check, naming it and the linked ones', () => {
  const body = `${GOOD}\nDepends-on: other/repo#4\n`;
  const r = checkIssueDraft({ title: 'Add a chart', body, links: ['acme/api', 'acme/design'] });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /Depends-on names other\/repo, which is not in links of relevo\.yml \(acme\/api, acme\/design\)/);
  assert.deepEqual(r.dependsOnExternal, [{ repo: 'other/repo', number: 4 }]);
  const none = checkIssueDraft({ title: 'Add a chart', body });
  assert.match(none.problems.join('\n'), /no repository is linked/, 'without links every external reference is judged as not linked');
});

test('a linked repository passes, and a local reference needs no links', () => {
  assert.equal(checkIssueDraft({ title: 'Add a chart', body: `${GOOD}\nDepends-on: acme/api#12, #3\n`, links: ['acme/api'] }).ok, true);
  assert.equal(checkIssueDraft({ title: 'Add a chart', body: `${GOOD}\nDepends-on: #3\n` }).ok, true);
});

test('Scenario: Malformed - a token that looks like a repository but is not a reference fails, showing the accepted forms', () => {
  const r = checkIssueDraft({ title: 'Add a chart', body: `${GOOD}\nDepends-on: acme/api 12\n`, links: ['acme/api'] });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /Depends-on has "acme\/api", which is not a reference; write #12 for an issue of this repository or owner\/repo#12/);
});

// ---------- issue format v2

const V2 = `${GOOD}
## Outcome
The list shows today's birthdays.

## Decisions

### D1. Sort by name
Decided: by name
Why: people look for a person
Discarded: by date (nobody asked)

## Constraints

- C1: the list loads in under one second

## Assumptions

- Birthdays are read from the clients table.
`;

test('Scenario: Earlier issue - a body with only the earlier sections passes as it did', () => {
  assert.equal(checkIssueDraft({ title: 'Birthday list', body: GOOD }).ok, true);
});

test('Scenario: Decision with its reason - a draft with the new sections passes and reports the ids', () => {
  const r = checkIssueDraft({ title: 'Birthday list', body: V2 });
  assert.deepEqual(r.problems, []);
  const parsed = parseIssueBody(V2);
  assert.deepEqual(parsed.decisionIds, ['D1']);
  assert.deepEqual(parsed.constraintIds, ['C1']);
});

test('Scenario: Open question - a question under Open questions fails the check and names the section', () => {
  const r = checkIssueDraft({ title: 'Birthday list', body: `${V2}\n## Open questions\n\n- Should clients without a phone be listed?\n` });
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /open questions \(1\).*Should clients without a phone be listed/);
});

test('an Open questions section that says none, or holds only a comment, does not block', () => {
  assert.equal(checkIssueDraft({ title: 'Birthday list', body: `${V2}\n## Open questions\n\nNone\n` }).ok, true);
  assert.equal(checkIssueDraft({ title: 'Birthday list', body: `${V2}\n## Open questions\n\n<!-- questions that are still open -->\n` }).ok, true);
});

test('NEEDS CLARIFICATION anywhere outside code blocks fails; inside a code block it does not', () => {
  assert.match(checkIssueDraft({ title: 'x', body: `${GOOD}\nNEEDS CLARIFICATION: the order\n` }).problems.join('\n'), /NEEDS CLARIFICATION/);
  assert.equal(checkIssueDraft({ title: 'x', body: `${GOOD}\n\`\`\`\nNEEDS CLARIFICATION\n\`\`\`\n` }).ok, true);
});

test('Scenario: Repeated id - two decisions with the same id fail, and so does a malformed one', () => {
  const twice = checkIssueDraft({ title: 'x', body: `${GOOD}\n## Decisions\n\n### D1. A\nDecided: a\n\n### D1. B\nDecided: b\n` });
  assert.match(twice.problems.join('\n'), /decision id D1 is repeated/);
  const bad = checkIssueDraft({ title: 'x', body: `${GOOD}\n## Decisions\n\n### D. A\nDecided: a\n` });
  assert.match(bad.problems.join('\n'), /is not a decision/);
  assert.equal(checkIssueDraft({ title: 'x', body: `${GOOD}\n## Decisions\n\n### Database choice\nDecided: sqlite\n` }).ok, true, 'a heading that merely starts with D is not an id');
  const c = checkIssueDraft({ title: 'x', body: `${GOOD}\n## Constraints\n\n- C1: fast\n- C1: also fast\n- C2 slow\n` });
  assert.match(c.problems.join('\n'), /constraint id C1 is repeated/);
  assert.match(c.problems.join('\n'), /is not a constraint/);
});

test('Scenario: Long body - it passes with a warning about the length', () => {
  const long = checkIssueDraft({ title: 'x', body: `${GOOD}\n## Assumptions\n\n${'a long line of text. '.repeat(500)}\n` });
  assert.equal(long.ok, true);
  assert.match(long.warnings.join('\n'), /characters/);
  assert.deepEqual(checkIssueDraft({ title: 'x', body: GOOD }).warnings, []);
});

test('the CLI prints the warning and still exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  writeFileSync(join(dir, 'long.md'), `${GOOD}\n## Assumptions\n\n${'a long line of text. '.repeat(500)}\n`);
  const r = spawnSync('node', [new URL('../scripts/check-issue.mjs', import.meta.url).pathname, '--title', 'x', '--body-file', join(dir, 'long.md')], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /warning:.*characters/);
});

// ---------- the template and the format page

test('the template with its placeholders filled in and its optional comments kept passes the check', () => {
  const template = readFileSync(new URL('../templates/issue.md', import.meta.url), 'utf8');
  const filled = template
    .replace('<the situation>', 'a client has a birthday today')
    .replace('<the result a person can observe>', 'the list shows the name')
    .replace('<unusual input or state>: <what must happen>', 'no phone: the send button is disabled')
    .replace(/<what is deliberately left out[^>]*>/, 'sending messages: another issue')
    .replace('<decision title>', 'Sort by name')
    .replace('<what was decided>', 'by name')
    .replace('<the reason>', 'people look for a person')
    .replace('<the alternative> (<why not>)', 'by date (nobody asked)')
    .replace('<a concrete limit>', 'loads in under one second')
    .replace('`<path/to/file>`: <why it matters>', '`lib/clients.dart`: reads the clients')
    .replace('<what only a person can check, and with which data>', 'scroll with the account demo')
    .replace('<an assumption>', 'birthdays come from the clients table')
    .replace('`<path/to/reference>`: <what must match>', '`design/home.png`: structure and colour of the list')
    // the optional lines for other cases are removed
    .replace(/## Documentation[\s\S]*$/, '');
  const r = checkIssueDraft({ title: 'Something', body: filled });
  assert.deepEqual(r.problems, []);
});

test('every section heading the format page shows in a code block is one the scripts can read', () => {
  const page = readFileSync(new URL('../docs/issue-format.md', import.meta.url), 'utf8');
  const known = new Set(['Summary', 'Outcome', 'Scenarios', 'Edge cases', 'Out of scope', 'Decisions', 'Constraints', 'Code pointers', 'Verification',
    'Assumptions', 'Open questions', 'Screens and behaviour', 'Data contract', 'Design reference', 'Documentation']);
  const shown = [...page.matchAll(/^## (.+)$/gm)].map((m) => m[1]).filter((h) => !h.startsWith('What ') && !h.startsWith('Writing'));
  shown.forEach((h) => assert.ok(known.has(h), `docs/issue-format.md shows a section "${h}" that the format does not define`));
  [...known].filter((h) => ['Outcome', 'Decisions', 'Constraints', 'Code pointers', 'Verification', 'Assumptions', 'Open questions'].includes(h))
    .forEach((h) => assert.ok(page.includes(`## ${h}`), `docs/issue-format.md does not show ${h}`));
});


// ---------- design reference

const REF_DIR = mkdtempSync(join(tmpdir(), 'relevo-ref-'));
mkdirSync(join(REF_DIR, 'design'), { recursive: true });
writeFileSync(join(REF_DIR, 'design', 'home.png'), 'x');
const withRef = (refs) => `${GOOD}\n## Design reference\n\n${refs}\n`;
const refCheck = (refs, extra = {}) => checkIssueDraft({ title: 'Home', body: withRef(refs), repoRoot: REF_DIR, ...extra });

test('Scenario: File of the repository - a reference to a file that exists passes and is read', () => {
  const r = refCheck('- `design/home.png`: structure, spacing and colour of the list');
  assert.deepEqual(r.problems, []);
  const parsed = parseIssueBody(withRef('- `design/home.png`: structure, spacing and colour of the list'));
  assert.deepEqual(parsed.design.references, [{ target: 'design/home.png', match: 'structure, spacing and colour of the list', kind: 'path', path: 'design/home.png' }]);
});

test('Scenario: File that does not exist - the check fails and names the bullet', () => {
  const r = refCheck('- `design/missing.png`: the home screen');
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /Design reference: "design\/missing\.png" does not exist in the repository/);
});

test('without a repository folder the existence is not checked (the planning job has no checkout)', () => {
  assert.equal(checkIssueDraft({ title: 'Home', body: withRef('- `design/missing.png`: the home screen') }).ok, true);
});

test('a path that leaves the repository is refused whatever the folder', () => {
  ['../secret.png', '/etc/passwd', 'design/../../x.png'].forEach((p) => {
    const r = refCheck(`- \`${p}\`: the screen`);
    assert.match(r.problems.join('\n'), /leaves the repository/, p);
  });
});

test('Scenario: Repository not linked - a file of a repository outside links is refused, one inside passes', () => {
  const bad = refCheck('- `acme/design:components/Card.vue`: the card');
  assert.match(bad.problems.join('\n'), /acme\/design.*not in links of relevo\.yml/);
  assert.deepEqual(refCheck('- `acme/design:components/Card.vue`: the card', { links: ['acme/design'] }).problems, []);
});

test('an attachment passes on the GitHub domains and fails anywhere else', () => {
  assert.deepEqual(refCheck('- https://github.com/user-attachments/assets/0a1b2c3d-1111-2222-3333-444455556666: the empty state').problems, []);
  assert.deepEqual(refCheck('- https://private-user-images.githubusercontent.com/1/2.png?jwt=abc: the empty state').problems, []);
  assert.deepEqual(refCheck('- https://user-images.githubusercontent.com/1/2.png: the empty state').problems, []);
  assert.match(refCheck('- https://evil.example.com/a.png: the empty state').problems.join('\n'), /not a GitHub attachment/);
  assert.match(refCheck('- https://github.com/some/repo/raw/main/a.png: the empty state').problems.join('\n'), /not a GitHub attachment/);
});

test('Scenario: Nothing says what must match - a bullet with only a path fails', () => {
  const r = refCheck('- `design/home.png`');
  assert.match(r.problems.join('\n'), /"design\/home\.png" does not say what must match/);
  assert.match(refCheck('- `design/home.png`:').problems.join('\n'), /does not say what must match/);
});

test('a bullet that is not a reference is reported, and example code needs no bullet', () => {
  assert.match(refCheck('- make it look nice').problems.join('\n'), /is not a reference/);
  const withCode = `${withRef('- `design/home.png`: the layout')}\n\`\`\`vue\n<template><p>x</p></template>\n\`\`\`\n`;
  const r = checkIssueDraft({ title: 'Home', body: withCode, repoRoot: REF_DIR });
  assert.deepEqual(r.problems, []);
  assert.equal(parseIssueBody(withCode).design.code, 1);
});

test('the sixth reference fails', () => {
  const six = Array.from({ length: 6 }, (_, i) => `- \`design/home.png\`: part ${i}`).join('\n');
  assert.match(refCheck(six).problems.join('\n'), /6 references; the most Relevo takes is 5/);
  assert.deepEqual(refCheck(six.split('\n').slice(0, 5).join('\n')).problems, []);
});

test('an issue without the section is untouched, and the CLI takes --repo-root', () => {
  assert.equal(parseIssueBody(GOOD).design.present, false);
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  writeFileSync(join(dir, 'a.md'), withRef('- `design/home.png`: the list'));
  const cli = new URL('../scripts/check-issue.mjs', import.meta.url).pathname;
  assert.equal(spawnSync('node', [cli, '--title', 'x', '--body-file', join(dir, 'a.md'), '--repo-root', REF_DIR], { encoding: 'utf8' }).status, 0);
  const missing = spawnSync('node', [cli, '--title', 'x', '--body-file', join(dir, 'a.md'), '--repo-root', dir], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /does not exist in the repository/);
});

// ---------- code pointers of linked repositories

const withPointers = (pointers, refs = '') => `${GOOD}\n## Code pointers\n\n${pointers}\n${refs ? `\n## Design reference\n\n${refs}\n` : ''}`;
const pointerCheck = (pointers, extra = {}) => checkIssueDraft({ title: 'Home', body: withPointers(pointers, extra.refs), repoRoot: REF_DIR, links: extra.links ?? [] });

test('Scenario: Linked pointer - a file of a linked repository passes and is read as a reference', () => {
  assert.deepEqual(pointerCheck('- `acme/api:src/billing/charge.ts`: how an order is charged', { links: ['acme/api'] }).problems, []);
  const parsed = parseIssueBody(withPointers('- `acme/api:src/billing/charge.ts`: how an order is charged'));
  assert.deepEqual(parsed.codePointers.references, [{ kind: 'repo-file', target: 'acme/api:src/billing/charge.ts', repo: 'acme/api', path: 'src/billing/charge.ts', match: 'how an order is charged' }]);
});

test('Scenario: Pointer to a repository not linked - the check names it and lists the linked ones', () => {
  const r = pointerCheck('- `other/repo:src/x.ts`: the parser', { links: ['acme/api'] });
  assert.match(r.problems.join('\n'), /Code pointers: "other\/repo:src\/x\.ts" names other\/repo, which is not in links of relevo\.yml \(acme\/api\)/);
});

test('Scenario: Pointer to this repository - local pointers and free text are not read', () => {
  const body = withPointers('- `src/app.ts`: the entry point\n- the store keeps the cart in memory\n- `does/not/exist.ts`: gone');
  assert.deepEqual(checkIssueDraft({ title: 'Home', body, repoRoot: REF_DIR }).problems, []);
  assert.deepEqual(parseIssueBody(body).codePointers.references, []);
});

test('a linked pointer that leaves the repository is refused', () => {
  assert.match(pointerCheck('- `acme/api:../secret.ts`: x', { links: ['acme/api'] }).problems.join('\n'), /Code pointers: "acme\/api:\.\.\/secret\.ts" leaves the repository/);
});

test('Scenario: Six references across both sections - design references and linked pointers count together', () => {
  const refs = Array.from({ length: 3 }, (_, i) => `- \`design/home.png\`: part ${i}`).join('\n');
  const pointers = Array.from({ length: 3 }, (_, i) => `- \`acme/api:src/f${i}.ts\`: step ${i}`).join('\n');
  assert.match(pointerCheck(pointers, { refs, links: ['acme/api'] }).problems.join('\n'), /Design reference and the linked Code pointers have 6 references together; the most Relevo takes is 5/);
  assert.deepEqual(pointerCheck(pointers.split('\n').slice(0, 2).join('\n'), { refs, links: ['acme/api'] }).problems, []);
});
