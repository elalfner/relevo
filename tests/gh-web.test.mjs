import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canEditIssue } from '../scripts/lib/can-edit-issue.mjs';
import { describeFailure, findRepo, githubAccess, isRemote, main, parseArgs, redact, repoFromUrl, shapeIssue } from '../scripts/lib/gh-web.mjs';

const fixture = (name) => readFileSync(new URL(`./fixtures/rest/${name}.json`, import.meta.url), 'utf8');
const REMOTE = { CLAUDE_CODE_REMOTE: 'true', GH_TOKEN: 'ghp_secrettokenvalue123456' };
const REPO = 'elalfner/relevo-sandbox';

// A fake `gh api` that answers from the recordings of a real web session and records what it was asked.
function world(extra = {}) {
  const calls = [];
  const api = (args, input) => {
    calls.push({ args, input });
    const path = args.find((a) => /^(repos|search|user)/.test(a));
    const method = args.includes('-X') ? args[args.indexOf('-X') + 1] : 'GET';
    if (extra[`${method} ${path}`]) {
      const answer = extra[`${method} ${path}`];
      if (answer instanceof Error) throw answer;
      return typeof answer === 'string' ? answer : JSON.stringify(answer);
    }
    const slurp = args.includes('--slurp');
    const wrap = (text) => (slurp ? `[${text}]` : text);
    if (path === `repos/${REPO}`) return fixture('repo');
    if (path === `repos/${REPO}/issues/20`) return fixture('issue');
    if (path.startsWith(`repos/${REPO}/issues/20/comments`)) return wrap(fixture('comments'));
    if (path.startsWith(`repos/${REPO}/issues?`)) return wrap(fixture('issues-list'));
    if (path === 'search/issues') return wrap(fixture('search'));
    throw Object.assign(new Error('Command failed'), { stderr: `gh: Not Found (HTTP 404)`, stdout: '{"message":"Not Found"}' });
  };
  return { api, calls };
}

function run(argv, { env = REMOTE, w = world(), files = {}, git = () => 'https://github.com/elalfner/relevo-sandbox\n' } = {}) {
  const out = [];
  const err = [];
  const passed = [];
  const code = main(argv, {
    env,
    api: w.api,
    git,
    passthrough: (args) => { passed.push(args); return 7; },
    readFile: (p) => { if (!(p in files)) throw new Error(`no ${p}`); return files[p]; },
    out: (t) => out.push(t),
    err: (t) => err.push(t),
  });
  return { code, out: out.join(''), err: err.join(''), passed, calls: w.calls };
}

// ---- web-sessions: the commands work over REST in a remote session

test('Scenario: Reading an issue - fields and comments over REST, no GraphQL request', () => {
  const r = run(['issue', 'view', '20', '--json', 'number,title,body,state,labels,assignees,milestone,comments']);
  assert.equal(r.code, 0);
  const issue = JSON.parse(r.out);
  assert.equal(issue.number, 20);
  assert.equal(issue.state, 'CLOSED');
  assert.deepEqual(issue.labels.map((l) => l.name), ['relevo:built']);
  assert.deepEqual(issue.assignees, [{ login: 'elalfner' }]);
  assert.deepEqual(issue.milestone, { number: 1, title: 'Pilot 1' });
  assert.equal(issue.comments.length, 1);
  assert.equal(typeof issue.comments[0].body, 'string');
  assert.ok(r.calls.every((c) => c.args[0] === 'api' && !c.args.includes('graphql')));
});

test('only the fields asked for are returned, and --jq with a path prints the raw value', () => {
  assert.deepEqual(Object.keys(JSON.parse(run(['issue', 'view', '20', '--json', 'title,url']).out)), ['title', 'url']);
  const jq = run(['issue', 'view', '20', '--json', 'title', '-q', '.title']);
  assert.equal(jq.out, 'Show a message when the counter reaches ten\n');
  assert.equal(run(['issue', 'view', '20', '--json', 'labels', '--jq', '.labels[].name']).out, 'relevo:built\n');
});

