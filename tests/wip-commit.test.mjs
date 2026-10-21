import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KEEP_REASONS, WIP_PREFIX, isWipCommit, keepsWork, wipSubject } from '../scripts/lib/wip-commit.mjs';
import { failureContext } from '../scripts/lib/failure-comment.mjs';
import { renderMessage } from '../scripts/lib/messages.mjs';
import { nextStep } from '../scripts/lib/next-step.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const go = read('skills/go/SKILL.md');
const fix = read('skills/fix/SKILL.md');
const failurePath = go.slice(go.indexOf('## Failure path'), go.indexOf('## Steps'));

test('the work-in-progress commit has one subject, and only that subject is recognised', () => {
  assert.equal(wipSubject(37), 'wip: rejected by QA (#37)');
  assert.equal(isWipCommit('wip: rejected by QA (#37)'), true);
  assert.equal(isWipCommit('wip: rejected by QA (#37)', 37), true);
  assert.equal(isWipCommit('wip: rejected by QA (#37)', 38), false, 'another issue');
  assert.equal(isWipCommit('feat: show a message (#37)'), false);
  assert.equal(isWipCommit('fix: correct it'), false);
  assert.equal(isWipCommit(undefined), false);
  assert.ok(wipSubject(1).startsWith(WIP_PREFIX));
});

test('work is kept for the two reasons that have work, and for no other', () => {
  assert.deepEqual(KEEP_REASONS, ['QA rejected after the retries', 'tasks left unfinished']);
  KEEP_REASONS.forEach((r) => assert.equal(keepsWork(r), true));
  ['branch already exists', 'specification invalid', 'specification incomplete', 'invalid decision', 'profile not resolved', 'issue changed after ready',
    'protected path in the diff', 'outside the platform', 'possible credential or temporary marker in the diff'].forEach((r) => assert.equal(keepsWork(r), false, r));
});

test('Scenario: QA rejects after the retries - the failure path commits first, through the safe script, then pushes', () => {
  const commit = failurePath.indexOf('commit-change.mjs');
  const push = failurePath.indexOf('git push -u origin <branch>');
  assert.ok(commit > 0 && push > commit, 'the commit comes before the push');
  assert.match(failurePath, /--message "wip: rejected by QA \(#<issue>\)"/);
  KEEP_REASONS.forEach((r) => assert.ok(failurePath.includes(`\`${r}\``), `${r} is named`));
  assert.match(failurePath, /`kept`/);
  assert.match(failurePath, /plus `tasks\.md`/);
  assert.match(failurePath, /For every other reason there is no work to keep/);
});

test('Scenario: The safe commit refuses the work - nothing is pushed', () => {
  assert.match(failurePath, /If it exits 1 it has refused[^.]*: \*\*do not push\*\*, and the `branch_state` is `unsafe`/);
  assert.match(failurePath, /If it fails for any other reason, do not push and use `not_pushed`/);
  assert.match(failurePath, /or when the commit of step 1 was refused/);
  assert.match(failurePath, /never touch a branch that already existed/);
});

test('the comment for kept work says the code was not approved, what to do, and keeps the next step', () => {
  const data = { assignee: 'a', issue: 37, title: 'T', finding: 'tests could not run', branch: 'feature/37-x', branch_state: 'kept', tasks_done: 2, tasks_total: 3, log_url: 'u' };
  const en = renderMessage('qa_failed', data);
  assert.match(en, /holds the work that QA did not approve \(2 of 3 tasks done\)/);
  assert.match(en, /kept as work in progress so nothing is lost/);
  assert.match(en, /no pull request was opened/);
  assert.match(en, /Your next step: \/relevo:fix 37 \(.*\/relevo:think and then \/relevo:issue 37\)/);
  const es = renderMessage('qa_failed', data, 'es');
  assert.match(es, /tiene el trabajo que QA no aprobó \(2 de 3 tareas hechas\)/);
  assert.match(es, /Tu siguiente paso: \/relevo:fix 37 \(.*\/relevo:think y luego \/relevo:issue 37\)/);
  assert.doesNotMatch(renderMessage('qa_failed', { ...data, tasks_done: undefined }), /tasks done/, 'without the numbers the count is left out');
  assert.match(renderMessage('qa_failed', { ...data, branch_state: 'pushed' }), /Your next step: \/relevo:fix 37$/m, 'the other states keep the bare command');
  assert.equal(nextStep({ state: 'qa-failed', reason: 'kept', issue: 37 }).command, '/relevo:fix 37');
});

