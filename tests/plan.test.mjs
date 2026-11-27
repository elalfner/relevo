import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../scripts/lib/config.mjs';
import { planGo } from '../scripts/lib/plan.mjs';

const BODY = '## Scenarios\n- **WHEN** a\n- **THEN** b\n\n## Edge cases\n- c\n';
const cfgFor = (extra = '') => {
  // Extra limits are merged into the base limits block; everything else is appended.
  const limits = extra.match(/^limits:\n((?:  .*\n)+)/);
  const rest = limits ? extra.replace(limits[0], '') : extra;
  const result = loadConfig(
    `limits:\n  run_max_cost: 5\n${limits ? limits[1] : ''}team:\n  spec_writer: persona-a\n  members: [persona-a, persona-b, persona-c]\n${rest}`,
  );
  assert.ok(result.ok, JSON.stringify(result.errors));
  return result.config;
};
const PERMS = { 'persona-a': 'write', stranger: 'read' };

let seq = 0;
function issue(over = {}) {
  seq += 1;
  return {
    number: 100 + seq, title: `Task ${seq}`, body: BODY, state: 'open',
    labels: ['relevo:ready', 'relevo:go'], assignees: ['persona-b'], milestone: { number: 1, due_on: null },
    ready_at: `2026-10-14T10:0${seq % 10}:00Z`, ready_by: 'persona-a',
    go_at: `2026-10-14T11:0${seq % 10}:00Z`, go_by: 'persona-a', ...over,
  };
}
const plan = (issues, extra = {}) => planGo({ config: cfgFor(extra.config), issues, permissions: PERMS, ...extra.input });
const one = (issues, extra) => plan(issues, extra).decisions[0];

test('Scenario: Authorised label - the issue passes the gates and starts', () => {
  const i = issue({ number: 31, title: 'Summary screen' });
  const d = one([i]);
  assert.equal(d.action, 'start');
  assert.equal(d.branch, 'feature/31-summary-screen');
  assert.equal(d.change_id, '31-summary-screen');
  assert.equal(d.base, 'dev');
  assert.equal(d.assignee, 'persona-b');
  assert.equal(d.qa_retries, 1);
  assert.equal(d.run_max_cost, 5);
  assert.equal(d.run_max_minutes, 50, 'the soft time limit travels with the decision');
  assert.deepEqual(d.labels, { add: ['relevo:building'], remove: ['relevo:ready', 'relevo:go'] });
});

test('Scenario: Unauthorised label - no run, the label is removed', () => {
  const d = one([issue({ ready_by: 'stranger' })]);
  assert.equal(d.action, 'denied');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:ready', 'relevo:go'] });
  assert.equal(d.comment.kind, 'ready_denied');
});

test('an unknown applier is treated as unauthorised', () => {
  const d = one([issue({ ready_by: null })]);
  assert.equal(d.action, 'denied');
  assert.equal(d.comment.data.actor, undefined);
});

test('Scenario: No milestone - the issue passes this gate and is built like any other', () => {
  const d = one([issue({ milestone: null })]);
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['relevo:building'], remove: ['relevo:ready', 'relevo:go'] });
  assert.equal(d.comment, null, 'no comment asks for a milestone');
});

test('no assignee means nobody to hand the result to: no run', () => {
  const d = one([issue({ assignees: [] })]);
  assert.equal(d.action, 'no-assignee');
  assert.equal(d.comment.kind, 'no_assignee');
});

test('Scenario: Spec incomplete - needs-spec, back to the spec writer, nothing is built', () => {
  const d = one([issue({ body: '## Edge cases\n- only edge cases\n' })]);
  assert.equal(d.action, 'needs-spec');
  assert.deepEqual(d.labels, { add: ['relevo:needs-spec'], remove: ['relevo:ready', 'relevo:go'] });
  assert.deepEqual(d.assign, ['persona-a']);
  assert.equal(d.comment.kind, 'needs_spec');
  assert.match(d.comment.data.missing, /WHEN\/THEN/);
});

test('Scenario: Blocked - a dependency is open, the label is set, the comment mentions nobody', () => {
  const d = one([issue({ body: `${BODY}\nDepends-on: #12\n` })]);
  assert.equal(d.action, 'block');
  assert.deepEqual(d.labels, { add: ['relevo:blocked'], remove: ['relevo:ready', 'relevo:go'] });
  assert.equal(d.comment.kind, 'blocked_notice');
  assert.equal(d.comment.data.blockers, '#12');
});

test('Scenario: Head of line is blocked - the newer eligible issue starts, the older keeps its place', () => {
  const blocked = issue({ number: 1, body: `${BODY}\nDepends-on: #12\n`, ready_at: '2026-10-14T09:00:00Z' });
  const eligible = issue({ number: 2, ready_at: '2026-10-14T10:00:00Z' });
  const { decisions } = plan([eligible, blocked]);
  assert.deepEqual(decisions.map((d) => [d.issue, d.action]), [[1, 'block'], [2, 'start']]);
});

test('Scenario: Dependency merges - the blocked issue re-enters and starts at its original position', () => {
  const was = issue({ number: 1, labels: ['relevo:blocked'], body: `${BODY}\nDepends-on: #12\n`, ready_at: '2026-10-14T09:00:00Z' });
  const newer = issue({ number: 2, ready_at: '2026-10-14T10:00:00Z' });
  const { decisions } = plan([newer, was], { input: { completed: [12] } });
  assert.deepEqual(decisions.map((d) => [d.issue, d.action]), [[1, 'start'], [2, 'start']]);
  assert.deepEqual(decisions[0].labels, { add: ['relevo:building'], remove: ['relevo:blocked'] });
});

test('still blocked on a later evaluation: no label change and no repeated comment', () => {
  const was = issue({ labels: ['relevo:blocked'], body: `${BODY}\nDepends-on: #12\n` });
  const d = one([was]);
  assert.equal(d.action, 'block');
  assert.deepEqual(d.labels, { add: [], remove: [] });
  assert.equal(d.comment, null);
});

test('Scenario: Assignee at capacity - queued with a comment that says why, and it starts when capacity frees up', () => {
  const built = (n) => issue({ number: n, labels: ['relevo:built'], assignees: ['persona-b'] });
  const waiting = issue({ number: 9 });
  const full = one([built(1), built(2), waiting]);
  assert.equal(full.action, 'queue');
  assert.deepEqual(full.labels, { add: ['relevo:queued'], remove: ['relevo:ready', 'relevo:go'] });
  assert.equal(full.comment.kind, 'queued_capacity');
  assert.deepEqual(full.comment.data, { issue: 9, title: full.comment.data.title, assignee: 'persona-b', built: 2, limit: 2, built_issues: '#1, #2' });

  const queued = issue({ number: 9, labels: ['relevo:queued'] });
  const freed = one([built(1), queued]);
  assert.equal(freed.action, 'start');
  assert.deepEqual(freed.labels, { add: ['relevo:building'], remove: ['relevo:queued'] });
});

test('capacity is per person: a full assignee does not block the others', () => {
  const fullB = [1, 2].map((n) => issue({ number: n, labels: ['relevo:built'], assignees: ['persona-b'] }));
  const forB = issue({ number: 8, assignees: ['persona-b'], ready_at: '2026-10-14T09:00:00Z' });
  const forC = issue({ number: 9, assignees: ['persona-c'], ready_at: '2026-10-14T09:30:00Z' });
  const { decisions } = plan([...fullB, forB, forC]);
  assert.deepEqual(decisions.map((d) => [d.issue, d.action]), [[8, 'queue'], [9, 'start']]);
});

test('Scenario: Queue order - first in, first out by the time ready was applied', () => {
  const a = issue({ number: 3, ready_at: '2026-10-14T12:00:00Z', assignees: ['persona-b'] });
  const b = issue({ number: 1, ready_at: '2026-10-14T08:00:00Z', assignees: ['persona-c'] });
  const c = issue({ number: 2, ready_at: '2026-10-14T10:00:00Z', assignees: ['persona-d'] });
  assert.deepEqual(plan([a, b, c]).decisions.map((d) => d.issue), [1, 2, 3]);
});

// The urgent label: valid only from someone with the permission that ready requires.
const URGENT = 'relevo:urgent';
const UPERMS = { ...PERMS, 'persona-d': 'maintain', 'persona-w': 'write' };
const urgentIssue = (over = {}) => issue({ labels: ['relevo:queued', URGENT], urgent_by: 'persona-a', ...over });
const builtBy = (assignee, n) => [1, 2, 3].slice(0, n).map((k) => issue({ number: 900 + k, labels: ['relevo:built'], assignees: [assignee] }));
const planU = (issues, config) => plan(issues, { config, input: { permissions: UPERMS } });