test('without --json the issue is shown as text, with its comments on request', () => {
  const plain = run(['issue', 'view', '20', '--comments']);
  assert.match(plain.out, /^title:\tShow a message/);
  assert.match(plain.out, /commented/);
  assert.doesNotMatch(run(['issue', 'view', '20']).out, /commented/);
});

test('Scenario: Looking for similar issues - the search is limited and keeps number, title and labels', () => {
  const r = run(['issue', 'list', '--state', 'open', '--search', 'counter', '--json', 'number,title,labels', '--limit', '1']);
  assert.equal(r.code, 0);
  const found = JSON.parse(r.out);
  assert.equal(found.length, 1);
  assert.deepEqual(Object.keys(found[0]), ['number', 'title', 'labels']);
  const q = r.calls[0].args[r.calls[0].args.indexOf('-f') + 1];
  assert.match(q, /^q=counter repo:elalfner\/relevo-sandbox is:issue state:open$/);
});

test('a list drops the pull requests, as gh does, and honours --limit', () => {
  const all = JSON.parse(run(['issue', 'list', '--state', 'all', '--json', 'number']).out);
  assert.deepEqual(all.map((i) => i.number), [66], 'issues 68 and 67 of the recording are pull requests');
  assert.equal(run(['issue', 'list', '--state', 'all', '--limit', '0']).code, 1);
  assert.match(run(['issue', 'list', '--state', 'weird']).err, /--state must be/);
});

test('Scenario: Creating an issue - milestone by title, assignee, body from a file; the URL comes back', () => {
  const w = world({
    'GET repos/elalfner/relevo-sandbox/milestones?state=all&per_page=100': [[{ number: 3, title: 'Pilot 2' }, { number: 1, title: 'Pilot 1' }]],
    'POST repos/elalfner/relevo-sandbox/issues': { html_url: 'https://github.com/elalfner/relevo-sandbox/issues/99', number: 99 },
  });
  const r = run(['issue', 'create', '--title', 'Web test', '--body-file', 'draft.md', '--milestone', 'Pilot 2', '--assignee', 'elalfner'], { w, files: { 'draft.md': '## Summary\nx\n' } });
  assert.equal(r.code, 0);
  assert.equal(r.out, 'https://github.com/elalfner/relevo-sandbox/issues/99\n');
  const post = r.calls.find((c) => c.args.includes('POST'));
  assert.deepEqual(JSON.parse(post.input), { title: 'Web test', body: '## Summary\nx\n', milestone: 3, assignees: ['elalfner'] });
});

test('creating with a milestone that does not exist stops before the issue is made', () => {
  const w = world({ 'GET repos/elalfner/relevo-sandbox/milestones?state=all&per_page=100': [[{ number: 1, title: 'Pilot 1' }]] });
  const r = run(['issue', 'create', '--title', 'T', '--body', 'b', '--milestone', 'Nope'], { w });
  assert.equal(r.code, 1);
  assert.match(r.err, /no milestone "Nope"/);
  assert.ok(!r.calls.some((c) => c.args.includes('POST')));
});

