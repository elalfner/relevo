import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

// Claude Code ignores unknown frontmatter fields without any warning, so a typo
// would silently disable a setting. These tests pin the field names we rely on.
const KNOWN_FIELDS = new Set([
  'name', 'description', 'tools', 'disallowedTools', 'model', 'effort', 'maxTurns', 'permissionMode',
  'skills', 'mcpServers', 'hooks', 'memory', 'background', 'omitClaudeMd', 'isolation', 'color', 'initialPrompt', 'experimental',
]);
const EFFORT = ['low', 'medium', 'high', 'xhigh', 'max'];

function load(name) {
  const text = readFileSync(new URL(`../agents/${name}.md`, import.meta.url), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, `${name}.md must start with YAML frontmatter`);
  return { meta: parse(m[1]), body: m[2] };
}

for (const name of ['dev', 'qa']) {
  test(`${name}: frontmatter uses only documented fields and sane values`, () => {
    const { meta } = load(name);
    Object.keys(meta).forEach((k) => assert.ok(KNOWN_FIELDS.has(k), `unknown frontmatter field "${k}"`));
    assert.equal(meta.name, name);
    assert.ok(String(meta.description).length >= 80, 'description must say when to use the agent');
    assert.equal(meta.model, 'sonnet');
    assert.ok(EFFORT.includes(meta.effort));
  });

  test(`${name}: plugin agents must not rely on fields that are ignored for plugins`, () => {
    const { meta } = load(name);
    ['hooks', 'mcpServers', 'permissionMode'].forEach((k) => assert.ok(!(k in meta), `${k} is ignored for plugin agents`));
  });
}

test('qa is read-only: it cannot write or edit files', () => {
  const { meta } = load('qa');
  const denied = String(meta.disallowedTools).split(',').map((s) => s.trim());
  ['Write', 'Edit', 'NotebookEdit'].forEach((t) => assert.ok(denied.includes(t), `qa must disallow ${t}`));
  assert.ok(!('tools' in meta), 'qa must not restrict tools with an allow-list: it needs the tooling server tools');
});

test('qa output contract: first line is QA PASSED or QA REJECTED', () => {
  const { body } = load('qa');
  assert.match(body, /first line is exactly\*\* `QA PASSED` or `QA REJECTED`/);
});

test('qa never passes code it could not check (spec: Validation tooling missing)', () => {
  const { body } = load('qa');
  assert.match(body, /automated validation could not run/);
  assert.match(body, /Never pass code you could not check/);
});

test('qa defers device-only scenarios to on-device review (spec: Device-only scenario)', () => {
  const { body } = load('qa');
  assert.match(body, /left for on-device review/);
});

test('qa checks tasks, scenarios and project rules read from the rules file', () => {
  const { body } = load('qa');
  assert.match(body, /\[x\]/);
  assert.match(body, /qa\.rules_from/);
  assert.match(body, /Never assume a rule from memory/);
});

test('dev never commits, never edits the specification and never automates the device', () => {
  const { body } = load('dev');
  assert.match(body, /run `git commit`, `git push`, `git add`/);
  assert.match(body, /edit anything under `openspec\/` other than the checkboxes in `tasks\.md`/);
  assert.match(body, /automate the app or the device/);
});

test('dev stops on an ambiguous specification instead of guessing', () => {
  const { body } = load('dev');
  assert.match(body, /stop and report what is unclear/);
});

test('both agents run the commands of the profile they are given and do not name a tool of one stack', () => {
  ['dev', 'qa'].forEach((n) => {
    const { body } = load(n);
    assert.match(body, /commands of the profile/);
    assert.match(body, /stack-profile\.mjs/);
  });
});

