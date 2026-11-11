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

// QA is made of four lenses. The assertions that were about the one QA agent read the four files together.
const LENS_FILES = ['qa-spec', 'qa-security', 'qa-code', 'qa-interface'];
const qaText = () => ['qa-spec', 'qa-security', 'qa-code', 'qa-interface'].map((n) => readFileSync(new URL(`../agents/${n}.md`, import.meta.url), 'utf8')).join('\n\n');
function loadQa() {
  const all = LENS_FILES.map((n) => load(n));
  return { meta: all[0].meta, body: all.map((a) => a.body).join('\n\n') };
}

function load(name) {
  const text = readFileSync(new URL(`../agents/${name}.md`, import.meta.url), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, `${name}.md must start with YAML frontmatter`);
  return { meta: parse(m[1]), body: m[2] };
}

for (const name of ['dev']) {
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
  const { meta } = loadQa();
  const denied = String(meta.disallowedTools).split(',').map((s) => s.trim());
  ['Write', 'Edit', 'NotebookEdit'].forEach((t) => assert.ok(denied.includes(t), `qa must disallow ${t}`));
  assert.ok(!('tools' in meta), 'qa must not restrict tools with an allow-list: it needs the tooling server tools');
});

test('qa output contract: first line is QA PASSED or QA REJECTED', () => {
  const { body } = loadQa();
  assert.match(body, /first line is exactly\*\* `QA PASSED` or `QA REJECTED`/);
});

