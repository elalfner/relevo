import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStatus, renderDigest, renderStatus } from '../scripts/lib/status.mjs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { parse } from '../scripts/lib/yaml-lite.mjs';

const root = new URL('../', import.meta.url).pathname;
const tpl = readFileSync(`${root}templates/relevo.yml`, 'utf8')
  .replace('members: []', 'members: [ana, beto, luz]').replace('spec_writer: null', 'spec_writer: luz');
const { config } = loadConfig(tpl);
const NOW = new Date('2026-03-10T12:00:00Z'); // a Tuesday
const issue = (number, labels, assignee = 'ana', milestone = 1) => ({ number, title: `Issue ${number}`, labels, assignees: assignee ? [assignee] : [], milestone });
const pr = (extra) => ({ number: 40, issue: 12, url: 'https://x/pull/40', author: 'ana', reviewer: 'beto', requested_at: '2026-03-10T00:00:00Z', approved: false, behind_by: 0, ...extra });

test('Scenario: Assignee view - built issues first with their command, then reviews, then what waits on others', () => {
  const r = buildStatus({
    config, me: 'ana', now: NOW,
    issues: [issue(1, ['relevo:built']), issue(2, ['relevo:pr-open']), issue(3, ['relevo:qa-failed'])],
    prs: [pr({ issue: 5, author: 'beto', reviewer: 'ana', number: 41 })],
  });
  assert.deepEqual(r.onMe.map((e) => e.command), ['/relevo:review 1', '/relevo:fix 3']);
  assert.equal(r.toReview[0].number, 5);
  assert.deepEqual(r.waitingOnOthers.map((e) => e.number), [2]);
  const text = renderStatus(r);
  assert.ok(text.indexOf('Waiting on you') < text.indexOf('Pull requests to review'));
  assert.ok(text.indexOf('Pull requests to review') < text.indexOf('Waiting on others'));
});

test('Scenario: Returned specs - needs-spec and blocked come before anything else for the spec writer', () => {
  const r = buildStatus({ config, me: 'luz', now: NOW, issues: [issue(1, ['relevo:needs-spec']), issue(2, ['relevo:blocked']), issue(3, ['relevo:pr-open', 'relevo:needs-reviewer'])] });
  assert.equal(r.view, 'spec-writer');
  assert.equal(r.specWriter.needsSpec[0].number, 1);
  assert.equal(r.specWriter.blocked[0].number, 2);
  assert.equal(r.specWriter.needsReviewer[0].number, 3);
  assert.ok(renderStatus(r).startsWith('Back with the spec writer'));
});

test('approved pull requests appear for whoever runs ship', () => {
  const approved = pr({ approved: true });
  assert.equal(buildStatus({ config, me: 'beto', now: NOW, issues: [], prs: [approved] }).toShip[0].command, '/relevo:ship 12');
  assert.equal(buildStatus({ config, me: 'ana', now: NOW, issues: [], prs: [approved] }).toShip.length, 0);
});

test('Scenario: Overloaded milestone - a capacity warning when the work exceeds what can be reviewed', () => {
  const issues = Array.from({ length: 6 }, (_, i) => issue(i + 1, ['relevo:queued']));
  const r = buildStatus({ config, me: 'ana', now: NOW, issues, milestones: [{ number: 1, title: 'M1', due_on: '2026-03-12T00:00:00Z', closed_issues: 2 }] });
  assert.equal(r.milestones[0].capacity.workingDays, 2);
  assert.equal(r.milestones[0].capacity.reviews, 4); // two reviewers (the spec writer does not review) x 2 days
  assert.equal(r.milestones[0].warning, true);
  assert.match(renderStatus(r), /capacity warning/);
});

test('Scenario: Milestone without a due date - no warning is computed and status says so', () => {
  const r = buildStatus({ config, me: 'ana', now: NOW, issues: [issue(1, ['relevo:queued'])], milestones: [{ number: 1, title: 'M1', due_on: null, closed_issues: 0 }] });
  assert.equal(r.milestones[0].warning, false);
  assert.match(renderStatus(r), /no due date/);
});

test('Scenario: Stale review - a pull request past the SLA is an alert with its age; far-behind branches too', () => {
  const r = buildStatus({ config, me: 'ana', now: NOW, issues: [], prs: [pr({ requested_at: '2026-03-09T20:00:00Z' }), pr({ number: 42, issue: 13, behind_by: 12, requested_at: '2026-03-10T10:00:00Z' })] });
  assert.deepEqual(r.alerts.map((a) => a.type), ['stale-review', 'stale-branch']);
  assert.equal(r.alerts[0].hours, 16);
});

