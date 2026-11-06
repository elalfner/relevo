import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';
import { LABEL_KEYS } from '../scripts/lib/labels.mjs';
import { MESSAGE_KINDS } from '../scripts/lib/messages.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const text = readFileSync(root('skills/go/SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const meta = parse(front);
const ref = readFileSync(root('skills/go/references/qa-run.md'), 'utf8');

// Claude Code ignores unknown skill fields silently, so a typo would disable a setting unnoticed.
const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'go');
  assert.equal(meta['argument-hint'], '[issue-number] [--local] [--retry] [--decision <base64>]');
});

test('go pushes code and spends money, so Claude can never start it on its own', () => {
  assert.equal(meta['disable-model-invocation'], true);
  assert.match(meta.description, /never starts on its own/);
  assert.ok(String(meta.description).length <= 1536);
});

test('every script the skill runs exists', () => {
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 5);
  new Set(scripts).forEach((s) => assert.ok(existsSync(root(`scripts/${s}`)), `scripts/${s} is referenced but does not exist`));
});

test('the checklist comes from the shared script, so go and review always agree', () => {
  assert.match(body, /scripts\/checklist\.mjs openspec\/changes\/<change_id> --count/);
  assert.match(body, /scripts\/checklist\.mjs openspec\/changes\/<change_id>`/);
});

test('every agent the skill launches exists', () => {
  const agents = [...body.matchAll(/`relevo:([a-z-]+)`/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(agents)].sort(), ['dev', 'qa-code', 'qa-interface', 'qa-security', 'qa-spec']);
  new Set(agents).forEach((a) => assert.ok(existsSync(root(`agents/${a}.md`)), `agents/${a}.md is missing`));
  assert.equal(existsSync(root('agents/qa.md')), false, 'the former QA agent is gone');
  [...ref.matchAll(/`relevo:([a-z-]+)`/g)].filter((m) => m[1] !== 'qa-notes').forEach((m) => assert.ok(existsSync(root(`agents/${m[1]}.md`)), `the reference launches ${m[1]}, which is missing`));
});

test('every go-plan flag the skill uses is implemented', () => {
  const source = readFileSync(root('scripts/go-plan.mjs'), 'utf8');
  const used = [...body.matchAll(/go-plan\.mjs([^\n`]*)/g)].flatMap((m) => [...m[1].matchAll(/--([a-z]+)/g)].map((f) => f[1]));
  assert.ok(used.includes('claim') && used.includes('only') && used.includes('apply'));
  new Set(used).forEach((f) => assert.ok(source.includes(`'${f}'`) || source.includes(`--${f}`), `go-plan does not implement --${f}`));
});

test('every label the skill moves an issue to is a real label key', () => {
  const keys = [...body.matchAll(/label-change\.mjs --to ([\w-]+)/g)].map((m) => m[1]);
  assert.ok(keys.includes('qa-failed') && keys.includes('built') && keys.includes('needs-spec'));
  new Set(keys).forEach((k) => assert.ok(LABEL_KEYS.includes(k), `"${k}" is not a label key`));
});

test('every message the skill renders is a real message kind', () => {
  const kinds = [...body.matchAll(/render-message\.mjs (\w+)/g)].map((m) => m[1]);
  assert.ok(kinds.includes('qa_failed') && kinds.includes('built') && kinds.includes('needs_spec'));
  new Set(kinds).forEach((k) => assert.ok(MESSAGE_KINDS.includes(k), `"${k}" is not a message kind`));
});

test('safety rules are stated', () => {
  assert.match(body, /never approve, merge or open a pull request/);
  assert.match(body, /never force-push/i);
  assert.match(body, /Do not push/);
  assert.match(body, /Never use `git add \.` or `-A`/);
  assert.match(body, /Do not add links to this session or attribution lines/);
  assert.match(body, /Nobody will answer questions/);
});