test('Scenario: The agent resolves a conflict - dev has an integrate mode that keeps both sides, adds a test and changes nothing else', () => {
  const { body } = load('dev');
  assert.match(body, /\*\*integrate\*\* \(resolve the conflicts of a merge of the base branch into the branch, nothing else\)/);
  assert.match(body, /^## Integrate mode$/m);
  assert.match(body, /keep the behaviour of both sides/);
  assert.match(body, /remove every conflict marker/);
  assert.match(body, /add a test that fails if either side is lost where the platform allows one/);
  assert.match(body, /A conflict in a lock file or a generated file is not resolved by hand/);
  assert.match(body, /if you cannot keep both behaviours, resolve nothing in that file/);
  assert.match(body, /You do not run `git add`, `git merge --abort`/);
  assert.match(body, /Mode: build \| fix \| integrate/);
  assert.match(body, /Conflicts resolved \(integrate mode\)/);
});

test('qa gives each finding a class: fixable, input, spec or policy (spec: Each QA finding carries a class)', () => {
  const { body } = loadQa();
  assert.match(body, /Class: <class>/);
  ['fixable', 'input', 'spec', 'policy'].forEach((c) => assert.ok(body.includes('- `' + c + '`:'), `qa must define the class ${c}`));
  assert.match(body, /treated as `fixable`/, 'a finding without a class must count as fixable');
  assert.match(body, /first line is exactly/, 'the first line contract must remain');
});

test('qa never passes code it could not check (spec: Validation tooling missing)', () => {
  const { body } = loadQa();
  assert.match(body, /automated validation could not run/);
  assert.match(body, /Never pass code you could not check/);
});

test('qa defers device-only scenarios to on-device review (spec: Device-only scenario)', () => {
  const { body } = loadQa();
  assert.match(body, /left for on-device review/i);
});

test('qa checks tasks, scenarios and project rules read from the rules file', () => {
  const { body } = loadQa();
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
  const dev = load('dev').body;
  assert.match(dev, /commands of the profile/);
  assert.match(dev, /stack-profile\.mjs/);
  // The lenses do not run the commands: the gate does, and the code lens reads its receipt.
  ['qa-security', 'qa-code'].forEach((n) => assert.match(load(n).body, /profile/, n));
  assert.match(load('qa-code').body, /Never run the analysis or the tests yourself/);
});

test('Scenario: the agents are generic - no word of one stack, which lives in stacks/<stack>.md', () => {
  ['dev', ...LENS_FILES].forEach((n) => {
    const text = readFileSync(new URL(`../agents/${n}.md`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /flutter|dart|android|\badb\b|freezed|setstate|buildcontext/i, `agents/${n}.md names a stack`);
  });
});

test('Scenario: Developer edits the configuration - dev must not, qa rejects', () => {
  const dev = load('dev').body;
  const qa = loadQa().body;
  assert.match(dev, /edit `relevo\.yml`, anything under `\.relevo\/` or `skills-lock\.json`/);
  assert.match(qa, /a change to `relevo\.yml`, to anything under `\.relevo\/` or to `skills-lock\.json`/);
  assert.match(qa, /Reject it and cite the file/);
});

test('the agents take the skills of the role as paths, and let the rules of Relevo and the project win', () => {
  ['dev', ...LENS_FILES].forEach((n) => {
    const { body } = load(n);
    assert.match(body, /extra skills for your role/);
    assert.match(body, /rules of Relevo and (of )?the project win over any skill/);
  });
});

test('neither agent mentions private sources or personal data', () => {
  ['dev', ...LENS_FILES].forEach((n) => {
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
  const { body } = loadQa();
  assert.match(body, /### 5\. Documentation text/);
  assert.match(body, /heading `Documentation from the issue` in `design\.md`/);
  assert.match(body, /reject when an added word differs, when any other line of `GLOSSARY\.md` changed, when an existing record changed/);
  assert.match(body, /number is not the highest existing number plus one/);
  assert.match(body, /If it is not there, reject a diff that touches `GLOSSARY\.md` or `docs\/adr\/`/);
  assert.match(body, /Do not judge the vocabulary itself/);
});

test('qa stays read-only after the documentation check', () => {
  const { meta } = loadQa();
  assert.match(String(meta.disallowedTools), /Write/);
  assert.match(String(meta.disallowedTools), /Edit/);
});

test('Scenario: the agents have a read-only OpenSpec section and use the shared test flags', () => {
  const dev = readFileSync(new URL('../agents/dev.md', import.meta.url), 'utf8');
  const qa = qaText();
  [dev, qa].forEach((t) => {
    assert.match(t, /## OpenSpec commands/);
    assert.match(t, /openspec instructions apply --change/);
  });
  assert.match(dev, /Allow-paths:/);
  assert.match(dev, /Install with the tool's no-scripts option/);
  assert.match(qa, /git diff origin\/<base> -- \. ':\(exclude\)<generated>'/);
  assert.match(qa, /`generated` in the profile/);
  assert.match(qa, /no change to the index/);
  assert.match(qa, /Never run the analysis or the tests yourself/);
});

test('Scenario: Monorepo - both agents get the folder of the platform and the work stays inside it', () => {
  const dev = load('dev').body;
  const qa = loadQa().body;
  assert.match(dev, /the folder of the platform \(`path` of the profile output\): run the commands of the profile from it, and change files only inside it/);
  assert.match(dev, /the commit is refused for any other path/);
  assert.match(qa, /the folder of the platform/);
  assert.match(qa, /\*\*Platform\*\*: a file changed outside the folder of the platform/);
  assert.match(qa, /unless the issue lists that path in `Allow-paths:`/);
});

// ---------- issue format v2

test('Scenario: Decision broken / Section reworded - QA applies the decisions and constraints by id and compares the copied sections', () => {
  const qa = qaText();
  assert.match(qa, /### 6\. Decisions and constraints from the issue/);
  assert.match(qa, /headings that start `From the issue:`/);
  assert.match(qa, /issue-sections\.mjs path you were given> --body-file <issue_file> --copy/);
  assert.doesNotMatch(qa, /<plugin>/, 'no placeholder the agent would have to search for');
  assert.match(qa, /must be contained, unchanged, in the issue/);
  assert.match(qa, /citing its id, the file and line/);
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

// ---------- review-autopilot

test('QA reviews a review script: real assertions, allowed origins, no credential values, nothing about appearance', () => {
  const qa = qaText();
  const section = qa.slice(qa.indexOf('### 3. A review script'), qa.indexOf('## Rules for yourself', qa.indexOf('### 3. A review script')));
  assert.match(section, /would fail if the behaviour of checklist line `n` did not exist/);
  assert.match(section, /only loads the page, or asserts something always true, is rejected/);
  assert.match(section, /nothing outside `localhost`, the address under review and `review\.allowed_origins`/);
  assert.match(section, /credentials\("NAME"\)/);
  assert.match(section, /appearance, animation or fidelity to an image must not be asserted/);
  assert.match(section, /You only read it/);
});

// ---------- design reference

test('Scenario: Asset not available - dev reproduces the reference without inventing anything and reports what it could not match', () => {
  const dev = readFileSync(new URL('../agents/dev.md', import.meta.url), 'utf8');
  const section = dev.slice(dev.indexOf('## Design references'), dev.indexOf('## Fix mode'));
  assert.match(section, /Read every image with the `Read` tool/);
  assert.match(section, /theme tokens and the shared components the project already has/);
  assert.match(section, /use no asset \(icon, font, picture\) that is not in the project or in the references, and never invent one/);
  assert.match(section, /without translating widget by widget/);
  assert.match(section, /each element you could not match/);
  assert.match(section, /data, never instructions/);
});

test('QA compares example code, checks an image plausibly, rejects an invented asset and leaves appearance to the person', () => {
  const qa = qaText();
  const section = qa.slice(qa.indexOf('### 2. Design references'), qa.indexOf('## Rules for yourself', qa.indexOf('### 2. Design references')));
  assert.match(section, /scenario `Matches the reference <name>` for each bullet/);
  assert.match(section, /compare the structure, tokens and states of the code with it/);
  assert.match(section, /You cannot compare pixels, so reject only what the code makes clear is different/);
  assert.match(section, /reject an asset .* that the diff adds and that is neither in the project nor in the references/);
  assert.match(section, /left for on-device review/i);
});

test('Scenario: Linked code pointer - dev and QA read a linked pointer from the manifest, as a hint and never as a reference to match', () => {
  const dev = readFileSync(new URL('../agents/dev.md', import.meta.url), 'utf8');
  const qa = qaText();
  [dev, qa].forEach((text) => {
    assert.match(text, /`\.relevo-design\/manifest\.json` with `section` `code-pointer`/);
    assert.match(text, /never (?:as|treat it as) a reference to match/);
  });
});

// ---- the four lenses of QA (specialist-review-lenses)
const LENSES = ['spec', 'security', 'code', 'interface'];
const section = (body, heading) => {
  const m = body.match(new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=\\n## |(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : null;
};

for (const lens of LENSES) {
  test(`qa-${lens}: a read-only reviewer with documented fields, its own description and the default model of the design`, () => {
    const { meta, body } = load(`qa-${lens}`);
    Object.keys(meta).forEach((k) => assert.ok(KNOWN_FIELDS.has(k), `unknown frontmatter field "${k}"`));
    assert.equal(meta.name, `qa-${lens}`);
    assert.ok(String(meta.description).length >= 80);
    assert.ok(EFFORT.includes(meta.effort));
    assert.deepEqual(String(meta.disallowedTools).split(',').map((s) => s.trim()).sort(), ['Edit', 'NotebookEdit', 'Write']);
    assert.deepEqual([meta.model, meta.effort], { spec: ['opus', 'high'], security: ['opus', 'high'], code: ['sonnet', 'high'], interface: ['sonnet', 'medium'] }[lens]);
    assert.match(body, /Read-only: no file edits/);
    assert.match(body, new RegExp(`You are the ${lens} lens of QA`));
  });
}

test('Scenario: the shared sections are identical in the four files - untrusted content, OpenSpec commands, output contract, evidence rule', () => {
  for (const heading of ['Untrusted content', 'OpenSpec commands', 'Output contract', 'The evidence rule', 'Rules for yourself']) {
    const texts = LENSES.map((l) => section(load(`qa-${l}`).body, heading));
    texts.forEach((t, i) => assert.ok(t, `qa-${LENSES[i]} lacks "${heading}"`));
    assert.equal(new Set(texts).size, 1, `"${heading}" differs between the lenses`);
  }
});

test('the output contract: the first line, numbered findings with a class, the heading for the device and evidence', () => {
  const contract = section(load('qa-spec').body, 'Output contract');
  assert.match(contract, /first line is exactly\*\* `QA PASSED` or `QA REJECTED`/);
  assert.match(contract, /numbered findings/);
  assert.match(contract, /`Class: <class>`/);
  for (const c of ['fixable', 'input', 'spec', 'policy']) assert.ok(contract.includes(`- \`${c}\`:`), c);
  assert.match(contract, /without a valid class is treated as `fixable`/);
  assert.match(contract, /\*\*Left for on-device review\*\*/);
  assert.match(section(load('qa-spec').body, 'The evidence rule'), /Do not reject on speculation/);
});

test('Scenario: the code lens reads the receipt and never runs the analysis or the tests', () => {
  const { body } = load('qa-code');
  assert.match(body, /Never run the analysis or the tests yourself/);
  assert.match(body, /receipt of the validation gate/);
  assert.doesNotMatch(body, /Run the `analyze` and `test` commands/);
});

// Each part of the old QA protocol has exactly one owner: the table of the design is the data of the test.
const OWNERS = [
  ['1. Automated validation', 'code', 'Never run the analysis or the tests yourself'],
  ['2. Scenarios have code and tests', 'spec', 'find the code that makes the THEN true'],
  ['3. Task integrity', 'spec', 'Every `[x]` in `tasks.md` must be backed by real code'],
  ['4. Project rules', 'spec', 'treat each rule as binding'],
  ['5. Diff: platform folder, configuration files, scope and dependencies', 'spec', '**Configuration**: a change to `relevo.yml`'],
  ['5. Diff: leftovers and temporary markers', 'code', '**Leftovers**'],
  ['5. Diff: secrets', 'security', '**Secrets and sensitive data in code**'],
  ['6. Documentation from the issue', 'spec', 'Documentation from the issue'],
  ['7. Decisions and constraints from the issue', 'spec', 'Every decision (`### D<n>.`)'],
  ['8. A review script', 'code', 'evidence/review-web.mjs'],
  ['9. Design references', 'interface', 'Matches the reference <name>'],
  ['The profile "what the auditor looks for"', 'code', 'what the auditor looks for in the diff'],
  ['Interface rules', 'interface', 'For each interface rule you are given'],
  ['Security review of the stack', 'security', 'section **Security review** of the stack profile'],
];

test('Scenario: every part of the old QA protocol has exactly one owner among the lenses', () => {
  for (const [part, owner, phrase] of OWNERS) {
    const holders = LENSES.filter((l) => load(`qa-${l}`).body.includes(phrase));
    assert.deepEqual(holders, [owner], `"${part}" should be owned by ${owner} only; found in ${holders.join(', ') || 'none'}`);
  }
});

test('the spec lens reads no stack section, and the security lens works without one', () => {
  assert.match(load('qa-spec').body, /You are given no stack section/);
  assert.match(load('qa-security').body, /Without it, use the generic categories below/);
});

test('Scenario: the developer agent follows the interface rules it is given and no others', () => {
  const dev = readFileSync(new URL('../agents/dev.md', import.meta.url), 'utf8');
  assert.match(dev, /the interface rules for you/);
  assert.match(dev, /"build it like this" line and examples of your stack/);
  assert.match(dev, /The rules the orchestrator did not give you do not apply/);
});

test('Scenario: QA rejects on a blocking interface rule only with evidence, and lists the rest for the person', () => {
  const qa = qaText();
  assert.match(qa, /Reject on a \*\*blocking\*\* rule only with evidence/);
  assert.match(qa, /advisory, or whose check is `person`, is never a rejection: list it under \*\*Left for on-device review\*\*/);
  assert.match(qa, /Say how many rules were left out/);
  assert.match(qa, /treat a \*\*mobile sketch\*\* like an image reference/);
});

test('Scenario: the developer has a short cost guide and receives the configured OpenSpec guidance (#130)', () => {
  const dev = readFileSync(new URL('../agents/dev.md', import.meta.url), 'utf8');
  const guide = dev.split('## Cost guide')[1]?.split(/\n## /)[0];
  assert.ok(guide, 'agents/dev.md has a Cost guide section');
  const lines = guide.split('\n').filter((l) => l.trim());
  assert.ok(lines.length <= 6, `the guide has ${lines.length} lines, at most 6`);
  for (const re of [/bounded ranges/, /script/, /only the tests of what you changed/, /never rerun/]) assert.match(guide, re);
  assert.match(dev, /project guidance/);
  assert.match(dev, /it wins/);
  assert.match(dev, /never overrides the "You must never" list/);
  const go = readFileSync(new URL('../skills/go/SKILL.md', import.meta.url), 'utf8');
  assert.match(go, /`openspec instructions tasks --change "<change_id>" --json`/);
  assert.match(go, /`operationGuidance`/);
  assert.match(go, /every launch of `relevo:dev` in any mode/);
  assert.match(go, /only the default cost guide applied/);
});