test('Scenario: Digest posted - who waits on what and the alerts; nothing when nothing is waiting', () => {
  assert.equal(renderDigest(buildStatus({ config, now: NOW, issues: [], prs: [] })), null);
  const text = renderDigest(buildStatus({ config, now: NOW, issues: [issue(1, ['relevo:built'])], prs: [] }));
  assert.match(text, /@ana: #1 \(built\)/);
  assert.doesNotMatch(text, /Milestone/);
});

test('the Spanish text uses the language of relevo.yml', () => {
  const { config: es } = loadConfig(tpl.replace('language: en', 'language: es'));
  assert.match(renderStatus(buildStatus({ config: es, me: 'ana', now: NOW, issues: [issue(1, ['relevo:built'])] }), es.language), /Esperando por ti/);
});

test('Scenario: Running status - the report is read-only and the skill runs nothing that writes', () => {
  assert.equal(buildStatus({ config, now: NOW, issues: [] }).readOnly, true);
  const text = readFileSync(`${root}skills/status/SKILL.md`, 'utf8');
  const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.equal(parse(front).name, 'status');
  assert.equal(parse(front)['disable-model-invocation'], undefined);
  const scripts = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(scripts)].sort(), ['status.mjs', 'validate-config.mjs']);
  scripts.forEach((s) => assert.ok(existsSync(`${root}scripts/${s}`)));
  assert.doesNotMatch(readFileSync(`${root}scripts/status.mjs`, 'utf8') + readFileSync(`${root}scripts/lib/status-data.mjs`, 'utf8'), /issue (edit|comment)|--add-label|'-X'|POST|PATCH/);
});

