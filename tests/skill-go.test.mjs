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

// Claude Code ignores unknown skill fields silently, so a typo would disable a setting unnoticed.
const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'go');
  assert.equal(meta['argument-hint'], '[issue-number] [--local] [--decision <base64>]');
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
  const agents = [...body.matchAll(/`relevo:(\w+)`/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(agents)].sort(), ['dev', 'qa']);
  new Set(agents).forEach((a) => assert.ok(existsSync(root(`agents/${a}.md`)), `agents/${a}.md is missing`));
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
  ['preflight.mjs', 'issue-hash.mjs', 'branch-state.mjs', 'spec-ready.mjs', 'intent-to-add.mjs', 'commit-change.mjs', 'next-step.mjs']
    .forEach((s) => assert.match(body, new RegExp(`scripts/${s.replace('.', '\\.')}`), `the skill does not run ${s}`));
});

test('the developer is driven by the apply instructions and the run is cut by the runner, not by the agent', () => {
  assert.match(body, /openspec instructions apply --change/);
  assert.doesNotMatch(body, /stay within `?run_max_turns/);
});

test('every failure reason of the specification is named in the failure path', () => {
  ['branch already exists', 'specification invalid', 'specification incomplete', 'issue changed after ready', 'protected path in the diff',
    'possible credential or temporary marker in the diff', 'QA rejected after the retries'].forEach((r) => assert.ok(body.includes(r), r));
});

test('Scenario: the profile and the role skills come from scripts, and the skill names no stack', () => {
  assert.match(body, /scripts\/stack-profile\.mjs/);
  assert.match(body, /scripts\/role-skills\.mjs --role dev/);
  assert.match(body, /scripts\/role-skills\.mjs --role qa/);
  assert.match(body, /failure path with the reason `profile not resolved`/);
  assert.match(body, /`generated` list/);
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
  assert.equal(meta['argument-hint'], '[issue-number] [--local] [--decision <base64>]');
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
  assert.match(body, /`<issue_file>` \(the saved body of the issue, to compare the copied sections\)/);
});

// ---------- design reference

test('Scenario: Reference in the repository / Attachment - go fetches what the issue points to before it writes the specification', () => {
  const fetchAt = body.indexOf('design-fetch.mjs --issue <issue> --repo <owner/name>');
  assert.ok(fetchAt > body.indexOf('### 3. Specification'));
  assert.ok(fetchAt < body.indexOf('Write the change specification from the issue'), 'the fetch comes before the specification');
  assert.match(body, /reads the references from the issue itself, downloads pasted attachments only when `design\.images` is on/);
  assert.match(body, /\.relevo-design\/manifest\.json/);
  assert.ok(existsSync(root('scripts/design-fetch.mjs')));
  const script = readFileSync(root('scripts/design-fetch.mjs'), 'utf8');
  ['issue', 'repo', 'out', 'config', 'repo-root', 'body-file'].forEach((flag) => assert.ok(script.includes(`arg('${flag}')`), `design-fetch does not implement --${flag}`));
});

test('Scenario: Refused reference in the cloud / Local run - go reads the manifest of the fetch step, and fetches only when it is not set', () => {
  assert.match(body, /`RELEVO_REFERENCES` is set: a step before you already fetched them, with a token you do not have\. Do not run the fetcher again\./);
  assert.match(body, /\*\*Otherwise\*\* \(a local run\) fetch them yourself/);
  assert.match(body, /a `## Code pointers` bullet that names a file of another repository as `owner\/repo:path`/);
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