test('Scenario: Urgent issue jumps the line - it takes the only free slot before an older normal issue', () => {
  const older = issue({ number: 1, labels: ['relevo:queued'], assignees: ['persona-c'], ready_at: '2026-10-14T08:00:00Z' });
  const newer = urgentIssue({ number: 2, assignees: ['persona-d'], ready_at: '2026-10-14T11:00:00Z' });
  const { decisions } = planU([older, newer], 'limits:\n  concurrent_agents: 1\n');
  assert.deepEqual(decisions.map((d) => [d.issue, d.action]), [[2, 'start'], [1, 'queue']]);
  assert.equal(decisions[1].comment, null, 'the older issue was already queued and posts nothing');
});

test('Scenario: Several urgent issues - the one whose ready is older starts', () => {
  const a = urgentIssue({ number: 1, assignees: ['persona-c'], ready_at: '2026-10-14T10:00:00Z' });
  const b = urgentIssue({ number: 2, assignees: ['persona-d'], ready_at: '2026-10-14T09:00:00Z' });
  const { decisions } = planU([a, b], 'limits:\n  concurrent_agents: 1\n');
  assert.deepEqual(decisions.map((d) => [d.issue, d.action]), [[2, 'start'], [1, 'queue']]);
});

test('Scenario: Urgent issue for an assignee at capacity - it starts and says how many are waiting', () => {
  const u = urgentIssue({ number: 9 });
  const { decisions } = planU([...builtBy('persona-b', 2), u]);
  const d = decisions[0];
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['relevo:building'], remove: ['relevo:queued'] });
  assert.equal(d.urgent, true);
  assert.equal(d.built_waiting, 3);
  assert.equal(d.notice, undefined);
});

test('a start under the limit has neither urgent nor built_waiting, even for an urgent issue', () => {
  const d = planU([...builtBy('persona-b', 1), urgentIssue({ number: 9 })]).decisions[0];
  assert.equal(d.action, 'start');
  assert.ok(!('urgent' in d) && !('built_waiting' in d));
  const normal = planU([issue({ number: 9 })]).decisions[0];
  assert.ok(!('urgent' in normal) && !('built_waiting' in normal));
});

test('Scenario: Urgent issue and no free agent slot - it is queued with the agents reason, first in line', () => {
  const running = issue({ number: 50, labels: ['relevo:building'] });
  const ready = urgentIssue({ number: 9, labels: ['relevo:ready', 'relevo:go', URGENT] });
  const d = planU([running, ready], 'limits:\n  concurrent_agents: 1\n').decisions[0];
  assert.equal(d.action, 'queue');
  assert.equal(d.comment.kind, 'queued_agents');
  assert.ok(!('urgent' in d));
});

test('Scenario: Urgent issue is still blocked by a dependency - the notice says urgent does not skip it', () => {
  const u = urgentIssue({ number: 9, labels: ['relevo:ready', 'relevo:go', URGENT], body: `${BODY}\nDepends-on: #7\n` });
  const d = planU([u]).decisions[0];
  assert.equal(d.action, 'block');
  assert.equal(d.comment.kind, 'blocked_notice');
  assert.equal(d.comment.data.urgent, true);
  const normal = planU([issue({ number: 9, body: `${BODY}\nDepends-on: #7\n` })]).decisions[0];
  assert.ok(!('urgent' in normal.comment.data));
});

test('Scenario: Urgent issue with an incomplete spec - needs-spec as for any other issue', () => {
  const u = urgentIssue({ number: 9, labels: ['relevo:ready', 'relevo:go', URGENT], body: 'no scenarios' });
  const d = planU([...builtBy('persona-b', 2), u]).decisions[0];
  assert.equal(d.action, 'needs-spec');
});

test('Scenario: Applied by someone with write access - the label is valid and leaves no notice', () => {
  const d = planU([...builtBy('persona-b', 2), urgentIssue({ number: 9, urgent_by: 'persona-w' })]).decisions[0];
  assert.equal(d.action, 'start');
  assert.equal(d.notice, undefined);
  assert.ok(!d.labels.remove.includes(URGENT));
});

test('Scenario: Applied without permission - the label is removed with a notice and the issue stays queued in its place', () => {
  const u = urgentIssue({ number: 9, urgent_by: 'stranger' });
  const d = planU([...builtBy('persona-b', 2), u]).decisions[0];
  assert.equal(d.action, 'queue');
  assert.deepEqual(d.labels, { add: [], remove: [URGENT] });
  assert.deepEqual(d.notice, { kind: 'urgent_denied', data: { issue: 9, actor: 'stranger' } });
  assert.equal(d.comment, null, 'it was already queued, so the queued notice is not posted again');
});

test('an invalid label is ordered as a normal issue', () => {
  const older = issue({ number: 1, labels: ['relevo:queued'], assignees: ['persona-c'], ready_at: '2026-10-14T08:00:00Z' });
  const denied = urgentIssue({ number: 2, urgent_by: 'stranger', assignees: ['persona-d'], ready_at: '2026-10-14T11:00:00Z' });
  const { decisions } = planU([denied, older], 'limits:\n  concurrent_agents: 1\n');
  assert.deepEqual(decisions.map((d) => [d.issue, d.action]), [[1, 'start'], [2, 'queue']]);
});

test('Scenario: Public repository - write is not enough, the notice asks for a maintainer', () => {
  const config = 'trust: public\n';
  const writer = planU([...builtBy('persona-b', 2), urgentIssue({ number: 9, urgent_by: 'persona-w' })], config).decisions[0];
  assert.equal(writer.action, 'queue');
  assert.deepEqual(writer.labels.remove, [URGENT]);
  assert.deepEqual(writer.notice, { kind: 'urgent_denied_maintainer', data: { issue: 9, actor: 'persona-w' } });
  const maintainer = planU([...builtBy('persona-b', 2), urgentIssue({ number: 9, urgent_by: 'persona-d' })], config).decisions[0];
  assert.equal(maintainer.action, 'start');
});

test('Scenario: Applied by a bot - a login with no permission is not valid', () => {
  const d = planU([...builtBy('persona-b', 2), urgentIssue({ number: 9, urgent_by: 'github-actions[bot]' })]).decisions[0];
  assert.equal(d.action, 'queue');
  assert.deepEqual(d.labels.remove, [URGENT]);
  assert.equal(d.notice.kind, 'urgent_denied');
});

test('a label with no known applier is not valid', () => {
  const d = planU([urgentIssue({ number: 9, urgent_by: null })]).decisions[0];
  assert.equal(d.action, 'start', 'it is evaluated as a normal issue');
  assert.deepEqual(d.labels.remove, ['relevo:queued', URGENT]);
  assert.deepEqual(d.notice.data, { issue: 9 });
});

test('an invalid label on an issue with a run in progress is left alone and posts nothing', () => {
  const stranger = urgentIssue({ number: 5, labels: ['relevo:ready', 'relevo:go', URGENT], urgent_by: 'stranger' });
  const skipped = plan([stranger], { input: { permissions: UPERMS, running: [5] } }).decisions[0];
  assert.equal(skipped.action, 'skip');
  assert.deepEqual(skipped.labels, { add: [], remove: [] });
  assert.equal(skipped.notice, undefined);
});

test('a renamed urgent label is the one that counts', () => {
  const config = 'labels:\n  urgent: prio:now\n';
  const u = urgentIssue({ number: 9, labels: ['relevo:queued', 'prio:now'], urgent_by: 'persona-d' });
  const d = planU([...builtBy('persona-b', 2), u], config).decisions[0];
  assert.equal(d.action, 'start');
  const denied = planU([...builtBy('persona-b', 2), { ...u, urgent_by: 'stranger' }], config).decisions[0];
  assert.deepEqual(denied.labels.remove, ['prio:now']);
});

test('Scenario: Duplicate trigger - an issue with a run in progress is not started twice', () => {
  const running = issue({ number: 5, labels: ['relevo:ready', 'relevo:go'] });
  const d = one([running], { input: { running: [5] } });
  assert.equal(d.action, 'skip');
  assert.deepEqual(d.labels, { add: [], remove: [] });
});

test('an issue already labelled building counts as a run in progress', () => {
  const building = issue({ number: 5, labels: ['relevo:building'] });
  assert.equal(plan([building]).decisions.length, 0);
});

test('Concurrency limit: runs above the cap are queued', () => {
  const issues = [1, 2, 3].map((n) => issue({ number: n, assignees: [`p${n}`], ready_at: `2026-10-14T10:0${n}:00Z` }));
  const { decisions } = plan(issues, { config: 'limits:\n  concurrent_agents: 2\n' });
  assert.deepEqual(decisions.map((d) => d.action), ['start', 'start', 'queue']);
  assert.equal(decisions[2].comment.kind, 'queued_agents');
});

test('runs already in progress use up the concurrency slots', () => {
  const building = issue({ number: 50, labels: ['relevo:building'] });
  const next = issue({ number: 51 });
  const { decisions } = plan([building, next], { config: 'limits:\n  concurrent_agents: 1\n' });
  assert.deepEqual(decisions.map((d) => d.action), ['queue']);
});