test('Scenario: Changing the labels of an issue - one added, one removed, the others untouched', () => {
  const w = world({
    'PATCH repos/elalfner/relevo-sandbox/issues/5': { html_url: 'https://github.com/elalfner/relevo-sandbox/issues/5' },
    'POST repos/elalfner/relevo-sandbox/issues/5/labels': [],
    'DELETE repos/elalfner/relevo-sandbox/issues/5/labels/relevo%3Aneeds-spec': '',
  });
  const r = run(['issue', 'edit', '5', '--body-file', 'new.md', '--add-label', 'relevo:ready', '--remove-label', 'relevo:needs-spec'], { w, files: { 'new.md': 'new text' } });
  assert.equal(r.code, 0);
  assert.equal(r.out, 'https://github.com/elalfner/relevo-sandbox/issues/5\n');
  const sent = r.calls.map((c) => `${c.args[c.args.indexOf('-X') + 1] ?? 'GET'} ${c.args.find((a) => a.startsWith('repos/'))}`);
  assert.deepEqual(sent, ['PATCH repos/elalfner/relevo-sandbox/issues/5', 'POST repos/elalfner/relevo-sandbox/issues/5/labels', 'DELETE repos/elalfner/relevo-sandbox/issues/5/labels/relevo%3Aneeds-spec']);
  assert.deepEqual(JSON.parse(r.calls[0].input), { body: 'new text' });
  assert.deepEqual(JSON.parse(r.calls[1].input), { labels: ['relevo:ready'] });
});

test('removing a label the issue does not carry is not an error', () => {
  const gone = Object.assign(new Error('x'), { stderr: 'gh: Label does not exist (HTTP 404)', stdout: '{"message":"Label does not exist"}' });
  const w = world({ 'DELETE repos/elalfner/relevo-sandbox/issues/5/labels/x': gone });
  assert.equal(run(['issue', 'edit', '5', '--remove-label', 'x'], { w }).code, 0);
});

test('Scenario: A linked repository - --repo decides where the command acts', () => {
  const r = run(['issue', 'view', '20', '--repo', 'other/repo', '--json', 'title']);
  assert.equal(r.code, 1);
  assert.match(r.calls[0].args.join(' '), /repos\/other\/repo\/issues\/20/);
});

test('repo view reads the repository over REST and label create falls back to an update with --force', () => {
  assert.equal(run(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).out, `${REPO}\n`);
  const exists = Object.assign(new Error('x'), { stderr: 'gh: Validation Failed (HTTP 422)', stdout: '{"message":"Validation Failed"}' });
  const w = world({ 'POST repos/elalfner/relevo-sandbox/labels': exists, 'PATCH repos/elalfner/relevo-sandbox/labels/relevo%3Aready': {} });
  const r = run(['label', 'create', 'relevo:ready', '--color', '#0e8a16', '--description', 'ready', '--force'], { w });
  assert.equal(r.code, 0);
  const patch = r.calls.find((c) => c.args.includes('PATCH'));
  assert.deepEqual(JSON.parse(patch.input), { color: '0e8a16', description: 'ready' });
  assert.equal(run(['label', 'create', 'x'], { w }).code, 1, 'without --force an existing label is an error');
});

// ---- web-sessions: outside a remote session nothing changes

test('Scenario: A terminal - the arguments reach gh unchanged and its exit code comes back', () => {
  const argv = ['issue', 'view', '42', '--json', 'title,body', '--weird-flag', 'x'];
  const r = run(argv, { env: {} });
  assert.deepEqual(r.passed, [argv]);
  assert.equal(r.code, 7);
  assert.deepEqual(r.calls, []);
  assert.equal(r.out, '');
  assert.equal(isRemote({ CLAUDE_CODE_REMOTE: 'false' }), false);
});

// ---- web-sessions: the shape is the one gh gives

test('Scenario: The state of an issue - open becomes OPEN', () => {
  assert.equal(shapeIssue({ number: 1, title: 't', state: 'open' }).state, 'OPEN');
  assert.equal(shapeIssue({ number: 1, title: 't', state: 'closed' }).state, 'CLOSED');
});

test('an asked-for field with no value is present and empty, not missing', () => {
  const shaped = shapeIssue({ number: 1, title: 't', state: 'open', body: null, labels: [], assignees: [], milestone: null });
  assert.equal(shaped.body, '');
  assert.deepEqual(shaped.labels, []);
  assert.equal(shaped.milestone, null);
});

