import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

const root = (p) => new URL(`../${p}`, import.meta.url);
const text = readFileSync(root('skills/ship/SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const meta = parse(front);

const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility']);

test('frontmatter uses only documented fields; Claude can never start it on its own', () => {
  Object.keys(meta).forEach((k) => assert.ok(KNOWN.has(k), `unknown skill field "${k}"`));
  assert.equal(meta.name, 'ship');
  assert.equal(meta['argument-hint'], '[issue-number]');
  assert.equal(meta['disable-model-invocation'], true);
  assert.match(meta.description, /never starts on its own/);
  assert.ok(String(meta.description).length <= 1536);
});

test('every script the skill runs exists', () => {
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  ['ship-check.mjs', 'check-archive.mjs', 'scan-diff.mjs', 'stage.mjs', 'label-change.mjs', 'validate-config.mjs', 'archive-state.mjs', 'fix-tasks.mjs', 'conflict-scope.mjs'].forEach((s) => assert.ok(scripts.includes(s), `the skill never uses ${s}`));
  new Set(scripts).forEach((s) => assert.ok(existsSync(root(`scripts/${s}`)), `scripts/${s} is referenced but does not exist`));
});

test('the order is: check, confirm in writing, archive, check again, merge, close out', () => {
  const at = (needle) => {
    const i = body.indexOf(needle);
    assert.ok(i >= 0, `missing: ${needle}`);
    return i;
  };
  const order = [
    at('### 1. Check that it qualifies'),
    at('### 2. Confirm, in writing'),
    at('openspec archive "<change folder name>" -y'),
    at('### 4. Check again'),
    at('gh pr merge <number>'),
    at('### 6. Close out'),
  ];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('nothing is archived, pushed or merged before the person confirms', () => {
  assert.match(body, /Never merge, archive or push anything before the person's written confirmation/);
  assert.match(body, /\*\*stop: nothing is archived, pushed or merged\.\*\*/);
  assert.match(body, /Wait for a clear written yes/);
});

test('it never approves and never bypasses a rule', () => {
  assert.match(body, /Never approve a pull request/);
  assert.match(body, /no `--admin`/);
  assert.match(body, /no merging while `ship-check` says to stop/);
  assert.doesNotMatch(body.replace(/no `--admin`[^.]*\./, ''), /gh pr merge[^\n]*--admin/);
  assert.doesNotMatch(body, /gh pr review/);
});

test('the merge is a squash with a clean message that deletes the branch', () => {
  assert.match(body, /gh pr merge <number> --repo <owner\/name> --squash --delete-branch --subject/);
  assert.match(body, /--body "Issue #\$ARGUMENTS"/);
  assert.match(body, /no list of commits, no links, no attribution lines/);
});

test('it closes the issue explicitly, because the base branch is usually not the default', () => {
  assert.match(body, /gh issue close \$ARGUMENTS --reason completed/);
  assert.match(body, /only closes an issue by itself when the merge goes into the repository's default branch/);
  assert.match(body, /label-change\.mjs --clear/);
});

test('the archive may only touch the specifications folder, and is checked before it is committed', () => {
  const check = body.indexOf('check-archive.mjs');
  const commit = body.indexOf('git commit -m "chore(openspec): archive');
  assert.ok(check > 0 && commit > check, 'the archive check must come before the commit');
  assert.match(body, /changed anything outside `openspec\/`, or changed nothing/);
});

test('it handles approvals dismissed by the archive push, and reminds that releasing is separate', () => {
  assert.match(body, /an approval dismissed by the push/);
  assert.match(body, /the promotion is from `<base>` to `<release>`, with a version tag/);
  assert.match(body, /next-step\.mjs --state closed/);
});

test('the skill mentions neither private sources nor personal data', () => {
  assert.doesNotMatch(text, /claude\.ai|session_[0-9A-Za-z]{6}|co-authored/i);
});

test('the state, the baseline and the labels are passed to ship-check', () => {
  assert.match(body, /ship-check\.mjs --repo <owner\/name> --branch <branch> --invoker <login> --issue \$ARGUMENTS --labels/);
  assert.match(body, /adding `--baseline <baseline>`/);
  assert.match(body, /git rev-parse origin\/<branch>/);
  assert.match(body, /`pr-open`: `\/relevo:review` or `\/relevo:fix`/);
});

test('Scenario: Merge failed after the archive was pushed - the archive step is skipped when the change is already archived', () => {
  const state = body.indexOf('archive-state.mjs --change');
  const archive = body.indexOf('openspec archive "<change folder name>" -y');
  assert.ok(state > 0 && state < archive, 'archive-state comes first');
  assert.match(body, /`archived` \(skip the rest of this step and go to step 4\)/);
});

test('the change is validated and its tasks are checked before it is archived', () => {
  const validate = body.indexOf('openspec validate "<change folder name>"');
  const tasks = body.indexOf('fix-tasks.mjs --file openspec/changes/<change folder name>/tasks.md --stage after');
  const archive = body.indexOf('openspec archive "<change folder name>" -y');
  assert.ok(validate > 0 && tasks > 0 && validate < archive && tasks < archive);
});

test('Scenario: Eligible person who did not approve - the written confirmation is asked for', () => {
  assert.match(body, /`not-approver`/);
  assert.match(body, /confirm in writing that they run it without having approved it/);
});

test('Scenario: Conflict only in specifications / in code - normal pushes only, and a conflict in code stops it', () => {
  assert.match(body, /git revert --no-edit <the archive commit>/);
  assert.match(body, /conflict-scope\.mjs/);
  assert.match(body, /git merge --abort/);
  assert.match(body, /never a force-push/);
  assert.doesNotMatch(body, /git push[^\n]*--force/);
});

test('the skill knows that the checks of the approved head carry over, and names the label', () => {
  assert.match(body, /checksFrom: baseline/);
  assert.match(body, /do not ask about `no-ci` then/);
  assert.match(body, /apply the `relevo:ship` label/);
});

test('Scenario: Local ship meets the same state - the skill reruns ship-check before it stops, and reports the commit relied on', () => {
  assert.match(body, /GitHub has not finished checking whether the pull request can be merged/);
  assert.match(body, /up to 6 times, before stopping/);
  assert.match(body, /which commit's checks it relied on/);
});

test('Scenario: A failed go left its worktree - ship asks who holds the branch before it switches, and archives nothing', () => {
  const check = body.indexOf('scripts/branch-worktree.mjs --branch <branch>');
  assert.ok(check > 0 && check < body.indexOf('git switch <branch>'), 'the check comes before the switch');
  assert.ok(check < body.indexOf('openspec archive "<change folder name>" -y'), 'and before anything is archived');
  assert.match(body, /Stop before anything is archived, pushed or merged, say that the branch is held by that worktree and its path/);
});

test('Scenario: A finished worktree that holds nothing that is not on the remote - ship offers to remove it and archives nothing before the answer', () => {
  assert.match(body, /branch-worktree\.mjs --branch <branch> --base <base> --json/);
  assert.match(body, /`removable` is true/);
  assert.match(body, /holds nothing that is not on the remote/);
  assert.match(body, /git worktree remove "<holder>"/);
  assert.match(body, /never with `--force`/);
  assert.match(body, /Only on a yes/);
  assert.match(body, /name each of `reasons`, remove nothing/);
  assert.match(body, /archive, push and merge nothing until the person answers/);
});

test('Scenario: Ship in a worktree - the tidy runs only under the condition review uses, and the branch is not deleted otherwise', () => {
  const tidy = body.slice(body.indexOf('3. Tidy the local copy'), body.indexOf('## Report'));
  const review = readFileSync(root('skills/review/SKILL.md'), 'utf8');
  const guard = '[ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ] && ! git worktree list --porcelain | grep -qx "branch refs/heads/<base>"';
  assert.ok(tidy.includes(guard) && review.includes(guard), 'the same condition as review step 9');
  assert.match(tidy, /run none of them, because `git branch -d` also fails on the branch the working tree is standing on/);
  assert.match(tidy, /say which branch the working tree stays on/);
});

test('Scenario: The tidy fails - it is a note, and the merge, the closed issue and the labels stand', () => {
  const tidy = body.slice(body.indexOf('3. Tidy the local copy'), body.indexOf('## Report'));
  assert.match(tidy, /say so as a note: the pull request is already merged, so it never changes the outcome/);
});

// ---------- local-tracker: a files project

test('Scenario: Files project - ship is a confirmed local merge with no pull request, no push and no gh', () => {
  const skill = readFileSync(new URL('../skills/ship/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /## Files project/);
  const section = skill.split('## Files project')[1].split('\n## ')[0];
  assert.match(section, /`tracker` in `relevo\.yml` is `files`/);
  assert.match(section, /never through `gh`/);
  assert.match(section, /`git branch --show-current` must equal `branches\.base`/);
  assert.match(section, /ship-local\.mjs check --issue \$ARGUMENTS/);
  assert.match(section, /without it nothing is archived or merged/);
  assert.match(section, /\*\*do not push\*\*/);
  assert.match(section, /ship-local\.mjs merge --issue \$ARGUMENTS --title/);
  const at = (needle) => section.indexOf(needle);
  assert.ok(at('Confirm, in writing') < at('Archive the specification on the branch'), 'the yes comes before the archive');
  assert.ok(at('Archive the specification on the branch') < at('merge --issue'), 'the archive comes before the merge');
});

test('go and fix record the green gate so that ship can check it', () => {
  for (const path of ['skills/go/SKILL.md', 'skills/fix/SKILL.md']) {
    assert.match(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), /ship-local\.mjs record-gate --issue <issue>/, path);
  }
});

test('Scenario: Files project - the ship skill reads the local base and pushes nothing, with no remote', () => {
  const skill = readFileSync(new URL('../skills/ship/SKILL.md', import.meta.url), 'utf8');
  const section = skill.split('## Files project')[1].split('\n## ')[0];
  assert.match(section, /Local refs: this project has no remote/);
  assert.match(section, /use the local `<base>` and `<branch>`, and skip every `git fetch`, `git pull` and `git push`/);
});

test('Scenario: Checks still running in a session - it waits for them, with a limit, before it stops', () => {
  const step1 = body.slice(body.indexOf('### 1. Check that it qualifies'), body.indexOf('### 2. Confirm, in writing'));
  assert.match(step1, /only reason is[^.]*checks are still running/i);
  assert.match(step1, /gh pr checks <number> --repo <owner\/name> --watch --fail-fast/);
  assert.match(step1, /(up to|at most) 20 minutes/);
  assert.match(step1, /still running after that[^.]*stop[^.]*run (it|ship) again/i);
});

test('the wait for the checks is not a confirmation: it happens before the written yes', () => {
  assert.ok(body.indexOf('--watch --fail-fast') < body.indexOf('### 2. Confirm, in writing'));
});

test('Scenario: The merge is refused because the base moved - it checks again and tries once more', () => {
  const step5 = body.slice(body.indexOf('### 5. Merge'), body.indexOf('### 6. Close out'));
  assert.match(step5, /base branch was modified/i);
  assert.match(step5, /run `ship-check\.mjs` again[^.]*merge (it )?(a second time|once more)/i);
  assert.match(step5, /never a third/i);
});

test('Scenario: Clash found in a session - the delta is checked in step 1, before the confirmation, and a clash stops it', () => {
  const step1 = body.slice(body.indexOf('### 1. Check that it qualifies'), body.indexOf('### 2. Confirm, in writing'));
  const at = step1.indexOf('scripts/delta-check.mjs --change "<change folder name>" --issue $ARGUMENTS');
  assert.ok(at > 0, 'step 1 never runs the delta check');
  assert.ok(at > step1.indexOf('scan-diff.mjs'), 'it runs after the scan of the diff');
  const after = step1.slice(at);
  assert.match(after, /exits 1[^.]*stop[^.]*changing nothing/i);
  assert.match(after, /\/relevo:fix \$ARGUMENTS/);
  assert.match(after, /ADDED[^.]*MODIFIED/);
});

test('Scenario: Ship stops - every stop ends with the state read from the issue and its step, never a state taken for granted', () => {
  const report = body.split('## Report')[1];
  const stopped = report.split('### Stopped without merging')[1];
  assert.match(stopped, /every stop above, at whatever step/);
  assert.match(stopped, /scripts\/next-step\.mjs --labels "<the issue's labels, comma separated>" --issue \$ARGUMENTS/);
  assert.match(stopped, /--state closed --issue \$ARGUMENTS/);
  assert.match(stopped, /never say that the issue is on a state you did not read/);
  assert.doesNotMatch(report, /pr-open/);
});

test('a merge ends with the step of a closed issue, and a files project keeps its own report and uses the local variant on a stop', () => {
  const merged = body.split('### Merged')[1].split('### Stopped')[0];
  assert.match(merged, /scripts\/next-step\.mjs --state closed --issue \$ARGUMENTS/);
  assert.match(merged, /with a version tag/);
  const section = body.split('## Files project')[1].split('\n## ')[0];
  assert.match(section, /Nothing else of the report of a merge below applies/);
  assert.match(section, /--state in-review --reason local --issue \$ARGUMENTS/);
});