test('Scenario: Queue re-evaluation - running the plan again changes nothing when nothing changed', () => {
  const queued = issue({ number: 9, labels: ['relevo:queued'] });
  const built = [1, 2].map((n) => issue({ number: n, labels: ['relevo:built'], assignees: ['persona-b'] }));
  const d = one([...built, queued]);
  assert.equal(d.action, 'queue');
  assert.deepEqual(d.labels, { add: [], remove: [] });
  assert.equal(d.comment, null);
});

test('closed issues and issues without a Relevo state are ignored', () => {
  const closed = issue({ state: 'closed' });
  const plain = issue({ labels: ['bug'] });
  assert.equal(plan([closed, plain]).decisions.length, 0);
});

test('renamed labels are honoured', () => {
  const i = issue({ labels: ['listo', 'ya'] });
  const d = one([i], { config: 'labels:\n  ready: listo\n  go: ya\n  building: construyendo\n' });
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['construyendo'], remove: ['listo', 'ya'] });
});

test('the summary counts decisions by action', () => {
  const issues = [issue({ number: 1, assignees: ['p1'] }), issue({ number: 2, assignees: [] })];
  assert.deepEqual(plan(issues).summary, { start: 1, 'no-assignee': 1 });
});

// ---------- The text that was approved, and the dependency files the issue lets the change touch

import { issueHash } from '../scripts/lib/issue-hash.mjs';

test('Scenario: Issue unchanged - the start decision carries the hash of the text it claimed', () => {
  const i = issue({ number: 40, title: 'Show the total', body: BODY });
  const d = one([i]);
  assert.equal(d.action, 'start');
  assert.equal(d.issue_hash, issueHash({ title: 'Show the total', body: BODY }));
  assert.match(d.issue_hash, /^[0-9a-f]{64}$/);
});

test('Scenario: Issue edited after ready - another text gives another hash, and whitespace does not', () => {
  const base = one([issue({ title: 'Show the total', body: BODY })]).issue_hash;
  assert.notEqual(one([issue({ title: 'Show the total', body: BODY.replace('b', 'c') })]).issue_hash, base);
  assert.equal(one([issue({ title: 'Show the total', body: BODY.replace(/\n/g, '\r\n') })]).issue_hash, base);
});

test('Scenario: Lock file with permission - the Allow-paths line of the issue travels in the start decision', () => {
  assert.deepEqual(one([issue({ body: `${BODY}\nAllow-paths: pubspec.yaml, pubspec.lock\n` })]).allow_paths, ['pubspec.yaml', 'pubspec.lock']);
  assert.deepEqual(one([issue({ body: BODY })]).allow_paths, [], 'nothing is allowed by default');
});

test('only the start decision carries the hash and the allowed paths', () => {
  const blocked = one([issue({ body: `${BODY}\nDepends-on: #1\nAllow-paths: pubspec.lock\n` })]);
  assert.equal(blocked.action, 'block');
  assert.equal('issue_hash' in blocked, false);
  assert.equal('allow_paths' in blocked, false);
});

test('Scenario: Missing information - the needs-spec comment says the reason is missing', () => {
  const d = one([issue({ body: 'no scenarios here' })]);
  assert.equal(d.action, 'needs-spec');
  assert.equal(d.comment.data.reason, 'missing');
});

test('Scenario: One platform builds as before, and the legacy setting counts as one', () => {
  assert.equal(one([issue()]).action, 'start');
  assert.equal(one([issue()], { config: 'platform: flutter-android\n' }).action, 'start');
  assert.equal(one([issue()], { config: 'platforms:\n  app:\n    stack: flutter\n' }).action, 'start');
});

const TWO = 'platforms:\n  web:\n    stack: vue\n    path: apps/web\n  api:\n    stack: laravel\n    path: apps/api\n';

test('Scenario: Platform resolved - the start decision carries platform, stack, path and targets', () => {
  const d = one([issue({ body: `${BODY}\nPlatform: web\n` })], { config: TWO });
  assert.equal(d.action, 'start');
  assert.deepEqual([d.platform, d.stack, d.path, d.targets], ['web', 'vue', 'apps/web', []]);
  const single = one([issue()]);
  assert.deepEqual([single.platform, single.stack, single.path, single.targets], ['app', 'flutter', '.', ['android']], 'one platform and no line');
});

test('Scenario: Several platforms and no line - needs-spec names the platforms and says to add the line', () => {
  const d = one([issue()], { config: TWO });
  assert.equal(d.action, 'needs-spec');
  assert.deepEqual(d.labels.add, ['relevo:needs-spec']);
  assert.deepEqual(d.assign, ['persona-a']);
  assert.match(d.comment.data.missing, /Platform: line naming one of the platforms of relevo\.yml \(web, api\)/);
  assert.equal(d.platform, undefined, 'nothing is claimed');
});

test('an unknown platform and two different platforms also go back to the spec writer', () => {
  const unknown = one([issue({ body: `${BODY}\nPlatform: mobile\n` })], { config: TWO });
  assert.equal(unknown.action, 'needs-spec');
  assert.match(unknown.comment.data.missing, /Platform: mobile, which is not a platform/);
  const both = one([issue({ body: `${BODY}\nPlatform: web\nPlatform: api\n` })], { config: TWO });
  assert.match(both.comment.data.missing, /names two platforms/);
  assert.equal(one([issue({ body: `${BODY}\nPlatform: web\n` })]).action, 'needs-spec', 'with one platform a wrong name is still wrong');
});

test('an issue that was queued and then edited so its platform no longer resolves goes back instead of building', () => {
  const d = one([issue({ labels: ['relevo:queued'], body: `${BODY}\nPlatform: mobile\n` })], { config: TWO });
  assert.equal(d.action, 'needs-spec');
});

test('the permission check still comes before the platform check, so a stranger still gets the denial', () => {
  const d = one([issue({ ready_by: 'stranger' })], { config: TWO });
  assert.equal(d.action, 'denied');
});

// ---------- dependencies on other repositories

const LINKS = 'links: [acme/api, acme/design]\n';
const dep = (line, over = {}) => issue({ body: `${BODY}\n${line}\n`, ...over });

test('Scenario: Blocked by another repository - an open linked dependency blocks, naming it', () => {
  const d = one([dep('Depends-on: acme/api#12')], { config: LINKS });
  assert.equal(d.action, 'block');
  assert.equal(d.reason, 'waiting for acme/api#12');
  assert.deepEqual(d.labels.add, ['relevo:blocked']);
  assert.equal(d.comment.data.blockers, 'acme/api#12');
});

test('Scenario: Dependency completed - a completed external dependency lets the issue start, mixed with a local one', () => {
  const input = { completedExternal: ['acme/api#12'], completed: [3] };
  assert.equal(one([dep('Depends-on: acme/api#12')], { config: LINKS, input }).action, 'start');
  assert.equal(one([dep('Depends-on: #3, acme/api#12')], { config: LINKS, input }).action, 'start');
  const partly = one([dep('Depends-on: #4, acme/api#12')], { config: LINKS, input });
  assert.equal(partly.action, 'block');
  assert.equal(partly.comment.data.blockers, '#4');
});