test('the scripts work from a state file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'status-'));
  writeFileSync(join(dir, 'relevo.yml'), tpl);
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ issues: [issue(1, ['relevo:built'])], prs: [], milestones: [] }));
  const s = spawnSync('node', [`${root}scripts/status.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json'), '--me', 'ana'], { encoding: 'utf8' });
  assert.equal(s.status, 0, s.stderr);
  assert.match(s.stdout, /\/relevo:review 1/);
  const d = spawnSync('node', [`${root}scripts/digest.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json'), '--now', '2026-03-10T12:00:00Z'], { encoding: 'utf8' });
  assert.equal(d.status, 0, d.stderr);
  assert.match(d.stdout, /@ana/);
  const weekend = spawnSync('node', [`${root}scripts/digest.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json'), '--now', '2026-03-14T12:00:00Z'], { encoding: 'utf8' });
  assert.equal(weekend.stdout, '');
});

test('the digest workflow runs on weekdays and posts through the script', () => {
  const wf = readFileSync(`${root}templates/workflows/relevo-digest.yml`, 'utf8');
  assert.match(wf, /cron: '\d+ \d+ \* \* 1-5'/);
  assert.match(wf, /digest\.mjs/);
  assert.match(wf, /contents: read/);
});

test('digest.issue is a validated optional setting', () => {
  assert.equal(config.digest.issue, null);
  assert.equal(loadConfig(tpl.replace('issue: null', 'issue: 7')).config.digest.issue, 7);
  assert.equal(loadConfig(tpl.replace('issue: null', 'issue: 0')).ok, false);
});

// ---------- blocks that come from another repository

import { gatherStatus, gatherUsage } from '../scripts/lib/status-data.mjs';

const LINKED = loadConfig(tpl.replace('links: []', 'links: [acme/api]')).config;

test('Scenario: Waiting on the back / Unreadable - a blocked issue shows what it waits for in another repository and its state', () => {
  const externalBlocks = {
    7: [{ ref: 'acme/api#12', state: 'open', lifecycle: 'in-review' }],
    8: [{ ref: 'acme/api#13', state: 'open', lifecycle: null }, { ref: 'acme/api#14', state: 'closed', lifecycle: null }],
    9: [{ ref: 'acme/api#15', state: 'unreadable', lifecycle: null }],
  };
  const r = buildStatus({ config, me: 'luz', now: NOW, externalBlocks, issues: [issue(7, ['relevo:blocked']), issue(8, ['relevo:blocked']), issue(9, ['relevo:blocked']), issue(10, ['relevo:blocked'])] });
  const text = renderStatus(r);
  assert.match(text, /#7 Issue 7 — waiting for acme\/api#12 \(in-review\)/);
  assert.match(text, /#8 Issue 8 — waiting for acme\/api#13 \(open\), waiting for acme\/api#14 \(closed, not completed\)/);
  assert.match(text, /#9 Issue 9 — waiting for acme\/api#15 \(could not be read\)/);
  assert.match(text, /#10 Issue 10$/m, 'a block inside this repository is shown as before');
});

test('the assignee sees the external block next to the state, and Spanish is translated', () => {
  const externalBlocks = { 7: [{ ref: 'acme/api#12', state: 'open', lifecycle: 'in-review' }, { ref: 'acme/api#15', state: 'unreadable', lifecycle: null }] };
  const r = buildStatus({ config, me: 'ana', now: NOW, externalBlocks, issues: [issue(7, ['relevo:blocked'])] });
  assert.match(renderStatus(r), /#7 Issue 7 \(blocked\) — waiting for acme\/api#12 \(in-review\)/);
  assert.match(renderStatus(r, 'es'), /esperando acme\/api#12 \(in-review\), esperando acme\/api#15 \(no se pudo leer\)/);
});

test('gatherStatus reads each external dependency of the blocked issues once through the links client, and skips completed and unlinked ones', () => {
  const issuesByLabel = {
    'relevo:blocked': [{ number: 7, title: 'T7', labels: [{ name: 'relevo:blocked' }], assignees: [], milestone: null, body: 'Depends-on: acme/api#12, acme/api#13, acme/api#14, other/repo#1, acme/app#2' }],
  };
  const gh = (args) => {
    const path = args[args.length - 1];
    if (path.includes('issues?')) return JSON.stringify([issuesByLabel[decodeURIComponent((path.match(/labels=(.*)$/) ?? [])[1] ?? '')] ?? []]);
    if (path.includes('/pulls?')) return '[]';
    throw new Error(`unexpected ${path}`);
  };
  const asked = [];
  const ghLinks = (args) => {
    const path = args[args.length - 1];
    asked.push(path);
    if (path.endsWith('/12')) return JSON.stringify({ state: 'open', labels: [{ name: 'relevo:in-review' }, { name: 'bug' }] });
    if (path.endsWith('/13')) return JSON.stringify({ state: 'closed', state_reason: 'completed', labels: [] });
    throw new Error('HTTP 404');
  };
  const data = gatherStatus({ gh, ghLinks, repo: 'acme/app', config: LINKED });
  assert.deepEqual(asked, ['repos/acme/api/issues/12', 'repos/acme/api/issues/13', 'repos/acme/api/issues/14']);
  assert.deepEqual(data.externalBlocks, { 7: [{ ref: 'acme/api#12', state: 'open', lifecycle: 'in-review' }, { ref: 'acme/api#14', state: 'unreadable', lifecycle: null }] });
  assert.equal('body' in data.issues[0], false, 'the text of the issue is not part of the status data');
});

// ---------- ready issues to build by hand, and builds that stopped reporting

const aged = (number, labels, updated_at, assignee = 'ana') => ({ ...issue(number, labels, assignee), updated_at });

test('Scenario: Cloud paused - the ready issues of the person are listed with the command to build them', () => {
  const issues = [issue(42, ['relevo:ready']), issue(43, ['relevo:ready'], 'beto'), issue(44, ['relevo:built'])];
  const r = buildStatus({ config, me: 'ana', now: NOW, issues, cloudBuilds: false });
  assert.deepEqual(r.readyForMe, [{ number: 42, title: 'Issue 42', command: '/relevo:go 42' }]);
  const text = renderStatus(r);
  assert.match(text, /Ready, for you to build \(the cloud is not building\):\n  #42 Issue 42 → \/relevo:go 42/);
  assert.match(renderStatus(r, 'es'), /Listas, para que las construyas \(la nube no está construyendo\):\n  #42 Issue 42 → \/relevo:go 42/);
});

test('Scenario: Cloud building - no such section, and the default is the cloud building', () => {
  const issues = [issue(42, ['relevo:ready'])];
  assert.deepEqual(buildStatus({ config, me: 'ana', now: NOW, issues, cloudBuilds: true }).readyForMe, []);
  assert.deepEqual(buildStatus({ config, me: 'ana', now: NOW, issues }).readyForMe, []);
  assert.doesNotMatch(renderStatus(buildStatus({ config, me: 'ana', now: NOW, issues })), /Ready, for you to build/);
  assert.deepEqual(buildStatus({ config, now: NOW, issues, cloudBuilds: false }).readyForMe, [], 'the team view has no person');
});

test('Scenario: Stuck build / Recent activity - an alert after limits.building_alert_hours, with the way to restart', () => {
  const issues = [aged(7, ['relevo:building'], '2026-03-10T05:00:00Z'), aged(8, ['relevo:building'], '2026-03-10T10:30:00Z'), aged(9, ['relevo:built'], '2026-03-01T00:00:00Z')];
  const r = buildStatus({ config, me: 'ana', now: NOW, issues });
  assert.deepEqual(r.alerts, [{ type: 'stuck-build', issue: 7, hours: 7, command: '/relevo:go 7' }], 'default 3 hours; recent activity and other states give none');
  assert.match(renderStatus(r), /#7 build with no activity for 7h: remove relevo:building and apply relevo:ready again, or run \/relevo:go 7/);
  assert.match(renderStatus(r, 'es'), /#7 construcción sin actividad desde hace 7h: quita relevo:building y vuelve a poner relevo:ready, o ejecuta \/relevo:go 7/);
  assert.match(renderDigest(r), /- #7 build with no activity for 7h/);
  assert.match(renderDigest(r, 'es'), /- #7 construcción sin actividad desde hace 7h/);
});

test('the alert threshold comes from the configuration, and an issue without a date is never reported', () => {
  const strict = loadConfig(tpl.replace('building_alert_hours: 3', 'building_alert_hours: 1')).config;
  const issues = [aged(8, ['relevo:building'], '2026-03-10T10:30:00Z')];
  assert.equal(buildStatus({ config: strict, now: NOW, issues }).alerts.length, 1);
  assert.equal(buildStatus({ config, now: NOW, issues: [issue(5, ['relevo:building'])] }).alerts.length, 0);
});

test('gatherStatus reads whether the cloud builds: the workflow on the default branch and the variable', () => {
  const ghWith = ({ workflow, variable }) => (args) => {
    const path = args[args.length - 1];
    if (path.includes('issues?')) return JSON.stringify([[]]);
    if (path.includes('/pulls?')) return '[]';
    if (path.endsWith('.github/workflows/relevo-go.yml')) { if (!workflow) throw new Error('HTTP 404 Not Found'); return '{}'; }
    if (path.endsWith('/actions/variables/RELEVO_CLOUD_GO')) { if (variable === null) throw new Error('HTTP 404'); return JSON.stringify({ value: variable }); }
    throw new Error(`unexpected ${path}`);
  };
  const cloud = (over) => gatherStatus({ gh: ghWith(over), repo: 'acme/app', config }).cloudBuilds;
  assert.equal(cloud({ workflow: true, variable: null }), true);
  assert.equal(cloud({ workflow: true, variable: 'off' }), false);
  assert.equal(cloud({ workflow: false, variable: null }), false);
  const unreadable = gatherStatus({ gh: (args) => { const p = args[args.length - 1]; if (p.includes('issues?')) return JSON.stringify([[]]); if (p.includes('/pulls?')) return '[]'; throw new Error('HTTP 500 server error'); }, repo: 'acme/app', config });
  assert.equal(unreadable.cloudBuilds, true, 'when the answer cannot be read the cautious one is kept');
});

test('the status skill describes the new rows and the stuck-build alert', () => {
  const skill = readFileSync(`${root}skills/status/SKILL.md`, 'utf8');
  assert.match(skill, /the `ready` issues assigned to the person with `\/relevo:go <n>` \(only when the cloud is not building/);
  assert.match(skill, /`RELEVO_CLOUD_GO` is `off`/);
  assert.match(skill, /`limits\.building_alert_hours`/);
});

// A fake gh whose reads can be refused one by one; every other read answers like an empty repository (one open pull request when asked).
const gatherWith = ({ refuse = [], workflow = true, variable = 'on', withPr = false } = {}) => {
  const gh = (args) => {
    const path = args[args.length - 1];
    const refused = refuse.find((k) => path.includes(k));
    if (refused) throw new Error('HTTP 403 Forbidden');
    if (path.includes('issues?')) return JSON.stringify([[]]);
    if (path.includes('/pulls?')) return withPr ? JSON.stringify([[{ number: 40, head: { ref: 'feature/12-x', sha: 'abc' }, base: { ref: 'dev' }, user: { login: 'ana' }, html_url: 'https://x/pull/40', requested_reviewers: [] }]]) : JSON.stringify([[]]);
    if (path.includes('/reviews')) return JSON.stringify([[]]);
    if (path.includes('/timeline')) return JSON.stringify([[]]);
    if (path.includes('/compare/')) return JSON.stringify({ ahead_by: 2 });
    if (path.endsWith('.github/workflows/relevo-go.yml')) { if (!workflow) throw new Error('HTTP 404 Not Found'); return '{}'; }
    if (path.endsWith('/actions/variables/RELEVO_CLOUD_GO')) { if (variable === null) throw new Error('HTTP 404 Not Found'); return JSON.stringify({ value: variable }); }
    throw new Error(`unexpected ${path}`);
  };
  return gatherStatus({ gh, repo: 'acme/app', config });
};

test('Scenario: The pause variable cannot be read - it is recorded with its reason, and the rest of the data is kept', () => {
  const data = gatherWith({ refuse: ['/actions/variables/'] });
  assert.deepEqual(data.unread, [{ what: 'variable', reason: 'HTTP 403 Forbidden' }]);
  assert.equal(data.cloudBuilds, true, 'the cautious answer is kept');
});

test('Scenario: A workflow that is not installed - that is the answer, and nothing is listed as unread', () => {
  const data = gatherWith({ workflow: false, variable: null });
  assert.deepEqual(data.unread, []);
  assert.equal(data.cloudBuilds, false);
  assert.deepEqual(gatherWith({ variable: null }).unread, [], 'a variable that does not exist is not a failure either');
});

test('the workflow file and the comparison of a pull request are recorded when they are refused', () => {
  assert.deepEqual(gatherWith({ refuse: ['relevo-go.yml'] }).unread, [{ what: 'workflow', reason: 'HTTP 403 Forbidden' }]);
  assert.deepEqual(gatherWith({ refuse: ['/compare/'], withPr: true }).unread, [{ what: 'compare', pr: 40, reason: 'HTTP 403 Forbidden' }]);
});

test('Scenario: Everything was read - no unread list, and the report is the same as before', () => {
  const data = gatherWith({ withPr: true });
  assert.deepEqual(data.unread, []);
  const text = renderStatus(buildStatus({ config, me: 'ana', now: NOW, ...data }));
  assert.doesNotMatch(text, /Could not read/);
  assert.equal(text, 'Nothing is waiting on you.');
});

test('Scenario: Nothing waits and a read failed - the empty answer is qualified and the failed read is listed, in both languages', () => {
  const data = gatherWith({ refuse: ['/actions/variables/'] });
  const en = renderStatus(buildStatus({ config, me: 'ana', now: NOW, ...data }));
  assert.match(en, /^Nothing is waiting on you\. \(from what could be read\)/);
  assert.match(en, /Could not read, so this report may be incomplete:\n {2}the variable RELEVO_CLOUD_GO \(HTTP 403 Forbidden\): the issues you could build by hand may be missing/);
  const es = renderStatus(buildStatus({ config, me: 'ana', now: NOW, ...data }), 'es');
  assert.match(es, /^Nada espera por ti\. \(con lo que se pudo leer\)/);
  assert.match(es, /No se pudo leer, así que este informe puede estar incompleto:\n {2}la variable RELEVO_CLOUD_GO \(HTTP 403 Forbidden\)/);
  assert.ok(JSON.parse(JSON.stringify(buildStatus({ config, me: 'ana', now: NOW, ...data }))).unread.length === 1, 'the JSON carries it');
});

test('a report with things waiting still lists what could not be read, after them', () => {
  const r = buildStatus({ config, me: 'ana', now: NOW, issues: [issue(1, ['relevo:built'])], unread: [{ what: 'compare', pr: 40, reason: 'HTTP 403' }, { what: 'workflow', reason: 'HTTP 500' }] });
  const text = renderStatus(r);
  assert.match(text, /^Waiting on you:/);
  assert.ok(text.indexOf('Waiting on you') < text.indexOf('Could not read'));
  assert.match(text, /the comparison of the branch of pull request #40 with the base \(HTTP 403\)/);
  assert.match(text, /the workflow relevo-go\.yml \(HTTP 500\): the cloud is assumed to build/);
  assert.doesNotMatch(text, /\(from what could be read\)/, 'something does wait, so the empty answer is not printed');
});

// ---------- the usage of the runs in the digest

const mark = (o) => `This run used 1 turn.\n\n<!-- relevo:usage ${JSON.stringify(o)} -->`;
const botComment = (created_at, body) => ({ user: { type: 'Bot' }, created_at, body });

test('Scenario: Digest with usage / Runs without a marker - one read of the comments of the repository, and only the markers of bots inside the window count', () => {
  const asked = [];
  const gh = (args) => {
    asked.push(args[args.length - 1]);
    return JSON.stringify([
      [
        botComment('2026-03-09T10:00:00Z', mark({ turns: 10, cost: 1, tokens: 100, notional: false })),
        botComment('2026-03-04T10:00:00Z', mark({ turns: 20, cost: 2, notional: true })),
        botComment('2026-03-08T10:00:00Z', 'This run used 5 turns, about $0.50.'),
        botComment('2026-02-20T10:00:00Z', mark({ turns: 99, cost: 9 })),
      ],
      [{ user: { type: 'User' }, created_at: '2026-03-09T11:00:00Z', body: mark({ turns: 50 }) }],
    ]);
  };
  const runs = gatherUsage({ gh, repo: 'acme/app', now: NOW });
  assert.equal(asked.length, 1, 'one call, however many issues there are');
  assert.match(asked[0], /^repos\/acme\/app\/issues\/comments\?since=2026-03-03T12%3A00%3A00\.000Z&per_page=100$/);
  assert.deepEqual(runs.map((r) => r.turns), [10, 20]);
});

test('a read of the comments that fails gives no runs, and the status data carries usage only when asked', () => {
  const failing = () => { throw new Error('HTTP 500'); };
  assert.deepEqual(gatherUsage({ gh: failing, repo: 'acme/app', now: NOW }), []);
  const gh = (args) => {
    const path = args[args.length - 1];
    if (path.includes('/issues/comments')) return JSON.stringify([[botComment('2026-03-09T10:00:00Z', mark({ turns: 3 }))]]);
    if (path.includes('issues?') || path.includes('/pulls?')) return '[]';
    throw new Error('HTTP 404');
  };
  assert.equal('usage' in gatherStatus({ gh, repo: 'acme/app', config, now: NOW }), false, 'status reads nothing it does not show');
  assert.deepEqual(gatherStatus({ gh, repo: 'acme/app', config, withUsage: true, now: NOW }).usage.map((r) => r.turns), [3]);
});

const RUNS = [
  { turns: 10, cost: 1, tokens: 100, notional: false },
  { turns: 20, cost: 2.5, tokens: 1200, notional: false },
  { turns: 5, cost: 0.25, tokens: 50, notional: false },
];
const digestWith = (usage, language = 'en', issues = [issue(1, ['relevo:built'])]) => renderDigest(buildStatus({ config, now: NOW, issues, prs: [], usage }), language);

test('Scenario: Digest with usage - one line with the runs and the sum of their turns, cost and tokens, after the alerts', () => {
  const text = digestWith(RUNS);
  assert.match(text, /@ana: #1 \(built\)/);
  assert.match(text, /\n\nUsage, last 7 days: 3 runs, 35 turns, about \$3\.75, 1,350 tokens\.$/);
  assert.match(digestWith(RUNS, 'es'), /\n\nUso, últimos 7 días: 3 ejecuciones, 35 turnos, unos \$3\.75, 1350 tokens\.$/);
  assert.match(digestWith(RUNS.slice(0, 1)), /: 1 run, 10 turns/);
});

test('Scenario: No usage to report - the digest is the same as before', () => {
  const without = digestWith([]);
  assert.doesNotMatch(without, /Usage/);
  assert.equal(without, renderDigest(buildStatus({ config, now: NOW, issues: [issue(1, ['relevo:built'])], prs: [] })));
  assert.equal(buildStatus({ config, now: NOW, issues: [] }).usage, null);
});

test('Scenario: Nothing waiting but usage exists - no digest is posted', () => {
  assert.equal(digestWith(RUNS, 'en', []), null);
});

test('a cost that is notional is said to be, for all the runs that report a cost or for some of them', () => {
  const all = RUNS.map((r) => ({ ...r, notional: true }));
  assert.match(digestWith(all), /about \$3\.75 \(notional\), 1,350 tokens/);
  assert.match(digestWith(all, 'es'), /unos \$3\.75 \(nocional\)/);
  const some = [{ ...RUNS[0], notional: true }, RUNS[1], { turns: 4, notional: false }];
  assert.match(digestWith(some), /about \$3\.50 \(notional for 1 of 2 runs\)/, 'the run without a cost is not part of the count');
  assert.match(digestWith(some, 'es'), /\(nocional en 1 de 2 ejecuciones\)/);
  assert.doesNotMatch(digestWith(RUNS), /notional|nocional/);
  assert.match(digestWith([{ turns: 4, notional: false }]), /Usage, last 7 days: 1 run, 4 turns\.$/, 'a figure no run reports is left out');
});

test('the digest script adds the usage of a state file, and posts nothing for usage alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'digest-usage-'));
  writeFileSync(join(dir, 'relevo.yml'), tpl);
  const run = (state) => {
    writeFileSync(join(dir, 'state.json'), JSON.stringify(state));
    return spawnSync('node', [`${root}scripts/digest.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json'), '--now', '2026-03-10T12:00:00Z'], { encoding: 'utf8' });
  };
  const waiting = run({ issues: [issue(1, ['relevo:built'])], prs: [], milestones: [], usage: RUNS });
  assert.equal(waiting.status, 0, waiting.stderr);
  assert.match(waiting.stdout, /@ana: #1 \(built\)[\s\S]*Usage, last 7 days: 3 runs, 35 turns/);
  assert.equal(run({ issues: [], prs: [], milestones: [], usage: RUNS }).stdout, '');
});

// ---------- the stage times in the digest

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const sample = (stage, ...ms) => ms.map((m) => ({ stage, ms: m }));
const STAGE_SAMPLES = [
  ...sample('gate', 10 * SEC, 12 * SEC, 14 * SEC, 16 * SEC),
  ...sample('build', 4 * MIN, 6 * MIN, 9 * MIN),
  ...sample('wait', 3 * HOUR, 3 * HOUR, 3 * HOUR),
  ...sample('device', 24 * HOUR, 24 * HOUR),
];
const digestStages = (stages, language = 'en', over = {}) => renderDigest(buildStatus({ config, now: NOW, issues: [issue(1, ['relevo:built'])], prs: [], stages, ...over }), language);

test('Scenario: Digest with stage times - one line with the median and the count of each stage, in the order of the lifecycle', () => {
  assert.match(digestStages(STAGE_SAMPLES), /\n\nStages, last 7 days \(median\): gate 13 s \(4\), build 6 min \(3\), waiting for you 3 h \(3\), device review 24 h \(2\)\.$/);
  assert.match(digestStages(STAGE_SAMPLES, 'es'), /\n\nEtapas, últimos 7 días \(mediana\): puerta 13 s \(4\), construcción 6 min \(3\), esperando por ti 3 h \(3\), revisión en dispositivo 24 h \(2\)\.$/);
});

test('Scenario: A stage with no sample - the stages that were skipped are not in the line', () => {
  const text = digestStages(sample('build', 6 * MIN));
  assert.match(text, /: build 6 min \(1\)\.$/);
  assert.doesNotMatch(text, /gate|device|peer|waiting for you/);
});

test('Scenario: No stage finished - the digest is the same as before, with and without usage', () => {
  const plain = renderDigest(buildStatus({ config, now: NOW, issues: [issue(1, ['relevo:built'])], prs: [] }));
  assert.equal(digestStages([]), plain);
  assert.doesNotMatch(digestStages([]), /Stages/);
  assert.equal(buildStatus({ config, now: NOW, issues: [] }).stages, null);
  const withUsage = digestWith(RUNS);
  assert.equal(digestStages([], 'en', { usage: RUNS }), withUsage);
});

test('Scenario: Nothing waiting but stage times exist - no digest is posted', () => {
  assert.equal(digestStages(STAGE_SAMPLES, 'en', { issues: [] }), null);
});

test('the stage line comes right after the usage line, so that the two read as one block', () => {
  const text = digestStages(STAGE_SAMPLES, 'en', { usage: RUNS });
  assert.match(text, /Usage, last 7 days: 3 runs, 35 turns, about \$3\.75, 1,350 tokens\.\nStages, last 7 days \(median\): gate/);
  const blocks = text.split('\n\n');
  assert.equal(blocks.length, 3, 'the header, who waits, and one block');
  assert.equal(blocks[2].split('\n').length, 2, 'the block holds the usage and the stages, with no blank line between');
});
