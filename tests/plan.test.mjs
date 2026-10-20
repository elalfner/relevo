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
    labels: ['relevo:ready'], assignees: ['persona-b'], milestone: { number: 1, due_on: null },
    ready_at: `2026-10-14T10:0${seq % 10}:00Z`, ready_by: 'persona-a', ...over,
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
  assert.deepEqual(d.labels, { add: ['relevo:building'], remove: ['relevo:ready'] });
});

test('Scenario: Unauthorised label - no run, the label is removed', () => {
  const d = one([issue({ ready_by: 'stranger' })]);
  assert.equal(d.action, 'denied');
  assert.deepEqual(d.labels, { add: [], remove: ['relevo:ready'] });
  assert.equal(d.comment.kind, 'ready_denied');
});

test('an unknown applier is treated as unauthorised', () => {
  const d = one([issue({ ready_by: null })]);
  assert.equal(d.action, 'denied');
  assert.equal(d.comment.data.actor, undefined);
});

test('Scenario: No milestone - no run and a comment asks for one', () => {
  const d = one([issue({ milestone: null })]);
  assert.equal(d.action, 'no-milestone');
  assert.deepEqual(d.labels.remove, ['relevo:ready']);
  assert.equal(d.comment.kind, 'no_milestone');
  assert.equal(d.comment.data.actor, 'persona-a');
});

test('no assignee means nobody to hand the result to: no run', () => {
  const d = one([issue({ assignees: [] })]);
  assert.equal(d.action, 'no-assignee');
  assert.equal(d.comment.kind, 'no_assignee');
});

test('Scenario: Spec incomplete - needs-spec, back to the spec writer, nothing is built', () => {
  const d = one([issue({ body: '## Edge cases\n- only edge cases\n' })]);
  assert.equal(d.action, 'needs-spec');
  assert.deepEqual(d.labels, { add: ['relevo:needs-spec'], remove: ['relevo:ready'] });
  assert.deepEqual(d.assign, ['persona-a']);
  assert.equal(d.comment.kind, 'needs_spec');
  assert.match(d.comment.data.missing, /WHEN\/THEN/);
});

test('Scenario: Blocked - a dependency is open, the label is set, the comment mentions nobody', () => {
  const d = one([issue({ body: `${BODY}\nDepends-on: #12\n` })]);
  assert.equal(d.action, 'block');
  assert.deepEqual(d.labels, { add: ['relevo:blocked'], remove: ['relevo:ready'] });
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
  assert.deepEqual(full.labels, { add: ['relevo:queued'], remove: ['relevo:ready'] });
  assert.equal(full.comment.kind, 'queued_capacity');
  assert.deepEqual(full.comment.data, { issue: 9, title: full.comment.data.title, assignee: 'persona-b', built: 2, limit: 2 });

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

test('Scenario: Duplicate trigger - an issue with a run in progress is not started twice', () => {
  const running = issue({ number: 5, labels: ['relevo:ready'] });
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
  const i = issue({ labels: ['listo'] });
  const d = one([i], { config: 'labels:\n  ready: listo\n  building: construyendo\n' });
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['construyendo'], remove: ['listo'] });
});

test('the summary counts decisions by action', () => {
  const issues = [issue({ number: 1, assignees: ['p1'] }), issue({ number: 2, milestone: null })];
  assert.deepEqual(plan(issues).summary, { start: 1, 'no-milestone': 1 });
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