test('Scenario: Dependency unreadable - it blocks, and the notice says it could not be read and which secret to check', () => {
  const d = one([dep('Depends-on: acme/api#12')], { config: LINKS, input: { unreadable: ['acme/api#12'] } });
  assert.equal(d.action, 'block');
  assert.match(d.comment.data.blockers, /acme\/api#12 \(could not be read: check the RELEVO_LINKS_TOKEN secret and that acme\/api is in links\)/);
});

test('Scenario: Not linked - the issue goes back to the spec writer, naming the repository and the linked ones', () => {
  const d = one([dep('Depends-on: other/repo#4')], { config: LINKS });
  assert.equal(d.action, 'needs-spec');
  assert.match(d.comment.data.missing, /a Depends-on that names other\/repo, which is not in links of relevo\.yml \(acme\/api, acme\/design\)/);
  assert.match(one([dep('Depends-on: other/repo#4')]).comment.data.missing, /no repository is linked/);
});

test('an invalid reference goes back too, and a queued or blocked issue edited into an unlinked reference does not stay blocked forever', () => {
  const invalid = one([dep('Depends-on: acme/api 12')], { config: LINKS });
  assert.equal(invalid.action, 'needs-spec');
  assert.match(invalid.comment.data.missing, /a valid Depends-on reference instead of "acme\/api"/);
  const edited = one([dep('Depends-on: other/repo#4', { labels: ['relevo:blocked'] })], { config: LINKS });
  assert.equal(edited.action, 'needs-spec');
});

test('the own repository written in full is a local reference', () => {
  const input = { repo: 'acme/web', completed: [12] };
  assert.equal(one([dep('Depends-on: acme/web#12')], { config: LINKS, input }).action, 'start');
  assert.equal(one([dep('Depends-on: Acme/Web#13')], { config: LINKS, input }).reason, 'waiting for #13');
});

test('external reference names are compared without regard to case', () => {
  assert.equal(one([dep('Depends-on: ACME/API#12')], { config: LINKS, input: { completedExternal: ['acme/api#12'] } }).action, 'start');
});

test('Scenario: Question left in the issue - a ready issue with an open question becomes needs-spec as ambiguous, nothing is built', () => {
  const d = one([issue({ body: `${BODY}\n## Open questions\n\n- Should clients without a phone be listed?\n` })]);
  assert.equal(d.action, 'needs-spec');
  assert.equal(d.comment.data.reason, 'ambiguous');
  assert.match(d.comment.data.missing, /open question "Should clients without a phone be listed\?"/);
  assert.deepEqual(d.labels, { add: ['relevo:needs-spec'], remove: ['relevo:ready', 'relevo:go'] });
});

test('NEEDS CLARIFICATION in the issue is ambiguous too, and a body with no questions still starts', () => {
  const d = one([issue({ body: `${BODY}\nNEEDS CLARIFICATION: the order\n` })]);
  assert.equal(d.comment.data.reason, 'ambiguous');
  assert.equal(one([issue({ body: `${BODY}\n## Open questions\n\nNone\n` })]).action, 'start');
});

test('an ambiguity together with missing parts is still ambiguous, and names both', () => {
  const d = one([issue({ body: '## Open questions\n- which order?\n' })]);
  assert.equal(d.comment.data.reason, 'ambiguous');
  assert.match(d.comment.data.missing, /WHEN\/THEN.*open question/);
});

// --- Retry of a build-failed issue without a branch (go-retry-build-failed) ---
const failed = (over = {}) => issue({ labels: ['relevo:build-failed'], ready_by: null, ready_at: null, ...over });
const retryOf = (i, by = 'persona-a') => ({ input: { retry: { issue: i.number, by } } });

test('Scenario: Retry of a build-failed issue without a branch - it starts, claims building and never adds ready', () => {
  const i = failed({ number: 67, title: 'Summary screen' });
  const d = one([i], retryOf(i));
  assert.equal(d.action, 'start');
  assert.equal(d.branch, 'feature/67-summary-screen');
  assert.deepEqual(d.labels, { add: ['relevo:building'], remove: ['relevo:build-failed'] });
  assert.equal(d.comment, null, 'the claim posts no comment');
});

test('Scenario: Without the flag - a build-failed issue is still ignored', () => {
  assert.deepEqual(plan([failed()]).decisions, []);
});

test('Scenario: The person may not start work - read access, or a non-maintainer in a public repository', () => {
  const i = failed();
  const readOnly = one([i], retryOf(i, 'stranger'));
  assert.equal(readOnly.action, 'denied');
  assert.deepEqual(readOnly.labels, { add: [], remove: [] }, 'the issue stays build-failed');
  const j = failed();
  const publicRepo = one([j], { config: 'trust: public\n', ...retryOf(j) });
  assert.equal(publicRepo.action, 'denied');
  assert.equal(publicRepo.comment.kind, 'ready_denied_maintainer');
  const k = failed();
  assert.equal(one([k], { config: 'trust: public\n', input: { retry: { issue: k.number, by: 'persona-m' }, permissions: { 'persona-m': 'maintain' } } }).action, 'start');
});

test('Scenario: A retried issue without a milestone - the decision is start', () => {
  const noMilestone = failed({ milestone: null });
  assert.equal(one([noMilestone], retryOf(noMilestone)).action, 'start');
});

test('Scenario: Gates still apply - no assignee, incomplete specification', () => {
  const noAssignee = failed({ assignees: [] });
  assert.equal(one([noAssignee], retryOf(noAssignee)).action, 'no-assignee');
  const incomplete = failed({ body: 'just a title' });
  const d = one([incomplete], retryOf(incomplete));
  assert.equal(d.action, 'needs-spec');
  assert.deepEqual(d.labels.remove, ['relevo:build-failed'], 'needs-spec replaces the state label');
});

test('Scenario: The issue is not build-failed - nothing changes', () => {
  const built = issue({ labels: ['relevo:built'] });
  const d = one([built], retryOf(built));
  assert.equal(d.action, 'skip');
  assert.match(d.reason, /only an open issue labelled build-failed/);
  assert.deepEqual(d.labels, { add: [], remove: [] });
  const gone = one([], { input: { retry: { issue: 999, by: 'persona-a' } } });
  assert.equal(gone.action, 'skip');
});

test('a retry plans only the retried issue as build-failed; another build-failed issue is ignored', () => {
  const a = failed();
  const b = failed();
  const decisions = plan([a, b], retryOf(a)).decisions;
  assert.deepEqual(decisions.map((d) => d.issue), [a.number]);
});

// Gate 4, files shared with another issue.
const naming = (...files) => `${BODY}\n## Code pointers\n\n${files.map((f) => `- \`${f}\``).join('\n')}\n`;
const NOW = '2026-10-15T12:00:00Z';

test('Scenario: Two issues name the same registry file - the later one is queued with a comment that names the file and the issue', () => {
  const active = issue({ number: 12, labels: ['relevo:building'], body: naming('src/router.ts') });
  const later = issue({ number: 15, body: naming('src/router.ts', 'src/Screen.vue') });
  const d = plan([active, later], { input: { now: NOW } }).decisions.find((x) => x.issue === 15);
  assert.equal(d.action, 'queue');
  assert.deepEqual(d.labels, { add: ['relevo:queued'], remove: ['relevo:ready', 'relevo:go'] });
  assert.equal(d.comment.kind, 'queued_shared_files');
  assert.equal(d.comment.data.file, 'src/router.ts');
  assert.equal(d.comment.data.other, 12);
  assert.equal(d.comment.data.hours, 24);
});

test('Scenario: The first issue merges - the issue that waited only for the file starts', () => {
  const waiting = issue({ number: 15, labels: ['relevo:queued'], body: naming('src/router.ts'), shared_wait: { file: 'src/router.ts', other: 12, at: '2026-10-15T08:00:00Z' } });
  const d = one([waiting], { input: { now: NOW } });
  assert.equal(d.action, 'start');
  assert.equal(d.shared_files, undefined);
});

test('Scenario: The first issue is still ahead in the queue - only the older ready label may start', () => {
  const older = issue({ number: 20, body: naming('src/router.ts'), ready_at: '2026-10-14T10:00:00Z' });
  const newer = issue({ number: 21, body: naming('src/router.ts'), ready_at: '2026-10-14T11:00:00Z' });
  const { decisions } = plan([newer, older], { input: { now: NOW } });
  assert.equal(decisions.find((x) => x.issue === 20).action, 'start');
  const waits = decisions.find((x) => x.issue === 21);
  assert.equal(waits.action, 'queue');
  assert.equal(waits.comment.data.other, 20);
});

test('Scenario: An issue that names no file - the gate never holds it', () => {
  const active = issue({ number: 12, labels: ['relevo:building'], body: naming('src/router.ts') });
  assert.equal(plan([active, issue({ number: 15 })], { input: { now: NOW } }).decisions.find((x) => x.issue === 15).action, 'start');
});

test('Scenario: A blocked issue ahead does not hold the line - the newer one starts', () => {
  const older = issue({ number: 20, body: `${naming('src/router.ts')}\nDepends-on: #999\n`, ready_at: '2026-10-14T10:00:00Z' });
  const newer = issue({ number: 21, body: naming('src/router.ts'), ready_at: '2026-10-14T11:00:00Z' });
  const { decisions } = plan([older, newer], { input: { now: NOW } });
  assert.equal(decisions.find((x) => x.issue === 20).action, 'block');
  assert.equal(decisions.find((x) => x.issue === 21).action, 'start');
});

test('Scenario: An issue in review still holds its files until it is merged', () => {
  const inReview = issue({ number: 12, labels: ['relevo:in-review'], body: naming('src/router.ts') });
  const pr = issue({ number: 13, labels: ['relevo:pr-open'], body: naming('src/other.ts') });
  const later = issue({ number: 15, body: naming('src/router.ts') });
  const { decisions } = plan([inReview, pr, later], { input: { now: NOW } });
  assert.equal(decisions.find((x) => x.issue === 15).action, 'queue');
});

test('Scenario: Append-only and generated files - only the files outside both lists make an issue wait', () => {
  const config = 'queue:\n  append_only:\n    - src/nav/items.ts\nintegration:\n  generated:\n    - "src/gql/**"\n  regenerate: npm run codegen\n';
  const active = issue({ number: 12, labels: ['relevo:building'], body: naming('src/nav/items.ts', 'src/gql/types.ts') });
  const only = issue({ number: 15, body: naming('src/nav/items.ts', 'src/gql/types.ts') });
  assert.equal(plan([active, only], { config, input: { now: NOW } }).decisions.find((x) => x.issue === 15).action, 'start');
  const both = issue({ number: 16, body: naming('src/nav/items.ts', 'src/router.ts') });
  const active2 = issue({ number: 12, labels: ['relevo:building'], body: naming('src/nav/items.ts', 'src/router.ts') });
  const d = plan([active2, both], { config, input: { now: NOW } }).decisions.find((x) => x.issue === 16);
  assert.equal(d.action, 'queue');
  assert.equal(d.comment.data.file, 'src/router.ts');
});