test('Scenario: A script that decides on the labels reaches the same decision with the REST output', () => {
  const rest = JSON.parse(run(['issue', 'view', '20', '--json', 'state,labels']).out);
  assert.equal(canEditIssue(rest).editable, false, 'a closed issue');
  assert.equal(canEditIssue({ ...rest, state: 'OPEN' }).editable, false, 'a built one');
  for (const names of [['relevo:needs-spec'], ['relevo:ready'], []]) {
    const cli = { state: 'OPEN', labels: names.map((name) => ({ name })) };
    const w = world({ 'GET repos/elalfner/relevo-sandbox/issues/7': { number: 7, title: 't', state: 'open', labels: names.map((name) => ({ name })) } });
    const viaRest = JSON.parse(run(['issue', 'view', '7', '--json', 'state,labels'], { w }).out);
    assert.deepEqual(canEditIssue(viaRest), canEditIssue(cli), names.join() || 'no labels');
  }
  assert.equal(canEditIssue({ state: 'OPEN', labels: [{ name: 'relevo:needs-spec' }] }).editable, true);
});

// ---- web-sessions: a failure is reported, never hidden

test('Scenario: A repository the token cannot see - the status and message of GitHub, nothing on stdout', () => {
  const r = run(['issue', 'view', '404', '--json', 'title']);
  assert.equal(r.code, 1);
  assert.equal(r.out, '');
  assert.match(r.err, /^HTTP 404: Not Found/);
});

test('Scenario: A flag that is not covered - it is named and no request is made', () => {
  const r = run(['issue', 'view', '20', '--web']);
  assert.equal(r.code, 1);
  assert.match(r.err, /--web of "gh issue view" is not covered/);
  assert.deepEqual(r.calls, []);
  const sub = run(['pr', 'merge', '5']);
  assert.match(sub.err, /"gh pr merge" is not covered/);
  assert.deepEqual(sub.calls, []);
  assert.match(run(['issue', 'view', '20', '--json', 'reactionGroups']).err, /reactionGroups/);
  assert.match(run(['issue', 'view', '20', '--json', 'title', '--jq', 'map(.x)']).err, /--jq expression "map\(\.x\)"/);
  assert.deepEqual(run(['issue', 'view', '20', '--json', 'title', '--jq', '.[] | .x']).calls, []);
});

test('parseArgs takes --flag=value, repeated list flags and the short -q and -R', () => {
  const p = parseArgs(['issue', 'list', '--label=a', '--label', 'b', '-R', 'o/r', '-q', '.[].number']);
  assert.deepEqual(p.flags, { label: ['a', 'b'], repo: 'o/r', jq: '.[].number' });
  assert.throws(() => parseArgs(['issue', 'view']), /needs an argument/);
});

// ---- web-sessions: the token is used as it is and never shown

test('Scenario: A failed request - the error does not contain the token or the authorization header', () => {
  const leaky = Object.assign(new Error('x'), { stderr: `gh: Bad credentials (HTTP 401) token ghp_secrettokenvalue123456 Authorization: Bearer ghp_secrettokenvalue123456`, stdout: '{"message":"Bad credentials ghp_secrettokenvalue123456"}' });
  const w = world({ 'GET repos/elalfner/relevo-sandbox/issues/9': leaky });
  const r = run(['issue', 'view', '9', '--json', 'title'], { w });
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.err, /ghp_secrettokenvalue123456/);
  assert.match(r.err, /HTTP 401/);
  assert.equal(redact('GH_TOKEN=abc Authorization: token abc123', { GH_TOKEN: 'abc123' }).includes('abc123'), false);
});

// ---- web-sessions: GitHub access is judged by reading the repository

test('Scenario: A remote session whose sign-in status fails but whose token works - access passes', () => {
  const a = githubAccess({ env: REMOTE, api: world().api, git: () => 'https://github.com/elalfner/relevo-sandbox.git\n' });
  assert.deepEqual(a, { ok: true, repo: REPO });
});