test('it uses the OpenSpec command line instead of the interactive propose workflow', () => {
  assert.match(body, /openspec new change/);
  assert.match(body, /openspec instructions/);
  assert.match(body, /openspec validate/);
  assert.match(body, /without the pauses of the interactive `propose` workflow/);
});

test('it points at the issue format document, which exists', () => {
  assert.ok(existsSync(root('docs/issue-format.md')));
});

test('the skill mentions neither private sources nor personal data', () => {
  assert.doesNotMatch(text, /claude\.ai|session_[0-9A-Za-z]{6}|co-authored/i);
});

test('the skill tells the unattended agent to wait for its subagents instead of ending the turn', () => {
  assert.match(body, /## Subagents run in the foreground/);
  assert.match(body, /never end your turn while one is running/);
});

test('Scenario: Decision made by the workflow - the skill decodes it, skips its own planning and treats it as data', () => {
  assert.match(body, /When `\$ARGUMENTS` has `--decision <base64>`/);
  assert.match(body, /Do not run `go-plan`/);
  assert.match(body, /base64 -d/);
  assert.match(body, /which you never read as an instruction/);
  assert.match(body, /failure path with the reason `invalid decision`/);
  assert.match(body, /Otherwise\*\* \(for example when someone runs `go` by hand\)/);
});

test('Scenario: Glossary entries / A decision record - the skill copies the Documentation section verbatim and adds one task', () => {
  assert.match(body, /\*\*Documentation\.\*\* If the issue has a `## Documentation` section, copy it word for word into `design\.md` under the heading `Documentation from the issue`/);
  assert.match(body, /add one task to `tasks\.md`: write that documentation exactly as given/);
});

test('Scenario: No documentation section - no task and nothing else is documented', () => {
  assert.match(body, /Add no other documentation\. If the issue has no such section, add no documentation task/);
});

test('Scenario: the skill runs the shared scripts for the rules that must not vary', () => {
  ['preflight.mjs', 'issue-hash.mjs', 'branch-state.mjs', 'spec-ready.mjs', 'commit-change.mjs', 'next-step.mjs']
    .forEach((s) => assert.match(body, new RegExp(`scripts/${s.replace('.', '\\.')}`), `the skill does not run ${s}`));
  ['intent-to-add.mjs', 'validation-gate.mjs', 'receipt-check.mjs', 'lens-plan.mjs', 'qa-aggregate.mjs']
    .forEach((s) => assert.match(ref, new RegExp(`scripts/${s.replace('.', '\\.')}`), `the procedure of QA does not run ${s}`));
});

test('the developer is driven by the apply instructions and the run is cut by the runner, not by the agent', () => {
  assert.match(body, /openspec instructions apply --change/);
  assert.doesNotMatch(body, /stay within `?run_max_turns/);
});

test('every failure reason of the specification is named in the failure path', () => {
  ['branch already exists', 'specification invalid', 'specification incomplete', 'issue changed after ready', 'protected path in the diff',
    'possible credential or temporary marker in the diff', 'QA rejected after the retries'].forEach((r) => assert.ok(body.includes(r), r));
});

test('Scenario: Nothing the developer can fix - the retries are skipped and the class goes to the failure comment', () => {
  assert.match(ref, /qa-aggregate\.mjs --plan/);
  assert.match(ref, /`all_non_fixable` is `true`/);
  assert.match(ref, /\*\*do not retry\*\*/);
  assert.ok(body.includes('QA rejected: nothing the developer agent can fix'), 'the new reason is named');
  assert.ok(ref.includes('QA rejected: nothing the developer agent can fix'), 'the procedure names it too');
  assert.match(ref, /`finding_class`/);
  assert.match(ref, /`retries_skipped`/);
  assert.match(ref, /counts as `fixable`/, 'a finding without a class retries as before');
});

test('Scenario: A mixed report - the retries run and the class of the first finding that cannot be fixed is named', () => {
  assert.match(ref, /first_non_fixable_class/);
  assert.match(ref, /Otherwise, if `<n>` is below `<qa_retries> \+ 1`/);
});

test('the work is kept when the retries were skipped, as it is after the retries', () => {
  assert.match(body, /\*\*Keep the work\.\*\* When the reason is `QA rejected after the retries`, `QA rejected: nothing the developer agent can fix`, `run limit reached`, `automated validation could not run`, `automated validation failed after the retries`, `lens report invalid` or `tasks left unfinished`/);
});

test('Scenario: A task edits a protected file - the specification is checked before the developer agent and the issue goes back with the reason policy', () => {
  assert.match(body, /build-preflight\.mjs --stage spec --issue-file <issue_file> --change-dir openspec\/changes\/<change_id>/);
  assert.match(body, /with `reason` `policy`/);
  assert.match(body, /this check only saves cost, and the commit script and QA refuse the same paths later/);
  assert.ok(body.indexOf('--stage spec') < body.indexOf('### 4. Build'), 'the check runs before the build step');
  assert.ok(body.indexOf('--stage spec') < body.indexOf('docs: specification for #<issue>'), 'and before the specification is committed');
});

test('Scenario: An input that a person confirms - the built message receives it from the workflow', () => {
  assert.match(body, /`inputs_to_confirm` \(the value of the environment variable `RELEVO_INPUTS_TO_CONFIRM`/);
});

test('Scenario: the profile and the role skills come from scripts, and the skill names no stack', () => {
  assert.match(body, /scripts\/stack-profile\.mjs/);
  assert.match(body, /scripts\/role-skills\.mjs --role dev/);
  assert.match(body, /scripts\/role-skills\.mjs --role qa/);
  assert.match(body, /failure path with the reason `profile not resolved`/);
  assert.doesNotMatch(body, /\.g\.dart|\.freezed\.dart|flutter/i, 'the skill must not name the generated files or tools of one stack');
  const source = readFileSync(root('scripts/role-skills.mjs'), 'utf8');
  [...body.matchAll(/role-skills\.mjs([^\n`]*)/g)].flatMap((m) => [...m[1].matchAll(/--([a-z]+)/g)].map((f) => f[1]))
    .forEach((f) => assert.ok(source.includes(`'${f}'`), `role-skills does not implement --${f}`));
});