test('Scenario: The first issue takes too long - after the bound the issue starts and the start decision lists the shared files', () => {
  const active = issue({ number: 12, labels: ['relevo:building'], body: naming('src/router.ts') });
  const waiting = issue({ number: 15, labels: ['relevo:queued'], body: naming('src/router.ts'), shared_wait: { file: 'src/router.ts', other: 12, at: '2026-10-14T11:00:00Z' } });
  const d = plan([active, waiting], { config: 'limits:\n  shared_file_wait_hours: 24\n  concurrent_agents: 3\n', input: { now: NOW } }).decisions.find((x) => x.issue === 15);
  assert.equal(d.action, 'start');
  assert.deepEqual(d.shared_files, [{ file: 'src/router.ts', issue: 12 }]);
  // The bound is not a dependency: the labels are those of any other start.
  assert.deepEqual(d.labels, { add: ['relevo:building'], remove: ['relevo:queued'] });
});

test('Scenario: Inside the bound - the issue keeps waiting and posts nothing again', () => {
  const active = issue({ number: 12, labels: ['relevo:building'], body: naming('src/router.ts') });
  const waiting = issue({ number: 15, labels: ['relevo:queued'], body: naming('src/router.ts'), shared_wait: { file: 'src/router.ts', other: 12, at: '2026-10-15T08:00:00Z' } });
  const d = plan([active, waiting], { input: { now: NOW } }).decisions.find((x) => x.issue === 15);
  assert.equal(d.action, 'queue');
  assert.equal(d.comment, null);
});

test('Scenario: The reason changes - a new comment names the new issue and the bound is counted again', () => {
  const active = issue({ number: 18, labels: ['relevo:building'], body: naming('src/router.ts') });
  const waiting = issue({ number: 15, labels: ['relevo:queued'], body: naming('src/router.ts'), shared_wait: { file: 'src/router.ts', other: 12, at: '2026-10-10T08:00:00Z' } });
  const d = plan([active, waiting], { input: { now: NOW } }).decisions.find((x) => x.issue === 15);
  assert.equal(d.action, 'queue');
  assert.equal(d.comment.kind, 'queued_shared_files');
  assert.equal(d.comment.data.other, 18);
});

test('Scenario: An urgent issue is compared in its own position - it goes ahead of an older issue that names the same file', () => {
  const older = issue({ number: 20, body: naming('src/router.ts'), ready_at: '2026-10-14T10:00:00Z' });
  const urgent = issue({ number: 21, body: naming('src/router.ts'), labels: ['relevo:ready', 'relevo:go', 'relevo:urgent'], urgent_by: 'persona-a', ready_at: '2026-10-14T11:00:00Z' });
  const { decisions } = plan([older, urgent], { input: { now: NOW } });
  assert.equal(decisions.find((x) => x.issue === 21).action, 'start');
  assert.equal(decisions.find((x) => x.issue === 20).action, 'queue');
});

// ---------- A queued issue says its position and what it waits for (issue #127)

test('Scenario: Slots full, issues ahead - the comment counts the active runs, which they are and the issues queued before it', () => {
  const running = [50, 51].map((n) => issue({ number: n, labels: ['relevo:building'], assignees: [`p${n}`] }));
  const ahead = issue({ number: 7, assignees: ['p7'], labels: ['relevo:queued'], ready_at: '2026-10-14T09:00:00Z' });
  const first = issue({ number: 8, assignees: ['p8'], ready_at: '2026-10-14T09:30:00Z' });
  const mine = issue({ number: 9, assignees: ['p9'], ready_at: '2026-10-14T10:00:00Z' });
  const { decisions } = plan([...running, ahead, first, mine], { config: 'limits:\n  concurrent_agents: 2\n', input: { recentBuilds: [30, 40, 20, 50, 10] } });
  const byIssue = Object.fromEntries(decisions.map((d) => [d.issue, d]));
  // #7 was queued before: it posts nothing but it is ahead of the others.
  assert.equal(byIssue[7].comment, null);
  assert.deepEqual(byIssue[8].comment.data, { issue: 8, title: byIssue[8].comment.data.title, active: 2, active_issues: '#50, #51', ahead: 1, typical_minutes: 30, typical_samples: 5 });
  assert.equal(byIssue[9].comment.data.ahead, 2);
});

test('the first issue of the queue has nobody ahead, and zero is a figure', () => {
  const building = issue({ number: 50, labels: ['relevo:building'] });
  const d = one([building, issue({ number: 9 })], { config: 'limits:\n  concurrent_agents: 1\n' });
  assert.equal(d.comment.data.ahead, 0);
  assert.equal(d.comment.data.active, 1);
});

test('Scenario: No recent runs - fewer than three builds, or a failed read, leave the typical duration out', () => {
  const building = issue({ number: 50, labels: ['relevo:building'] });
  const cfg = { config: 'limits:\n  concurrent_agents: 1\n' };
  [[], [10, 20], null, undefined, 'x', [Number.NaN, -5, 10]].forEach((recentBuilds) => {
    const data = one([building, issue({ number: 9 })], { ...cfg, input: { recentBuilds } }).comment.data;
    assert.ok(!('typical_minutes' in data) && !('typical_samples' in data), JSON.stringify(recentBuilds));
  });
  // The reader of the repository may fail: the plan goes on.
  const data = one([building, issue({ number: 9 })], { ...cfg, input: { recentBuilds: () => { throw new Error('403'); } } }).comment.data;
  assert.ok(!('typical_minutes' in data));
});

test('the median is of the minutes given, and the reader is called once and only when a queue comment needs it', () => {
  let calls = 0;
  const reader = () => { calls += 1; return [10, 20, 30, 40]; };
  const none = plan([issue({ number: 9 })], { input: { recentBuilds: reader } });
  assert.equal(none.decisions[0].action, 'start');
  assert.equal(calls, 0, 'a plan that queues nothing reads nothing');
  const building = issue({ number: 50, labels: ['relevo:building'] });
  const { decisions } = plan([building, issue({ number: 8, ready_at: '2026-10-14T10:00:00Z' }), issue({ number: 9, ready_at: '2026-10-14T10:05:00Z' })], { config: 'limits:\n  concurrent_agents: 1\n', input: { recentBuilds: reader } });
  assert.equal(calls, 1);
  assert.equal(decisions[0].comment.data.typical_minutes, 25, 'the median of an even list is the mean of the middle two');
  assert.equal(decisions[1].comment.data.typical_samples, 4);
});

// --- split-ready-and-go: the planner in the cloud ---

const cloud = (issues, extra = {}) => plan(issues, { ...extra, input: { place: 'cloud', ...(extra.input ?? {}) } });

test('Scenario: Approval alone - a ready issue with no go label is not a candidate in the cloud', () => {
  const r = cloud([issue({ number: 42, labels: ['relevo:ready'], go_by: null, go_at: null })]);
  assert.deepEqual(r.decisions, []);
});

test('the place of the build is cloud when none is given', () => {
  assert.deepEqual(plan([issue({ labels: ['relevo:ready'], go_by: null, go_at: null })]).decisions, []);
});

test('Scenario: Request on an approved issue - a valid go passes the gates, and the claim removes go with ready', () => {
  const d = cloud([issue({ number: 42 })]).decisions[0];
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['relevo:building'], remove: ['relevo:ready', 'relevo:go'] });
});

test('Scenario: Request by someone without write access - go is removed, the issue stays ready, the comment names who applied it', () => {
  const d = cloud([issue({ number: 42, go_by: 'stranger' })]).decisions[0];
  assert.equal(d.action, 'denied');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:go'] });
  assert.equal(d.comment.kind, 'go_denied');
  assert.equal(d.comment.data.actor, 'stranger');
});

test('Scenario: Public repository - a request by a collaborator with write but not maintain access is removed', () => {
  const d = cloud([issue({ number: 42, ready_by: 'persona-m', go_by: 'persona-a' })], { input: { permissions: { 'persona-m': 'maintain', 'persona-a': 'write' } }, config: 'trust: public\nreview:\n  mode: peer\n' }).decisions[0];
  assert.equal(d.action, 'denied');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:go'] });
  assert.equal(d.comment.kind, 'go_denied_maintainer');
});

test('Scenario: Applied by a bot - a login with no permission makes the request not valid', () => {
  const d = cloud([issue({ number: 42, go_by: 'github-actions[bot]' })]).decisions[0];
  assert.equal(d.action, 'denied');
  assert.deepEqual(d.labels.remove, ['relevo:go']);
});