test('Scenario: A remote session with no usable token - the cause is named', () => {
  const denied = Object.assign(new Error('x'), { stderr: 'gh: Bad credentials (HTTP 401)', stdout: '{"message":"Bad credentials"}' });
  const a = githubAccess({ env: REMOTE, repo: REPO, api: () => { throw denied; }, git: () => '' });
  assert.equal(a.ok, false);
  assert.equal(a.status, 401);
  assert.match(a.message, /no usable GitHub token/);
  const missing = githubAccess({ env: {}, api: world().api, git: () => { throw new Error('no remote'); } });
  assert.match(missing.message, /no repository found/);
  const nf = githubAccess({ env: REMOTE, repo: 'a/b', api: world().api, git: () => '' });
  assert.match(nf.message, /not found or the token cannot see it/);
});

// ---- the repository of the session

test('the repository comes from --repo, GITHUB_REPOSITORY, then the origin remote in any common form', () => {
  assert.equal(findRepo({ flag: 'a/b', env: { GITHUB_REPOSITORY: 'c/d' }, git: () => 'x' }), 'a/b');
  assert.equal(findRepo({ env: { GITHUB_REPOSITORY: 'c/d' }, git: () => 'x' }), 'c/d');
  assert.equal(findRepo({ env: {}, git: () => 'https://github.com/elalfner/relevo\n' }), 'elalfner/relevo');
  assert.equal(repoFromUrl('git@github.com:elalfner/relevo.git'), 'elalfner/relevo');
  assert.equal(repoFromUrl('http://local_proxy@127.0.0.1:39843/git/elalfner/relevo/'), 'elalfner/relevo');
  assert.equal(repoFromUrl(''), null);
  assert.equal(run(['issue', 'view', '1', '--json', 'title'], { env: REMOTE, git: () => { throw new Error('no git'); } }).err, 'cannot tell which repository to use: pass --repo owner/name\n');
});

test('describeFailure reads the status from stderr and the message from the JSON body', () => {
  const d = describeFailure(Object.assign(new Error('x'), { stderr: 'gh: Not Found (HTTP 404)', stdout: '{"message":"Not Found"}' }));
  assert.deepEqual(d, { status: 404, text: 'HTTP 404: Not Found' });
});

test('--access is the check the commands use: a REST read in a remote session, the sign-in status of gh elsewhere', () => {
  const ok = run(['--access']);
  assert.equal(ok.code, 0);
  assert.match(ok.out, /GitHub can be reached from this web session \(elalfner\/relevo-sandbox/);
  const denied = Object.assign(new Error('x'), { stderr: 'gh: Bad credentials (HTTP 401)', stdout: '{"message":"Bad credentials"}' });
  const bad = run(['--access'], { w: { api: () => { throw denied; }, calls: [] } });
  assert.equal(bad.code, 1);
  assert.match(bad.err, /no usable GitHub token/);
  const terminal = run(['--access'], { env: {} });
  assert.deepEqual(terminal.passed, [['auth', 'status']]);
});

// ---- the client the scripts use

import { ghClient } from '../scripts/lib/gh-client.mjs';

test('the script client is the real gh on a terminal and the REST version in a remote session', () => {
  const calls = [];
  const run = (name, args, opts) => { calls.push({ name, args, input: opts?.input }); return 'real-output'; };
  assert.equal(ghClient({ env: {}, run })(['label', 'create', 'x', '--repo', 'o/r'], undefined), 'real-output');
  assert.deepEqual(calls[0], { name: 'gh', args: ['label', 'create', 'x', '--repo', 'o/r'], input: undefined });

  calls.length = 0;
  const remote = ghClient({ env: REMOTE, run });
  remote(['label', 'create', 'relevo:ready', '--repo', 'o/r', '--color', '0e8a16', '--description', 'd', '--force']);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.slice(0, 4), ['api', '-X', 'POST', 'repos/o/r/labels']);
  assert.throws(() => remote(['pr', 'merge', '5']), /"gh pr merge" is not covered/);
});