test('Scenario: Monorepo - go reads the platform from the decision, passes it on and commits inside its folder', () => {
  assert.match(body, /`platform` \(its name\), `stack`, `path` \(its folder\) and `targets`/);
  assert.match(body, /stack-profile\.mjs --platform <platform>/);
  assert.match(body, /role-skills\.mjs --role dev --platform <platform>/);
  assert.match(body, /role-skills\.mjs --role qa --platform <platform>/);
  assert.match(body, /--within "<path>" --change "<change_id>"/);
  assert.match(body, /`outside the platform`/);
  assert.match(body, /the folder of the platform \(`path`\)/);
  assert.doesNotMatch(body, /`platform`, `skip`/, 'the decision platform of the previous change is gone');
  const wrapper = readFileSync(root('scripts/commit-change.mjs'), 'utf8');
  ['within', 'change'].forEach((f) => assert.ok(wrapper.includes(`'${f}'`), `commit-change does not implement --${f}`));
});

test('Scenario: the skill says where it runs - in the cloud with a decision, or on a machine with go-local.mjs in its own worktree', () => {
  assert.match(body, /## Where it runs/);
  assert.match(body, /scripts\/go-local\.mjs <issue>/);
  assert.match(body, /separate git worktree, with the same limits and tool lists as the workflow/);
  assert.ok(existsSync(root('scripts/go-local.mjs')));
});

const whereItRuns = body.match(/## Where it runs\n\n([\s\S]*?)\n\n## OpenSpec commands/)[1];

test('Scenario: Two issues at once - an interactive run makes its worktree with go-worktree.mjs and enters it by path before the preflight', () => {
  assert.ok(existsSync(root('scripts/go-worktree.mjs')));
  assert.match(whereItRuns, /\*\*In an interactive session\*\* \(started by hand without `--decision` and without `--local`\)/);
  assert.match(whereItRuns, /Before step 0, make a worktree for the issue/);
  assert.match(whereItRuns, /scripts\/go-worktree\.mjs create <issue>/);
  assert.match(whereItRuns, /`EnterWorktree` and its `path` \(never its `name`/);
  assert.ok(body.indexOf('go-worktree.mjs create') < body.indexOf('### 0. Preflight'));
});

test('Scenario: No worktree where one exists - the cloud and --local skip it, a linked worktree builds in place, the same issue twice stops', () => {
  assert.match(whereItRuns, /without `--decision` and without `--local`/);
  assert.match(whereItRuns, /Exit 4: the session is already in a linked worktree[^\n]*Build where you are, make no worktree, and skip the exit below/);
  assert.match(whereItRuns, /Any other exit \(for example 3[^\n]*\): show its message and stop without changing anything/);
});

test('Scenario: Clean end and failure - the worktree is removed when the issue is built or a gate stopped it, and kept after the failure path', () => {
  assert.match(whereItRuns, /call `ExitWorktree` with `keep`/);
  assert.match(whereItRuns, /go-worktree\.mjs remove <issue>` when the outcome is `built` or a gate decision that stopped before step 2/);
  assert.match(whereItRuns, /After the failure path, or if the run stopped for any other reason, leave the worktree on disk and say its path/);
});

test('Scenario: Review stays in the main working tree - the go skill does not touch review', () => {
  assert.ok(!/go-worktree|EnterWorktree/.test(readFileSync(root('skills/review/SKILL.md'), 'utf8')));
});

test('Scenario: Local flag - /relevo:go <n> --local runs go-local.mjs and does not build in the session', () => {
  assert.match(body, /\*\*When `\$ARGUMENTS` has `--local`\*\*, do not build in this session: run `node \$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/go-local\.mjs <issue>`/);
  assert.match(body, /show what it prints, and stop/);
  assert.equal(meta['argument-hint'], '[issue-number] [--local] [--retry] [--decision <base64>]');
});

// ---------- issue format v2

test('Scenario: Decisions in the issue - go saves the body and copies the sections with the script, not by hand', () => {
  assert.match(body, /save its body to a file outside the working tree \(call it `<issue_file>`\)/);
  assert.match(body, /issue-sections\.mjs --body-file <issue_file> --copy "Decisions,Constraints,Code pointers,Screens and behaviour,Data contract,Design reference,Verification,Assumptions" >> openspec\/changes\/<change_id>\/design\.md/);
  assert.match(body, /`## From the issue: <Section>`; one the issue does not have is left out/);
  assert.match(body, /Do not edit, summarise or reorder what the script wrote/);
  assert.ok(existsSync(root('scripts/issue-sections.mjs')));
  assert.ok(readFileSync(root('scripts/issue-sections.mjs'), 'utf8').includes("'--copy'") || readFileSync(root('scripts/issue-sections.mjs'), 'utf8').includes("'copy'"));
});

test('the copy comes after the specification is written and before the developer is launched', () => {
  const copy = body.indexOf('issue-sections.mjs --body-file');
  assert.ok(copy > body.indexOf('### 3. Specification') && copy < body.indexOf('### 4. Build'));
});

test('Scenario: Question left in the issue - a hand-run takes the ambiguous path', () => {
  assert.match(body, /`Open questions` section with content, or the text `NEEDS CLARIFICATION`, it is ambiguous by its own words/);
  assert.match(body, /`reason` `ambiguous`/);
});

test('QA receives the saved body of the issue to compare the copied sections', () => {
  assert.match(ref, /`<issue_file>` \(the saved body of the issue\)/);
  assert.match(ref, /`spec`: the change folder, `<issue_file>`/);
});

// ---------- design reference

test('Scenario: Reference in the repository / Attachment - go fetches what the issue points to before it writes the specification', () => {
  const fetchAt = body.indexOf('design-fetch.mjs --issue <issue> --repo <owner/name>');
  assert.ok(fetchAt > body.indexOf('### 3. Specification'));
  assert.ok(fetchAt < body.indexOf('write the change specification from the issue'), 'the fetch comes before the specification');
  assert.match(body, /reads the references from the issue itself, downloads pasted attachments only when `design\.images` is on/);
  assert.match(body, /\.relevo-design\/manifest\.json/);
  assert.ok(existsSync(root('scripts/design-fetch.mjs')));
  const script = readFileSync(root('scripts/design-fetch.mjs'), 'utf8');
  ['issue', 'repo', 'out', 'config', 'repo-root', 'body-file'].forEach((flag) => assert.ok(script.includes(`arg('${flag}')`), `design-fetch does not implement --${flag}`));
});

test('Scenario: Refused reference in the cloud / Local run - go reads the manifest of the fetch step, and fetches only when it is not set', () => {
  assert.match(body, /`RELEVO_REFERENCES` is set: a step before you already fetched them, with a token you do not have\. Do not run the fetcher again\./);
  assert.match(body, /\*\*Otherwise\*\* \(a local run\) fetch them yourself/);
  assert.match(body, /a `## Code pointers` bullet, or a `link` bullet of `## External inputs`, that names a file of another repository as `owner\/repo:path`/);
});

test('Scenario: Reason word for word - the reason of a refused reference reaches the issue unchanged', () => {
  assert.match(body, /name each refused reference and copy its reason word for word, in English, without rewording or translating it/);
});

test('Scenario: Linked code pointer - only design references get a scenario', () => {
  assert.match(body, /the manifest entries with `section` `design`/);
  assert.match(body, /no scenario for a code pointer/);
});

test('Scenario: Images turned off - a reference that cannot be fetched is a defect in the specification, and nothing is built', () => {
  assert.match(body, /If it exits 1 it prints each reference it refused and why; in the cloud the manifest lists them under `refused`\. A refused reference is a defect in the specification/);
  assert.match(body, /take the `needs-spec` path described below with `reason` `missing`/);
  assert.match(body, /stop without pushing/);
});

test('the section is copied word for word and every bullet gets a scenario that becomes a line of the review checklist', () => {
  assert.match(body, /Data contract,Design reference,Verification/);
  assert.match(body, /\*\*A scenario per design reference\.\*\*/);
  assert.match(body, /`#### Scenario: Matches the reference <name>` with `WHEN the screen is shown` and `THEN it matches <the reference> in <what the bullet says must match>`/);
  assert.match(body, /lines of the review checklist that the person confirms by looking at their screen/);
});

test('Scenario: The agent is tempted to continue - the skill forbids going on without OpenSpec and writing the change by hand', () => {
  assert.match(body, /failed check is `openspec`[\s\S]*stop there/);
  assert.match(body, /do not go on from memory/);
  assert.match(body, /never write anything under `openspec\/changes\/` by hand/);
});

test('Scenario: A restricted file that is already versioned - the skill checks the base branch before it branches, and takes the failure path with the new reason', () => {
  const branch = body.slice(body.indexOf('### 2. Branch'), body.indexOf('### 3. Specification'));
  assert.match(branch, /scripts\/restricted-check\.mjs --ref origin\/<base>/);
  assert.ok(branch.indexOf('restricted-check.mjs') < branch.indexOf('git switch -c'), 'the check comes before the branch is made');
  assert.match(branch, /failure path with the reason `restricted file in the diff`/);
  assert.match(branch, /`branch_state` `not_pushed`/);
  assert.match(body, /`restricted file in the diff` \(a file on the restricted list/, 'the safe commit refuses it too');
  assert.match(body, /Never read a restricted file yourself/);
  ['restricted file in the diff'].forEach((r) => assert.ok(body.slice(body.indexOf('## Failure path'), body.indexOf('## Steps')).includes(r), `${r} is named in the failure path`));
});

test('a restricted file versioned on the base branch is reported as that, not as part of the change', () => {
  const body = readFileSync(new URL('../skills/go/SKILL.md', import.meta.url), 'utf8');
  assert.match(body, /versioned on the base branch/);
});

test('Scenario: Local flag with retry - the skill passes --retry to go-local.mjs and to the planner', () => {
  assert.match(body, /go-local\.mjs <issue>` \(with `--retry` when `\$ARGUMENTS` has it\)/);
  assert.match(body, /\*\*When `\$ARGUMENTS` has `--retry`\*\*/);
  assert.match(body, /--only <issue> --retry --apply --claim/);
  assert.match(body, /a branch means `\/relevo:fix <issue>`/);
});

test('the failure for a versioned restricted file takes the recovery restricted, which no command fixes', () => {
  assert.match(text, /`recovery` `restricted`/);
  assert.match(text, /fix\|delete-branch\|restricted/);
});

test('Scenario: the interface rules are selected after the specification and given to each agent with the line it needs', () => {
  assert.match(body, /interface-rules\.mjs --role dev --platform <platform> --text-file <issue_file>/);
  assert.match(body, /interface-rules\.mjs --role qa --platform <platform> --text-file <issue_file>/);
  assert.match(body, /Each prints nothing for a stack with no interface/);
  assert.match(body, /the "build it like this" lines and the examples of the stack/);
  assert.match(body, /the "check this" lines/);
  assert.match(body, /the count of rules left out/);
  assert.match(body, /the interface rules for `dev`/);
  assert.match(body, /keep the output of `--role qa` for the `interface` lens/);
  assert.match(ref, /interface-rules\.mjs --role qa --platform <platform> --text-file <issue_file>/);
});

test('Scenario: every exit records one class of the outcome, the seven classes of the specification', async () => {
  const { OUTCOME_CLASSES } = await import('../scripts/lib/phase-log.mjs');
  assert.match(body, /progress\.mjs class <built\|inputs\|policy\|qa-non-fixable\|qa-fixable-after-retries\|conflict\|limit\|other>/);
  OUTCOME_CLASSES.forEach((c) => assert.ok(body.includes(`\`${c}\``), `the skill names the class ${c}`));
  assert.match(body, /best-effort command/);
});

test('Scenario: every exit of the skill names the class it records', () => {
  const at = (re) => assert.match(body, re);
  at(/Record the class `other`, report the decision and its reason in one line/);
  at(/reason` `missing` and the class `inputs`/);
  at(/`ambiguous`, record the class `other`/);
  at(/reason` `policy`, the class `policy`/);
  at(/Record the class of the exit: `qa-non-fixable` for the reason `QA rejected: nothing the developer agent can fix`, `qa-fixable-after-retries` for `QA rejected after the retries`, `limit` for `run limit reached`, and `other` for every other reason/);
  at(/Record the class `built`, then move the issue to `built`/);
});

test('Scenario: the reference of QA exists and names each step, and go, fix and review read it', () => {
  assert.ok(existsSync(root('skills/go/references/qa-run.md')));
  [
    ['the gate', /validation-gate\.mjs --base origin\/<base>/], ['a red gate uses an attempt', /A red gate uses an attempt/], ['could not run', /`automated validation could not run`/],
    ['the plan of lenses', /lens-plan\.mjs --platform <platform>/], ['the receipt before each lens', /receipt-check\.mjs/], ['each lens is recorded when it starts', /progress\.mjs lens <lens> --attempt <n>/], ['one at a time, in the foreground', /one at a time, in the foreground/],
    ['the model of the lens', /agents\.qa\.<lens>\.model/], ['the previous report on a retry', /the previous report of that lens/], ['the aggregation', /qa-aggregate\.mjs --plan/],
    ['an invalid report is asked again once', /Ask that lens again, once/], ['a second invalid report', /`lens report invalid`/], ['the advisory notes', /`qa_notes`/], ['the receipt is not a boundary', /not a defence against an agent that writes a false file/],
  ].forEach(([what, re]) => assert.match(ref, re, what));
  assert.match(body, /skills\/go\/references\/qa-run\.md/);
  assert.match(body, /Announce the phase when the gate starts: `node \$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/progress\.mjs phase qa --attempt 1 --of <qa_retries \+ 1>`/);
  for (const s of ['fix', 'review']) assert.match(readFileSync(root(`skills/${s}/SKILL.md`), 'utf8'), /skills\/go\/references\/qa-run\.md/, s);
});

test('Scenario: the hand-off carries the advisory notes of QA', () => {
  assert.match(body, /Add `qa_notes` \(the `advisory` list of the aggregation of step 5, as `\{ lens, text \}` items\)/);
});

test('Scenario: Model and effort of a role - go, fix, review and the shared QA procedure pass them as parameters of the Agent tool', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  for (const p of ['skills/go/SKILL.md', 'skills/fix/SKILL.md', 'skills/review/SKILL.md', 'skills/go/references/qa-run.md']) {
    const text = read(p);
    assert.match(text, /`model` and (the )?`effort`|model\*\* and the \*\*effort\*\*/, `${p} names the model and the effort`);
    assert.match(text, /Agent tool/, `${p} says where they go`);
  }
  assert.doesNotMatch(read('skills/go/references/qa-run.md'), /unless the runtime lets you set it at launch/, 'the effort is no longer left to the agent file');
});

// ---------- the budget of the run

test('Scenario: No agent starts after a limit of the run - the skill records each agent and checks before the next one', () => {
  assert.match(body, /## The budget of the run/);
  assert.match(body, /run-budget\.mjs record --agent <relevo:dev\|relevo:qa-spec\|relevo:qa-security\|relevo:qa-code\|relevo:qa-interface> --tool-uses <n> --duration-ms <n> --tokens <n>/);
  assert.match(body, /run-budget\.mjs check --max-turns <run_max_turns> --max-minutes <run_max_minutes>/);
  assert.match(body, /\*\*Exit 1:\*\* a limit was reached[^]*take the failure path with the reason `run limit reached`/);
  assert.match(body, /names the agents that did not run/);
  assert.match(body, /`run_max_minutes`, `run_max_cost`/, 'the start decision names the minutes limit');
  const dev = body.indexOf('launch the `relevo:dev` agent in **build** mode');
  assert.ok(body.indexOf('record what the agent used', dev) > dev, 'the developer is recorded after each group');
});

test('Scenario: The budget guard stops a run only on what it can read - the skill says to carry on when it does not know, and to trust no text of a report', () => {
  assert.match(body, /`"known":false` and exits 0: carry on/);
  assert.match(body, /record those three numbers and nothing else of its report/);
});

test('the QA reference checks the budget before each lens and before a retry, and records each lens', () => {
  const qa = readFileSync(new URL('../skills/go/references/qa-run.md', import.meta.url), 'utf8');
  assert.match(qa, /Before each lens, check the budget of the run/);
  assert.match(qa, /run-budget\.mjs record --agent relevo:qa-<lens>/);
  assert.match(qa, /check the budget \(`run-budget\.mjs check`[^)]*\) and, if it exits 1, take the failure path with the reason `run limit reached` instead of retrying/);
});

// ---------- checkpoints and resume

test('Scenario: The developer builds one section of tasks at a time - the skill splits the tasks, launches per group and checkpoints after each', () => {
  const step4 = body.slice(body.indexOf('### 4. Build'), body.indexOf('### 5. QA'));
  assert.match(step4, /task-groups\.mjs openspec\/changes\/<change_id>\/tasks\.md/);
  assert.match(step4, /one group when three tasks or fewer are pending/);
  assert.match(step4, /\*\*only the tasks of that group\*\*/);
  const group = step4.indexOf('only the tasks of that group');
  const checkpoint = step4.indexOf('checkpoint.mjs --decision <base64> --k <number of the group> --of <number of groups>');
  assert.ok(group > 0 && checkpoint > group, 'the checkpoint comes after the group is built');
  assert.match(step4, /wip: checkpoint <k>\/<n> \(#<issue>\)/);
  assert.match(step4, /Exit 1:\*\* a commit was refused[^]*branch_state` `unsafe`/);
  assert.match(step4, /After the last group run the instructions command again[^]*`tasks left unfinished`/);
  assert.match(step4, /Check the budget before each launch/);
});

test('Scenario: A later run resumes from the checkpoints - step 2 asks the script, resumes or stops, and step 3 writes nothing when resumed', () => {
  const step2 = body.slice(body.indexOf('### 2. Branch'), body.indexOf('### 3. Specification'));
  assert.match(step2, /resume-check\.mjs <base> <branch> <issue> <issue_hash>/);
  assert.match(step2, /`absent`[^]*git switch -c <branch> origin\/<base>/);
  assert.match(step2, /`resume`[^]*git switch -c <branch> origin\/<branch>/);
  assert.match(step2, /`existing`[^]*Do not touch the branch/);
  assert.match(step2, /reason `branch already exists`/, 'a branch that cannot be resumed stops as before');
  assert.doesNotMatch(step2.slice(0, step2.indexOf('resume-check.mjs')), /git switch -c <branch> origin\/<base>/, 'the branch is no longer created before the check');
  const step3 = body.slice(body.indexOf('### 3. Specification'), body.indexOf('### 4. Build'));
  assert.match(step3, /\*\*When the run is resumed\*\*, the specification is already on the branch: do not run `openspec new change`, write no artifact and do not commit the specification/);
});

test('the feature commit may be empty because the checkpoints hold the files, and the failure path pushes its own checkpoints but nothing else', () => {
  const commit = body.slice(body.indexOf('### 6. Commit'), body.indexOf('### 7. Push and hand off'));
  assert.match(commit, /commit-change\.mjs --message "feat: <title> \(#<issue>\)" --allow-empty/);
  assert.match(commit, /checkpoints stay in the history/);
  const failure = body.slice(body.indexOf('## Failure path'), body.indexOf('## Steps'));
  assert.match(failure, /Issue-hash: <issue_hash>/, 'the limit commit carries the hash so that a run can resume');
  assert.match(failure, /existed before this run[^]*fast-forward/);
});

test('Scenario: the lenses leave out what the install step left - the list is made once per round and given to every lens', () => {
  assert.match(ref, /tree-baseline\.mjs list/);
  assert.match(ref, /`not_the_change`/);
  assert.ok(ref.indexOf('tree-baseline.mjs list') < ref.indexOf('For each active lens, in the order'), 'the list is made before the first lens');
  for (const lens of ['spec', 'security', 'code', 'interface']) {
    const agent = readFileSync(root(`agents/qa-${lens}.md`), 'utf8');
    assert.match(agent, /not_the_change/, `qa-${lens} knows the list`);
    assert.match(agent, /install step/, `qa-${lens} knows where the files come from`);
  }
});

test('Scenario: every group goes to the developer and every checkpoint is made in order with its own number', () => {
  assert.match(text, /Every group goes to the developer, the documentation group and the group that only runs the checks included/);
  assert.match(text, /never run two groups in one launch/);
  assert.match(text, /Make the checkpoint of every group, in order, with its own number, even when its tasks changed no file/);
  assert.match(text, /never skip a number/);
});