test('a request with no known applier is not valid', () => {
  const d = cloud([issue({ number: 42, go_by: null })]).decisions[0];
  assert.equal(d.action, 'denied');
  assert.equal(d.comment.data.actor, undefined);
});

test('Scenario: Unauthorised label - ready applied without permission removes ready and go', () => {
  const d = cloud([issue({ number: 42, ready_by: 'stranger' })]).decisions[0];
  assert.equal(d.action, 'denied');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:ready', 'relevo:go'] });
  assert.equal(d.comment.kind, 'ready_denied');
});

test('Scenario: Request by a non-maintainer - with trust public, a maintainer approved and a writer requested: no run, go removed', () => {
  const d = cloud([issue({ number: 42, ready_by: 'persona-m', go_by: 'persona-a' })], { input: { permissions: { 'persona-m': 'admin', 'persona-a': 'write' } }, config: 'trust: public\nreview:\n  mode: peer\n' }).decisions[0];
  assert.notEqual(d.action, 'start');
  assert.ok(d.labels.remove.includes('relevo:go'));
});

const refused = (labels) => cloud([issue({ number: 42, labels })]).decisions.find((d) => d.issue === 42);

test('Scenario: Draft - go on an issue with no lifecycle label is refused: it needs ready first', () => {
  const d = refused(['relevo:go']);
  assert.equal(d.action, 'refuse');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:go'] });
  assert.equal(d.comment.kind, 'go_needs_ready');
});

test('go on a needs-spec issue needs ready first too', () => {
  const d = refused(['relevo:needs-spec', 'relevo:go']);
  assert.equal(d.action, 'refuse');
  assert.equal(d.comment.kind, 'go_needs_ready');
  assert.deepEqual(d.labels.remove, ['relevo:go']);
});

test('Scenario: Already building - go is removed, the comment says it is being built, and the build is not touched', () => {
  const d = refused(['relevo:building', 'relevo:go']);
  assert.equal(d.action, 'refuse');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:go'] });
  assert.equal(d.comment.kind, 'go_building');
});

test('Scenario: Already built - go on built, in-review or pr-open is refused as already built', () => {
  ['relevo:built', 'relevo:in-review', 'relevo:pr-open', 'relevo:changes-requested'].forEach((state) => {
    const d = refused([state, 'relevo:go']);
    assert.equal(d.action, 'refuse', state);
    assert.equal(d.comment.kind, 'go_already_built', state);
    assert.equal(d.comment.data.state, state.replace('relevo:', ''), 'the comment gives the next step of this state');
    assert.deepEqual(d.labels, { add: [], remove: ['relevo:go'] }, state);
  });
});

test('Scenario: Failed build with code - go on build-failed with a branch says to run fix', () => {
  const d = cloud([issue({ number: 42, labels: ['relevo:build-failed', 'relevo:go'], has_branch: true })]).decisions[0];
  assert.equal(d.action, 'refuse');
  assert.equal(d.comment.kind, 'go_use_fix');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:go'] });
});

test('Scenario: Rebuild in the cloud - go on build-failed with no branch is a retry: building, never ready', () => {
  const d = cloud([issue({ number: 67, labels: ['relevo:build-failed', 'relevo:go'], has_branch: false })]).decisions[0];
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['relevo:building'], remove: ['relevo:build-failed', 'relevo:go'] });
});

test('a rebuild requested by someone without permission is refused like any request', () => {
  const d = cloud([issue({ number: 67, labels: ['relevo:build-failed', 'relevo:go'], has_branch: false, go_by: 'stranger' })]).decisions[0];
  assert.equal(d.action, 'denied');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:go'] });
  assert.equal(d.comment.kind, 'go_denied');
});

test('a rebuild still passes the gates: no assignee goes back with go removed, no milestone does not matter', () => {
  const d = cloud([issue({ number: 67, labels: ['relevo:build-failed', 'relevo:go'], has_branch: false, assignees: [] })]).decisions[0];
  assert.equal(d.action, 'no-assignee');
  assert.ok(d.labels.remove.includes('relevo:go'));
  const m = cloud([issue({ number: 68, labels: ['relevo:build-failed', 'relevo:go'], has_branch: false, milestone: null })]).decisions[0];
  assert.equal(m.action, 'start');
});

test('go on build-failed whose branch could not be looked for builds nothing and changes nothing', () => {
  const d = cloud([issue({ number: 67, labels: ['relevo:build-failed', 'relevo:go'], has_branch: null })]).decisions[0];
  assert.equal(d.action, 'report');
  assert.deepEqual(d.labels, { add: [], remove: [] });
  assert.equal(d.comment, null);
});

test('Scenario: queued and blocked with go - the label is dropped silently, the request was already made', () => {
  const q = cloud([issue({ number: 42, labels: ['relevo:queued', 'relevo:go'] }), issue({ number: 43, labels: ['relevo:building'] })], { config: 'limits:\n  concurrent_agents: 1\n' }).decisions.find((x) => x.issue === 42);
  assert.equal(q.action, 'queue');
  assert.deepEqual(q.labels, { add: [], remove: ['relevo:go'] });
  assert.equal(q.comment, null);
});

test('Scenario: Request consumed - go is removed by every decision of the cloud', () => {
  const full = { config: 'limits:\n  concurrent_agents: 1\n' };
  const cases = [
    cloud([issue({ assignees: [] })]).decisions[0],
    cloud([issue({ body: '## Edge cases\n- only\n' })]).decisions[0],
    cloud([issue({ body: `${BODY}\nDepends-on: #7\n` })]).decisions[0],
    cloud([issue({ number: 41, labels: ['relevo:building'] }), issue({ number: 43 })], full).decisions.find((x) => x.issue === 43),
    cloud([issue()]).decisions[0],
  ];
  assert.deepEqual(cases.map((d) => d.action), ['no-assignee', 'needs-spec', 'block', 'queue', 'start']);
  cases.forEach((d) => assert.ok(d.labels.remove.includes('relevo:go'), d.action));
});

test('Scenario: Left waiting - the issue is queued without go and starts when a slot frees up, with no second request', () => {
  const full = { config: 'limits:\n  concurrent_agents: 1\n' };
  const d = cloud([issue({ labels: ['relevo:building'] }), issue({ number: 42 })], full).decisions.find((x) => x.issue === 42);
  assert.equal(d.action, 'queue');
  assert.deepEqual(d.labels, { add: ['relevo:queued'], remove: ['relevo:ready', 'relevo:go'] });
  const later = cloud([issue({ number: 42, labels: ['relevo:queued'] })], full).decisions[0];
  assert.equal(later.action, 'start');
  assert.deepEqual(later.labels, { add: ['relevo:building'], remove: ['relevo:queued'] });
});

test('Scenario: blocked built later with no label - a blocked issue whose dependency merged starts', () => {
  const d = cloud([issue({ number: 42, labels: ['relevo:blocked'], body: `${BODY}\nDepends-on: #7\n` })], { input: { completed: [7] } }).decisions[0];
  assert.equal(d.action, 'start');
});

test('Scenario: Request withdrawn - a ready issue moved back by hand from queued starts nothing', () => {
  assert.deepEqual(cloud([issue({ number: 42, labels: ['relevo:ready'], go_by: null })]).decisions, []);
});

test('Scenario: Local builds do not take slots - two building issues with local leave both slots to the cloud', () => {
  const locals = [issue({ number: 50, labels: ['relevo:building', 'relevo:local'] }), issue({ number: 51, labels: ['relevo:building', 'relevo:local'] })];
  const d = cloud([...locals, issue({ number: 42 })], { config: 'limits:\n  concurrent_agents: 2\n' }).decisions.find((x) => x.issue === 42);
  assert.equal(d.action, 'start');
});

test('Scenario: Cloud builds do - two building issues without local fill the limit of 2', () => {
  const builds = [issue({ number: 50, labels: ['relevo:building'] }), issue({ number: 51, labels: ['relevo:building'] })];
  const d = cloud([...builds, issue({ number: 42 })], { config: 'limits:\n  concurrent_agents: 2\n' }).decisions.find((x) => x.issue === 42);
  assert.equal(d.action, 'queue');
});

test('a local build still holds the files it names', () => {
  const local = issue({ number: 50, labels: ['relevo:building', 'relevo:local'], body: naming('src/router.ts') });
  const d = cloud([local, issue({ number: 42, body: naming('src/router.ts') })]).decisions.find((x) => x.issue === 42);
  assert.equal(d.action, 'queue');
  assert.equal(d.comment.kind, 'queued_shared_files');
});

test('a local build in progress is still not started twice', () => {
  assert.deepEqual(cloud([issue({ number: 50, labels: ['relevo:building', 'relevo:local'] })]).decisions, []);
});

test('the comment of an issue that waits for an agent counts the cloud builds only', () => {
  const issues = [issue({ number: 50, labels: ['relevo:building'] }), issue({ number: 51, labels: ['relevo:building', 'relevo:local'] }), issue({ number: 42 })];
  const d = cloud(issues, { config: 'limits:\n  concurrent_agents: 1\n' }).decisions.find((x) => x.issue === 42);
  assert.equal(d.comment.data.active, 1);
  assert.equal(d.comment.data.active_issues, '#50');
});