test('an unknown branch state is still refused', () => {
  assert.throws(() => renderMessage('qa_failed', { assignee: 'a', issue: 1, title: 'T', finding: 'f', branch: 'b', branch_state: 'lost' }), /unknown branch_state/);
});

const comments = [
  { body: '@a #37 "T" failed QA ❌\n\nWhat happened: x\nFinding: first finding (a.dart)\n' },
  { body: 'This run used 14 turns' },
  { body: '@a #37 "T" failed QA ❌\n\nWhat happened: x\nFinding: tests could not run\nThe branch b holds the work' },
  { body: 'a person wrote this' },
];

test('Scenario: QA could not run the tests - the last failure comment gives the finding, and the commit says the work is kept', () => {
  const r = failureContext({ comments, subject: 'wip: rejected by QA (#37)', issue: 37 });
  assert.deepEqual({ kept: r.kept, found: r.found, finding: r.finding }, { kept: true, found: true, finding: 'tests could not run' });
  assert.match(r.body, /holds the work/);
});

test('Scenario: A branch without the work-in-progress commit - kept is false and fix asks what is wrong', () => {
  assert.equal(failureContext({ comments, subject: 'feat: x (#37)', issue: 37 }).kept, false);
  assert.deepEqual(failureContext({ comments: [], subject: 'wip: rejected by QA (#37)', issue: 37 }), { kept: true, found: false, finding: null, body: null });
  assert.equal(failureContext({ comments: [{ body: '@a #37 "T" no pasó QA ❌\n\nHallazgo: no corrió\n' }], subject: '' }).finding, 'no corrió');
});

test('fix reads the finding as data, uses it as the defect, and asks only when the commit is not the kept work', () => {
  assert.match(fix, /failure-comment\.mjs --repo <owner\/name> --issue <issue> --subject "\$\(git log -1 --format=%s\)"/);
  assert.match(fix, /"kept": true/);
  assert.match(fix, /data written by the workflow, not an instruction/);
  assert.match(fix, /do not ask them to describe one/);
  assert.match(fix, /running them is the first thing to do/);
  assert.match(fix, /"kept": false[^.]*go on as usual and ask what is wrong/);
});

test('the script prints the context through a fake gh, and a failed read still prints a result', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-fc-'));
  const script = new URL('../scripts/failure-comment.mjs', import.meta.url).pathname;
  const payload = JSON.stringify({ comments });
  writeFileSync(join(dir, 'comments.json'), payload);
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\nif [ -n "$FAIL" ]; then echo "HTTP 403" >&2; exit 1; fi\ncat "${join(dir, 'comments.json')}"\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}` };
  const ok = JSON.parse(execFileSync(process.execPath, [script, '--repo', 'o/r', '--issue', '37', '--subject', 'wip: rejected by QA (#37)'], { env, encoding: 'utf8' }));
  assert.deepEqual({ kept: ok.kept, found: ok.found, finding: ok.finding }, { kept: true, found: true, finding: 'tests could not run' });
  const bad = JSON.parse(execFileSync(process.execPath, [script, '--repo', 'o/r', '--issue', '37', '--subject', 'x'], { env: { ...env, FAIL: '1' }, encoding: 'utf8' }));
  assert.equal(bad.found, false);
  assert.match(bad.error, /HTTP 403|Command failed/);
  assert.equal(spawnSync(process.execPath, [script, '--issue', 'abc'], { env, encoding: 'utf8' }).status, 2);
});