test('Scenario: the agents are generic - no word of one stack, which lives in stacks/<stack>.md', () => {
  ['dev', 'qa'].forEach((n) => {
    const text = readFileSync(new URL(`../agents/${n}.md`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /flutter|dart|android|\badb\b|freezed|setstate|buildcontext/i, `agents/${n}.md names a stack`);
  });
});

test('Scenario: Developer edits the configuration - dev must not, qa rejects', () => {
  const dev = load('dev').body;
  const qa = load('qa').body;
  assert.match(dev, /edit `relevo\.yml`, anything under `\.relevo\/` or `skills-lock\.json`/);
  assert.match(qa, /a change to `relevo\.yml`, to anything under `\.relevo\/` or to `skills-lock\.json`/);
  assert.match(qa, /Reject it and cite the file/);
});

test('the agents take the skills of the role as paths, and let the rules of Relevo and the project win', () => {
  ['dev', 'qa'].forEach((n) => {
    const { body } = load(n);
    assert.match(body, /extra skills for your role/);
    assert.match(body, /rules of Relevo and (of )?the project win over any skill/);
  });
});

test('neither agent mentions private sources or personal data', () => {
  ['dev', 'qa'].forEach((n) => {
    const text = readFileSync(new URL(`../agents/${n}.md`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /claude\.ai|session_[0-9A-Za-z]{6}|co-authored/i);
  });
});

test('Scenario: Glossary entries and A decision record - dev writes exactly the documentation the change gives, and numbers records', () => {
  const { body } = load('dev');
  assert.match(body, /## Documentation from the issue/);
  assert.match(body, /heading `Documentation from the issue`, write exactly the text under it and nothing else/);
  assert.match(body, /after the existing ones/);
  assert.match(body, /`docs\/adr\/NNNN-short-title\.md`.*highest number already in that folder plus one/);
  assert.match(body, /Do not reword an entry/);
  assert.match(body, /Without that heading, never touch `GLOSSARY\.md` or `docs\/adr\/`/);
  assert.match(body, /change `GLOSSARY\.md` or anything under `docs\/adr\/` except as the section above describes/);
});

test('Scenario: The agent rewords an entry / Other lines change / Documentation nobody asked for - qa checks the documentation against the issue', () => {
  const { body } = load('qa');
  assert.match(body, /### 6\. Documentation/);
  assert.match(body, /heading `Documentation from the issue` in `design\.md`/);
  assert.match(body, /Reject when an added word differs, when any other line of `GLOSSARY\.md` changed, when an existing record changed/);
  assert.match(body, /number is not the highest existing number plus one/);
  assert.match(body, /If it is not there, reject a diff that touches `GLOSSARY\.md` or `docs\/adr\/`/);
  assert.match(body, /Do not judge the vocabulary itself/);
});

test('qa stays read-only after the documentation check', () => {
  const { meta } = load('qa');
  assert.match(String(meta.disallowedTools), /Write/);
  assert.match(String(meta.disallowedTools), /Edit/);
});

test('Scenario: the agents have a read-only OpenSpec section and use the shared test flags', () => {
  const dev = readFileSync(new URL('../agents/dev.md', import.meta.url), 'utf8');
  const qa = readFileSync(new URL('../agents/qa.md', import.meta.url), 'utf8');
  [dev, qa].forEach((t) => {
    assert.match(t, /## OpenSpec commands/);
    assert.match(t, /openspec instructions apply --change/);
  });
  assert.match(dev, /Allow-paths:/);
  assert.match(dev, /Install with the tool's no-scripts option/);
  assert.match(qa, /git diff origin\/<base> -- \. ':\(exclude\)<generated>'/);
  assert.match(qa, /`generated` in the profile/);
  assert.match(qa, /you never change the index or any file/);
  assert.match(qa, /You still run analysis and all tests/);
});

test('Scenario: Monorepo - both agents get the folder of the platform and the work stays inside it', () => {
  const dev = load('dev').body;
  const qa = load('qa').body;
  assert.match(dev, /the folder of the platform \(`path` of the profile output\): run the commands of the profile from it, and change files only inside it/);
  assert.match(dev, /the commit is refused for any other path/);
  assert.match(qa, /the folder of the platform \(run the commands of the profile from it\)/);
  assert.match(qa, /\*\*Platform\*\*: a file changed outside the folder of the platform/);
  assert.match(qa, /unless the issue lists that path in `Allow-paths:`/);
});

// ---------- issue format v2

test('Scenario: Decision broken / Section reworded - QA applies the decisions and constraints by id and compares the copied sections', () => {
  const qa = readFileSync(new URL('../agents/qa.md', import.meta.url), 'utf8');
  assert.match(qa, /### 7\. Decisions and constraints from the issue/);
  assert.match(qa, /headings that start `From the issue:`/);
  assert.match(qa, /issue-sections\.mjs --body-file <issue_file> --copy/);
  assert.match(qa, /Reject a reworded, shortened or reordered section and cite the section/);
  assert.match(qa, /citing its id \(`D2`, `C1`\)/);
  assert.match(qa, /A decision under `Discarded` is not a rule/);
  assert.match(qa, /`Verification` is for the person's review/);
  assert.match(qa, /the saved body of the issue \(`issue_file`\)/);
});

test('the developer treats the decisions and constraints as binding and reports a conflict instead of choosing', () => {
  const dev = readFileSync(new URL('../agents/dev.md', import.meta.url), 'utf8');
  assert.match(dev, /## Decisions and constraints from the issue/);
  assert.match(dev, /binding/);
  assert.match(dev, /report it as an open question with its id/);
  assert.match(dev, /Never edit those sections/);
});