// --- split-ready-and-go: the approval covers the text as it was approved

const READY_AT = '2026-10-12T09:00:00Z';
const approved = (over = {}) => issue({ number: 42, ready_at: READY_AT, ready_by: 'persona-a', ...over });
const checked = (i, edit, extra = {}) => plan([i], { ...extra, input: { edits: { [i.number]: edit }, ...(extra.input ?? {}) } }).decisions.find((d) => d.issue === i.number);

test('Scenario: Body edited days after the approval - nothing is built, the issue is a draft, the comment names the approver', () => {
  const d = checked(approved(), { ok: true, at: '2026-10-14T09:00:00Z' });
  assert.equal(d.action, 'unapproved');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:ready', 'relevo:go'] });
  assert.equal(d.comment.kind, 'approval_withdrawn');
  assert.equal(d.comment.data.approver, 'persona-a');
  assert.equal(d.comment.data.issue, 42);
  assert.equal(d.assign, null);
});

test('Scenario: Title changed - only a title change after the approval is treated as edited', () => {
  const d = checked(approved({ title_edited_at: '2026-10-13T09:00:00Z' }), { ok: true, at: null });
  assert.equal(d.action, 'unapproved');
  assert.equal(d.comment.data.edited, 'title');
});

test('a title changed before the approval is not an edit after it', () => {
  assert.equal(checked(approved({ title_edited_at: '2026-10-11T09:00:00Z' }), { ok: true, at: '2026-10-11T10:00:00Z' }).action, 'start');
});

test('Scenario: Edited by the person who approved - the edit withdraws the approval as for anyone else', () => {
  const d = checked(approved({ ready_by: 'persona-a' }), { ok: true, at: '2026-10-12T09:00:05Z' });
  assert.equal(d.action, 'unapproved');
});

test('Scenario: Unchanged - neither text edited after the approval, the gates go on', () => {
  assert.equal(checked(approved(), { ok: true, at: null }).action, 'start');
  assert.equal(checked(approved(), { ok: true, at: '2026-10-12T08:59:59Z' }).action, 'start');
});

test('the approval check is decided before any other gate', () => {
  const d = checked(approved({ milestone: null, assignees: [], body: 'no scenarios', ready_by: 'stranger' }), { ok: true, at: '2026-10-14T09:00:00Z' });
  assert.equal(d.action, 'unapproved');
});

test('the issue ends with no lifecycle label: a queued or blocked issue edited after its approval loses its state and its request', () => {
  const q = checked(approved({ labels: ['relevo:queued', 'relevo:urgent'], urgent_by: 'persona-a' }), { ok: true, at: '2026-10-14T09:00:00Z' });
  assert.equal(q.action, 'unapproved');
  assert.deepEqual(q.labels, { add: [], remove: ['relevo:queued'] });
  const b = checked(approved({ labels: ['relevo:blocked', 'relevo:go'] }), { ok: true, at: '2026-10-14T09:00:00Z' });
  assert.deepEqual(b.labels, { add: [], remove: ['relevo:blocked', 'relevo:go'] });
});

test('Scenario: Text changed since the approval - a build-failed rebuild requested with go is refused the same way', () => {
  const d = checked(approved({ labels: ['relevo:build-failed', 'relevo:go'], has_branch: false }), { ok: true, at: '2026-10-14T09:00:00Z' });
  assert.equal(d.action, 'unapproved');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:build-failed', 'relevo:go'] });
  assert.equal(d.comment.kind, 'approval_withdrawn');
});

test('a retry by a person of a build-failed issue whose text changed is refused the same way', () => {
  const i = approved({ labels: ['relevo:build-failed'] });
  const d = checked(i, { ok: true, at: '2026-10-14T09:00:00Z' }, { input: { retry: { issue: 42, by: 'persona-a' } } });
  assert.equal(d.action, 'unapproved');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:build-failed'] });
});

test('Scenario: The edit history cannot be read - nothing is built, the labels stay, the report says why', () => {
  const d = checked(approved(), { ok: false, reason: 'HTTP 403' });
  assert.equal(d.action, 'report');
  assert.deepEqual(d.labels, { add: [], remove: [] });
  assert.equal(d.comment, null);
  assert.match(d.reason, /approval could not be checked.*HTTP 403/);
});

test('the moment of the approval cannot be read - the same report', () => {
  const d = checked(approved({ ready_at: null }), { ok: true, at: null });
  assert.equal(d.action, 'report');
  assert.deepEqual(d.labels, { add: [], remove: [] });
  assert.match(d.reason, /approval could not be checked/);
});

test('an issue the caller did not read is planned as before, so the limits of the others stay right', () => {
  const other = issue({ number: 7 });
  const r = plan([other, approved()], { input: { edits: { 42: { ok: true, at: null } } } });
  assert.equal(r.decisions.find((d) => d.issue === 7).action, 'start');
});

// --- split-ready-and-go: the planner on a machine

const LOCAL_PERMS = { 'persona-a': 'write', 'persona-e': 'write', reader: 'read', stranger: 'read' };
const local = (issues, only, extra = {}) => plan(issues, { ...extra, input: { place: 'local', person: 'persona-e', only, permissions: LOCAL_PERMS, ...(extra.input ?? {}) } });
const localOne = (i, extra) => local([i], i.number, extra).decisions.find((d) => d.issue === i.number);
const approvedOnly = (over = {}) => issue({ number: 42, labels: ['relevo:ready'], go_by: null, go_at: null, ...over });

test('Scenario: Approved issue built on a machine - a ready issue with no go starts and the claim adds building and local', () => {
  const d = localOne(approvedOnly());
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['relevo:building', 'relevo:local'], remove: ['relevo:ready'] });
});

test('a local build of an issue that waits for the cloud with go serves the request: go leaves with the claim', () => {
  const d = localOne(approvedOnly({ labels: ['relevo:ready', 'relevo:go'] }));
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['relevo:building', 'relevo:local'], remove: ['relevo:ready', 'relevo:go'] });
});

test('Scenario: Person without the permission - nothing is built or claimed, the report says building needs write access', () => {
  const d = local([approvedOnly()], 42, { input: { person: 'reader' } }).decisions[0];
  assert.equal(d.action, 'report');
  assert.equal(d.report, 'no_permission');
  assert.deepEqual(d.labels, { add: [], remove: [] });
  assert.equal(d.comment, null);
  assert.equal(local([approvedOnly()], 42, { input: { person: null } }).decisions[0].report, 'no_permission');
});

test('the approver is checked too: ready applied without permission is denied as in the cloud', () => {
  const d = localOne(approvedOnly({ ready_by: 'stranger' }));
  assert.equal(d.action, 'denied');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:ready'] });
  assert.equal(d.comment.kind, 'ready_denied');
});

test('Scenario: Draft - nothing is built and the report says the issue needs ready first', () => {
  ['bug', 'relevo:needs-spec'].forEach((label) => {
    const d = localOne(approvedOnly({ labels: [label] }));
    assert.equal(d.action, 'report', label);
    assert.equal(d.report, 'needs_ready', label);
    assert.deepEqual(d.labels, { add: [], remove: [] });
  });
});

test('a local build of an issue in another state reports it and changes nothing', () => {
  assert.equal(localOne(approvedOnly({ labels: ['relevo:building'] })).report, 'building');
  assert.equal(localOne(approvedOnly({ labels: ['relevo:built'] })).report, 'already_built');
  assert.equal(localOne(approvedOnly({ labels: ['relevo:build-failed'] })).report, 'build_failed');
});

test('Scenario: Limit of agents reached - the capacity gate and the limit of agents are skipped', () => {
  const running = [50, 51].map((n) => issue({ number: n, labels: ['relevo:building'] }));
  const built = [60, 61, 62].map((n) => issue({ number: n, labels: ['relevo:built'], assignees: ['persona-b'] }));
  const d = local([...running, ...built, approvedOnly()], 42, { config: 'limits:\n  concurrent_agents: 1\n' }).decisions.find((x) => x.issue === 42);
  assert.equal(d.action, 'start');
  assert.equal(d.urgent, undefined);
});

test('Scenario: Shared file - the build starts at once and its decision lists the file and the issue', () => {
  const holder = issue({ number: 40, labels: ['relevo:built'], body: naming('src/router.ts') });
  const d = local([holder, approvedOnly({ body: naming('src/router.ts') })], 42).decisions.find((x) => x.issue === 42);
  assert.equal(d.action, 'start');
  assert.deepEqual(d.shared_files, [{ file: 'src/router.ts', issue: 40 }]);
  assert.equal(d.comment, null);
});

test('Scenario: Dependency not merged - reported with no label change and no comment, naming the dependency', () => {
  const d = localOne(approvedOnly({ body: `${BODY}\nDepends-on: #12\n` }));
  assert.equal(d.action, 'report');
  assert.equal(d.report, 'blocked');
  assert.match(d.reason, /#12/);
  assert.deepEqual(d.labels, { add: [], remove: [] });
  assert.equal(d.comment, null);
});

test('Scenario: Incomplete text - the issue goes to needs-spec as it would in the cloud', () => {
  const d = localOne(approvedOnly({ body: '## Edge cases\n- only\n' }));
  assert.equal(d.action, 'needs-spec');
  assert.deepEqual(d.labels, { add: ['relevo:needs-spec'], remove: ['relevo:ready'] });
  assert.equal(d.comment.kind, 'needs_spec');
});

test('a missing assignee is applied as in the cloud, a missing milestone does not stop the build', () => {
  assert.equal(localOne(approvedOnly({ milestone: null })).action, 'start');
  assert.equal(localOne(approvedOnly({ assignees: [] })).action, 'no-assignee');
});

test('Scenario: Queued for capacity - a queued issue is taken: building and local', () => {
  const d = localOne(approvedOnly({ labels: ['relevo:queued'] }));
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['relevo:building', 'relevo:local'], remove: ['relevo:queued'] });
});

test('a queued issue held for a usage limit of the cloud can still be built on a machine', () => {
  const d = localOne(approvedOnly({ labels: ['relevo:queued'], limit_retry: { at: Date.parse('2099-01-01T00:00:00Z'), attempt: 1, reason: 'reset' } }));
  assert.equal(d.action, 'start');
});

test('Scenario: Blocked - a blocked issue is refused, stays blocked, and the report names the dependency', () => {
  const d = localOne(approvedOnly({ labels: ['relevo:blocked'], body: `${BODY}\nDepends-on: #12\n` }));
  assert.equal(d.action, 'report');
  assert.match(d.reason, /#12/);
  assert.deepEqual(d.labels, { add: [], remove: [] });
});

test('Scenario: Urgent and a local build - the label changes nothing, valid or not', () => {
  const valid = localOne(approvedOnly({ labels: ['relevo:ready', 'relevo:urgent'], urgent_by: 'persona-a' }));
  const invalid = localOne(approvedOnly({ labels: ['relevo:ready', 'relevo:urgent'], urgent_by: 'stranger' }));
  [valid, invalid].forEach((d) => {
    assert.equal(d.action, 'start');
    assert.deepEqual(d.labels, { add: ['relevo:building', 'relevo:local'], remove: ['relevo:ready'] });
    assert.equal(d.notice, undefined);
    assert.equal(d.urgent, undefined);
  });
});

test('a local build checks the approval against the last edit too', () => {
  const d = local([approvedOnly({ ready_at: '2026-10-12T09:00:00Z' })], 42, { input: { edits: { 42: { ok: true, at: '2026-10-13T09:00:00Z' } } } }).decisions[0];
  assert.equal(d.action, 'unapproved');
});

test('a local build plans only the issue it was given', () => {
  const r = local([issue({ number: 7, labels: ['relevo:ready'] }), approvedOnly()], 42);
  assert.deepEqual(r.decisions.map((d) => d.issue), [42]);
});

test('an edit in the same second as the approval is not an edit after it (one gh issue edit with --body and --add-label, spike of 2026-11-17)', () => {
  const d = checked(approved({ ready_at: '2026-11-17T16:01:26Z' }), { ok: true, at: '2026-11-17T16:01:26Z' });
  assert.equal(d.action, 'start');
  assert.equal(checked(approved({ ready_at: '2026-11-17T16:01:26Z' }), { ok: true, at: '2026-11-17T16:01:27Z' }).action, 'unapproved');
});

// --- Resume of a build that stopped before it finished (resume-a-cut-build) ---
const RESUMABLE = { state: 'resume', reason: null };
const resumeOf = (i, by = 'persona-a') => ({ input: { resume: { issue: i.number, by } } });
const STALLED = { turns: 100, minutes: 50, cost: 5 };

test('Scenario: A build cut at a limit is resumed - --resume plans it with the gates of a retry, claims building and never adds ready', () => {
  const i = failed({ number: 42, title: 'Summary screen', has_branch: true, resume_check: RESUMABLE });
  const d = one([i], resumeOf(i));
  assert.equal(d.action, 'start');
  assert.equal(d.branch, 'feature/42-summary-screen');
  assert.deepEqual(d.labels, { add: ['relevo:building'], remove: ['relevo:build-failed'] });
  assert.equal(d.comment, null, 'the claim posts no comment');
});

test('--resume by a person without write access is denied and the issue stays build-failed', () => {
  const i = failed({ number: 42, has_branch: true, resume_check: RESUMABLE });
  const d = one([i], resumeOf(i, 'stranger'));
  assert.equal(d.action, 'denied');
  assert.deepEqual(d.labels, { add: [], remove: [] });
});

test('--resume on an issue that is not build-failed builds nothing and changes nothing', () => {
  const i = issue({ number: 42, labels: ['relevo:built'], has_branch: true, resume_check: RESUMABLE });
  const r = plan([i], { input: { place: 'local', person: 'persona-a', only: 42, resume: { issue: 42, by: 'persona-a' } } }).decisions[0];
  assert.equal(r.action, 'report');
  assert.deepEqual(r.labels, { add: [], remove: [] });
});

test('--resume with an answer of the check that is not resume builds nothing and changes nothing', () => {
  ['existing', 'absent', null].forEach((state) => {
    const i = failed({ number: 42, has_branch: true, resume_check: state ? { state, reason: 'x' } : null });
    const d = one([i], resumeOf(i));
    assert.equal(d.action, 'report', String(state));
    assert.deepEqual(d.labels, { add: [], remove: [] }, String(state));
  });
});

test('--resume whose text changed since the approval is refused the same way as a retry', () => {
  const i = approved({ labels: ['relevo:build-failed'], has_branch: true, resume_check: RESUMABLE });
  const d = checked(i, { ok: true, at: '2026-10-14T09:00:00Z' }, { input: { resume: { issue: 42, by: 'persona-a' } } });
  assert.equal(d.action, 'unapproved');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:build-failed'] });
});

test('Scenario: Resume in the cloud - go on build-failed with a branch the check accepts is planned as a resume', () => {
  const d = cloud([issue({ number: 42, labels: ['relevo:build-failed', 'relevo:go'], has_branch: true, resume_check: RESUMABLE })]).decisions[0];
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['relevo:building'], remove: ['relevo:build-failed', 'relevo:go'] });
});

test('a resume requested with go by someone without permission is refused like any request', () => {
  const d = cloud([issue({ number: 42, labels: ['relevo:build-failed', 'relevo:go'], has_branch: true, resume_check: RESUMABLE, go_by: 'stranger' })]).decisions[0];
  assert.equal(d.action, 'denied');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:go'] });
});

test('Scenario: The branch cannot be resumed - go keeps the answer it had, to run fix', () => {
  ['existing', 'absent'].forEach((state) => {
    const d = cloud([issue({ number: 42, labels: ['relevo:build-failed', 'relevo:go'], has_branch: true, resume_check: { state, reason: 'x' } })]).decisions[0];
    assert.equal(d.action, 'refuse', state);
    assert.equal(d.comment.kind, 'go_use_fix', state);
  });
  const old = cloud([issue({ number: 42, labels: ['relevo:build-failed', 'relevo:go'], has_branch: true })]).decisions[0];
  assert.equal(old.comment.kind, 'go_use_fix', 'a caller that does not give the check changes nothing');
});

test('Scenario: A resume with the same limits after a stall is refused, and one with a limit raised is accepted', () => {
  const stalled = (over) => issue({ number: 42, labels: ['relevo:build-failed', 'relevo:go'], has_branch: true, resume_check: RESUMABLE, stalled: STALLED, ...over });
  const same = cloud([stalled()]).decisions[0];
  assert.equal(same.action, 'refuse');
  assert.equal(same.comment.kind, 'go_resume_stalled');
  assert.deepEqual(same.labels, { add: [], remove: ['relevo:go'] });
  const raised = cloud([stalled()], { config: 'limits:\n  run_max_minutes: 90\n' }).decisions[0];
  assert.equal(raised.action, 'start');
  const lower = cloud([stalled()], { config: 'limits:\n  run_max_minutes: 30\n' }).decisions[0];
  assert.equal(lower.action, 'refuse', 'a limit that is lower does not lift it');
});

test('--resume after a stall with the same limits reports which limits to raise, and builds nothing', () => {
  const i = failed({ number: 42, has_branch: true, resume_check: RESUMABLE, stalled: STALLED });
  const d = one([i], resumeOf(i));
  assert.equal(d.action, 'report');
  assert.equal(d.report, 'resume_stalled');
  assert.match(d.reason, /run_max_turns/);
  assert.deepEqual(d.labels, { add: [], remove: [] });
});
