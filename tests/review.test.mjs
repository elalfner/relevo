import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checklistFromChange, checklistMarkdown, scenariosFromSpec } from '../scripts/lib/checklist.mjs';
import { auditLog, auditReport, ERROR_CLASSES, filterByApp, linePid, pidsForPackage } from '../scripts/lib/logaudit.mjs';
import { decidePr, newState, setItem, syncState } from '../scripts/lib/review-state.mjs';
import { pickReviewer } from '../scripts/lib/reviewers.mjs';
import { capture, parseDevices, pickDevice, safeCaptureName } from '../scripts/lib/device.mjs';
import { openReviewCounts } from '../scripts/lib/github.mjs';

const CLI = (n) => new URL(`../scripts/${n}`, import.meta.url).pathname;

// ---------- checklist

const SPEC = `## ADDED Requirements

### Requirement: Something
Text.

#### Scenario: Shows the total
- **WHEN** the user opens the screen
- **THEN** the total is shown
- **AND** it has two decimals

#### Scenario: Empty list
- **WHEN** there is nothing to show
- **THEN** an empty message appears
`;

test('scenarios are read with their WHEN and THEN steps', () => {
  const s = scenariosFromSpec(SPEC);
  assert.deepEqual(s.map((x) => x.title), ['Shows the total', 'Empty list']);
  assert.deepEqual(s[0].when, ['the user opens the screen']);
  assert.deepEqual(s[0].then, ['the total is shown', 'it has two decimals']);
});

test('the checklist has one line per scenario, ticked when confirmed', () => {
  const items = scenariosFromSpec(SPEC).map((s, i) => ({ id: i + 1, ...s }));
  const md = checklistMarkdown(items, { 1: 'ok' });
  assert.match(md, /^- \[x\] 1\. \*\*Shows the total\*\*: when the user opens the screen, then the total is shown and it has two decimals$/m);
  assert.match(md, /^- \[ \] 2\. \*\*Empty list\*\*/m);
});

test('it reads the real specs of this project: one item per scenario heading', () => {
  const dir = new URL('../openspec/changes/relevo-v1', import.meta.url).pathname;
  const items = checklistFromChange(dir);
  let headings = 0;
  const walk = (d) => execFileSync('find', [d, '-name', 'spec.md'], { encoding: 'utf8' }).trim().split('\n').forEach((f) => {
    headings += (readFileSync(f, 'utf8').match(/^#### Scenario:/gm) ?? []).length;
  });
  walk(join(dir, 'specs'));
  assert.equal(items.length, headings);
  assert.ok(items.length > 50);
  assert.ok(items.every((i) => i.when.length > 0 && i.then.length > 0), 'every scenario has a WHEN and a THEN');
  assert.deepEqual(items.map((i) => i.id), items.map((_, i) => i + 1));
});

// ---------- log audit

test('Scenario: Clean console - none of the error classes means REVIEW PASSED', () => {
  const log = 'I/flutter ( 1): app started\nD/EGL: something harmless\nI/flutter ( 1): loaded 3 clients\n';
  const a = auditLog(log);
  assert.equal(a.verdict, 'REVIEW PASSED');
  assert.deepEqual(a.findings, []);
});

test('Scenario: Console errors - every named class is detected and means REVIEW REJECTED', () => {
  const cases = {
    layout: 'A RenderFlex overflowed by 21 pixels on the bottom.',
    lifecycle: 'setState() called after dispose(): _SummaryState#1',
    exception: 'E/flutter ( 1): [ERROR] Unhandled Exception: type \'Null\' is not a subtype',
    'network-data': 'E/flutter ( 1): Unhandled Exception: PostgrestException(message: boom)',
    'missing-activity': 'android.content.ActivityNotFoundException: No Activity found to handle Intent',
  };
  assert.deepEqual(Object.keys(cases).sort(), [...ERROR_CLASSES].sort(), 'every error class has a test');
  Object.entries(cases).forEach(([cls, line]) => {
    const a = auditLog(`I/flutter: ok\n${line}\n`);
    assert.equal(a.verdict, 'REVIEW REJECTED', cls);
    assert.ok(a.findings.some((f) => f.class === cls), `${cls} not detected`);
    assert.equal(a.findings.find((f) => f.class === cls).line, 2);
  });
});

test('a handled network error that is only logged is not a finding', () => {
  assert.equal(auditLog('I/flutter: retrying after SocketException (handled)\n').verdict, 'REVIEW PASSED');
});

test('colour codes are stripped, repeats are reported once, excerpts are short', () => {
  const noisy = '\u001b[31mE/flutter: Unhandled Exception: boom\u001b[0m\n'.repeat(3) + `E/flutter: Unhandled Exception: ${'x'.repeat(500)}\n`;
  const a = auditLog(noisy);
  assert.equal(a.findings.length, 2);
  assert.ok(!a.findings[0].excerpt.includes('\u001b'));
  assert.ok(a.findings.every((f) => f.excerpt.length <= 200));
});

test('the report states the verdict and each finding', () => {
  const md = auditReport(auditLog('A RenderFlex overflowed by 5 pixels\n'), { issue: 31 });
  assert.match(md, /# Review report for #31/);
  assert.match(md, /\*\*REVIEW REJECTED\*\*/);
  assert.match(md, /\*\*layout\*\* \(log line 1\)/);
  assert.match(auditReport(auditLog('ok\n')), /\*\*REVIEW PASSED\*\*/);
});

// ---------- the rule for opening the pull request

const twoItems = () => newState([{ id: 1, title: 'A' }, { id: 2, title: 'B' }]);
const passedAudit = { verdict: 'REVIEW PASSED', counts: {}, findings: [] };

test('Scenario: Verified - passed audit, every line confirmed and the person agrees: the PR may open', () => {
  const s = twoItems();
  setItem(s, 1, 'ok');
  setItem(s, 2, 'ok');
  s.audit = passedAudit;
  s.agreed = true;
  assert.deepEqual(decidePr(s), { open: true, reasons: [] });
});

test('Scenario: Checklist incomplete - a pending or failing line blocks the PR', () => {
  const s = twoItems();
  setItem(s, 1, 'ok');
  s.audit = passedAudit;
  s.agreed = true;
  let d = decidePr(s);
  assert.equal(d.open, false);
  assert.match(d.reasons[0], /item 2 \("B"\) is not confirmed yet/);
  setItem(s, 2, 'fail', 'the total is wrong');
  d = decidePr(s);
  assert.equal(d.open, false);
  assert.match(d.reasons[0], /failed: the total is wrong/);
});

test('each condition blocks the PR on its own', () => {
  const ready = () => {
    const s = twoItems();
    setItem(s, 1, 'ok');
    setItem(s, 2, 'ok');
    s.audit = passedAudit;
    s.agreed = true;
    return s;
  };
  const noAudit = ready(); noAudit.audit = null;
  assert.match(decidePr(noAudit).reasons[0], /audit has not run/);
  const badAudit = ready(); badAudit.audit = { verdict: 'REVIEW REJECTED' };
  assert.match(decidePr(badAudit).reasons[0], /found problems/);
  const notAgreed = ready(); notAgreed.agreed = false;
  assert.match(decidePr(notAgreed).reasons[0], /has not agreed/);
  assert.match(decidePr({ ...ready(), items: [] }).reasons[0], /no scenarios/);
});

test('invalid statuses and unknown items are rejected', () => {
  assert.throws(() => setItem(twoItems(), 1, 'maybe'), /status must be one of/);
  assert.throws(() => setItem(twoItems(), 9, 'ok'), /no checklist item 9/);
});

test('review-state CLI: the whole review, from init to the decision', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  const change = join(dir, 'change');
  mkdirSync(join(change, 'specs', 'cap'), { recursive: true });
  writeFileSync(join(change, 'specs', 'cap', 'spec.md'), SPEC);
  const state = join(dir, 'evidence', 'review-state.json');
  const run = (input, ...args) => spawnSync('node', [CLI('review-state.mjs'), ...args, '--state', state], { input, encoding: 'utf8' });

  assert.match(run('', 'init', change).stdout, /2 checklist item/);
  assert.equal(run('', 'decide').status, 1);
  run('', 'set', '1', 'ok');
  run('', 'set', '2', 'ok');
  assert.equal(run('', 'decide').status, 1, 'the audit has not run');
  assert.match(run('I/flutter: fine\n', 'audit').stdout, /REVIEW PASSED/);
  assert.equal(run('', 'decide').status, 1, 'the person has not agreed');
  run('', 'agree');
  const final = run('', 'decide');
  assert.equal(final.status, 0);
  assert.match(final.stdout, /may be opened/);
  assert.match(readFileSync(join(dir, 'evidence', 'review-report.md'), 'utf8'), /REVIEW PASSED/);

  assert.match(run('A RenderFlex overflowed\n', 'audit').stdout, /REVIEW REJECTED/);
  assert.equal(run('', 'decide').status, 1, 'a later failing audit blocks the PR again');
  assert.equal(run('', 'set', '7', 'ok').status, 2);
});

test('after a fix: confirmed lines stay, failed lines are retested, new scenarios are pending, audit and agreement reset', () => {
  const s = twoItems();
  setItem(s, 1, 'ok');
  setItem(s, 2, 'fail', 'wrong total');
  s.audit = passedAudit;
  s.agreed = true;
  syncState(s, [{ id: 1, title: 'A' }, { id: 2, title: 'B' }, { id: 3, title: 'C (new scenario)' }]);
  assert.deepEqual(s.items.map((i) => [i.id, i.status]), [[1, 'ok'], [2, 'pending'], [3, 'pending']]);
  assert.equal(s.items[1].note, null);
  assert.equal(s.audit, null);
  assert.equal(s.agreed, false);
  assert.equal(decidePr(s).open, false);
});

test('review-state CLI: sync after a fix adds the new scenario and keeps what was confirmed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  const change = join(dir, 'change');
  mkdirSync(join(change, 'specs', 'cap'), { recursive: true });
  const specFile = join(change, 'specs', 'cap', 'spec.md');
  writeFileSync(specFile, SPEC);
  const state = join(dir, 'evidence', 'review-state.json');
  const run = (...args) => spawnSync('node', [CLI('review-state.mjs'), ...args, '--state', state], { encoding: 'utf8' });
  run('init', change);
  run('set', '1', 'ok');
  run('set', '2', 'fail', 'nothing shown');
  writeFileSync(specFile, `${SPEC}\n#### Scenario: Offline\n- **WHEN** there is no network\n- **THEN** the last list is shown\n`);
  const out = run('sync', change);
  assert.match(out.stdout, /3 checklist item\(s\), 2 to test again/);
  const saved = JSON.parse(readFileSync(state, 'utf8'));
  assert.deepEqual(saved.items.map((i) => i.status), ['ok', 'pending', 'pending']);
});

// ---------- reviewer selection

const TEAM = { members: ['persona-a', 'persona-b', 'persona-c'], specWriter: 'persona-a' };

test('Scenario: Two developers - the other developer reviews, never the author or the spec writer', () => {
  assert.equal(pickReviewer({ ...TEAM, author: 'persona-b' }), 'persona-c');
  assert.equal(pickReviewer({ ...TEAM, author: 'persona-c' }), 'persona-b');
});

test('Scenario: Several eligible reviewers - the one with fewer open reviews', () => {
  const members = [...TEAM.members, 'persona-d'];
  const r = pickReviewer({ ...TEAM, members, author: 'persona-b', openCounts: { 'persona-c': 3, 'persona-d': 1 } });
  assert.equal(r, 'persona-d');
});

test('ties rotate with the pull request number', () => {
  const members = [...TEAM.members, 'persona-d'];
  const pick = (prNumber) => pickReviewer({ ...TEAM, members, author: 'persona-b', prNumber });
  assert.deepEqual([pick(10), pick(11), pick(12)], ['persona-c', 'persona-d', 'persona-c']);
});

test('Scenario: Nobody eligible - null, so the issue gets needs-reviewer', () => {
  assert.equal(pickReviewer({ members: ['persona-a', 'persona-b'], specWriter: 'persona-a', author: 'persona-b' }), null);
});

test('roles mode only considers the listed approvers', () => {
  const args = { ...TEAM, author: 'persona-b', mode: 'roles' };
  assert.equal(pickReviewer({ ...args, approvers: [] }), null);
  assert.equal(pickReviewer({ ...args, approvers: ['persona-c'] }), 'persona-c');
});

test('open review requests are counted per person through the search API', () => {
  const asked = [];
  const gh = (a) => {
    asked.push(decodeURIComponent(a[a.length - 1]));
    return JSON.stringify({ total_count: asked.length * 2 });
  };
  assert.deepEqual(openReviewCounts({ gh, repo: 'acme/app', logins: ['x', 'y'] }), { x: 2, y: 4 });
  assert.match(asked[0], /repo:acme\/app is:pr is:open review-requested:x/);
});

// ---------- device and capture

const ADB_OK = 'List of devices attached\nemulator-5554\tdevice\n\n';

test('adb devices output is parsed', () => {
  assert.deepEqual(parseDevices(ADB_OK), [{ serial: 'emulator-5554', state: 'device' }]);
  assert.deepEqual(parseDevices('List of devices attached\n* daemon started *\n\n'), []);
});

test('Scenario: No device - the message tells the person what to do', () => {
  assert.throws(() => pickDevice([]), /connect an Android device with USB debugging/);
  assert.throws(() => pickDevice([{ serial: 'abc', state: 'unauthorized' }]), /unauthorised: unlock it/);
  assert.throws(() => pickDevice([{ serial: 'a', state: 'device' }, { serial: 'b', state: 'device' }]), /ANDROID_SERIAL/);
  assert.equal(pickDevice([{ serial: 'a', state: 'device' }, { serial: 'b', state: 'device' }], 'b'), 'b');
  assert.throws(() => pickDevice([{ serial: 'a', state: 'device' }], 'zzz'), /not connected/);
  assert.equal(pickDevice(parseDevices(ADB_OK)), 'emulator-5554');
});

test('capture names are plain file names, never paths', () => {
  assert.equal(safeCaptureName('02_after_tap'), '02_after_tap');
  assert.equal(safeCaptureName('01.initial.png'), '01.initial');
  ['../x', 'a/b', '/etc/passwd', '', 'a b', '..', '.hidden', 'x;rm -rf'].forEach((bad) => assert.throws(() => safeCaptureName(bad), /letters, digits/, bad));
});

test('Scenario: Capture - the screenshot is saved as <name>.png and nothing else happens', () => {
  const written = {};
  const calls = [];
  const adb = (args) => { calls.push(args); return Buffer.from('PNGDATA-123'); };
  const path = capture({ adb, name: '02_after_tap', dir: 'evidence', serial: 'emulator-5554', write: (p, d) => { written[p] = d; }, mkdir: () => {} });
  assert.equal(path, 'evidence/02_after_tap.png');
  assert.deepEqual(calls, [['-s', 'emulator-5554', 'exec-out', 'screencap', '-p']]);
  assert.equal(String(written[path]), 'PNGDATA-123');
  assert.ok(!calls.flat().some((a) => ['input', 'tap', 'swipe', 'keyevent'].includes(a)), 'capture never sends input to the device');
});

test('an empty screenshot is reported, not saved', () => {
  assert.throws(() => capture({ adb: () => Buffer.alloc(0), name: 'x', serial: 's', write: () => assert.fail('must not write'), mkdir: () => {} }), /returned no image/);
});

test('capture CLI rejects a path as a name before touching any device', () => {
  const run = spawnSync('node', [CLI('capture.mjs'), '../escape'], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /letters, digits|adb is not installed/);
});

test('checklist CLI prints markdown and counts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  mkdirSync(join(dir, 'specs', 'cap'), { recursive: true });
  writeFileSync(join(dir, 'specs', 'cap', 'spec.md'), SPEC);
  assert.equal(execFileSync('node', [CLI('checklist.mjs'), dir, '--count'], { encoding: 'utf8' }).trim(), '2');
  assert.match(execFileSync('node', [CLI('checklist.mjs'), dir], { encoding: 'utf8' }), /^- \[ \] 1\. \*\*Shows the total\*\*/);
  assert.equal(spawnSync('node', [CLI('checklist.mjs'), '/nope'], { encoding: 'utf8' }).status, 2);
});

// ---------- needs-reviewer (4.5)

import { noReviewerDecision } from '../scripts/lib/reviewers.mjs';
import { loadConfig as loadCfg } from '../scripts/lib/config.mjs';

const cfgTpl = readFileSync(new URL('../templates/relevo.yml', import.meta.url), 'utf8');

test('Scenario: Nobody eligible - the label goes next to the state and the spec writer is mentioned', () => {
  const { config } = loadCfg(cfgTpl.replace('spec_writer: null', 'spec_writer: luz'));
  const d = noReviewerDecision({ config, issue: { number: 12, title: 'Add total', pr: 'https://x/pull/40', labels: ['relevo:pr-open'] } });
  assert.deepEqual(d.labels, { add: ['relevo:needs-reviewer'], remove: [] });
  assert.equal(d.comment.kind, 'needs_reviewer');
  assert.equal(d.comment.data.spec_writer, 'luz');
});

test('the label is not added twice', () => {
  const { config } = loadCfg(cfgTpl.replace('spec_writer: null', 'spec_writer: luz'));
  const d = noReviewerDecision({ config, issue: { number: 12, title: 't', pr: 'u', labels: ['relevo:pr-open', 'relevo:needs-reviewer'] } });
  assert.deepEqual(d.labels.add, []);
});

test('Scenario: roles mode - only approvers are eligible, and nobody is a null', () => {
  assert.equal(pickReviewer({ members: ['a', 'b', 'c'], author: 'a', approvers: ['a'], mode: 'roles' }), null);
  assert.equal(pickReviewer({ members: ['a', 'b', 'c'], author: 'a', approvers: ['c'], mode: 'roles' }), 'c');
});

test('ties are broken in rotation by pull request number', () => {
  const args = { members: ['a', 'b', 'c', 'd'], author: 'a', openCounts: {} };
  const picks = new Set([1, 2, 3].map((n) => pickReviewer({ ...args, prNumber: n })));
  assert.equal(picks.size, 3);
});

// ---------- log audit limited to the app under review
const APP = 'com.example.counter';
const MIXED = [
  `10-14 12:00:01.000  500  600 I ActivityManager: Start proc 4242:${APP}/u0a99 for next-top-activity`,
  '10-14 12:00:02.000  4242  4242 I flutter : app started',
  '10-14 12:00:03.000  7777  7777 E flutter : Unhandled Exception: other app crashed',
  '10-14 12:00:04.000  7777  7777 I Other  : notification registration token abc123',
].join('\n');

test('Scenario: Another app logs an error - only the app under review is audited and quoted', () => {
  const { text, scope } = filterByApp(MIXED, { package: APP });
  assert.deepEqual(scope, { package: APP, pids: [4242] });
  assert.ok(!text.includes('other app crashed') && !text.includes('token abc123'));
  const audit = auditLog(text);
  assert.equal(audit.verdict, 'REVIEW PASSED');
  assert.ok(!auditReport(audit, { scope }).includes('other app crashed'));
  assert.match(auditReport(audit, { scope }), /only the processes of `com\.example\.counter` \(pid 4242\)/);
});

test('an error written by the app under review is still found', () => {
  const log = `${MIXED}\n10-14 12:00:05.000  4242  4242 E flutter : Unhandled Exception: Bad state`;
  const { text } = filterByApp(log, { package: APP });
  assert.equal(auditLog(text).verdict, 'REVIEW REJECTED');
});

test('Scenario: The application process is not in the log - the whole log is audited and the report says so', () => {
  const log = '10-14 12:00:03.000  7777  7777 E flutter : Unhandled Exception: other app crashed';
  const { text, scope } = filterByApp(log, { package: APP });
  assert.equal(text, log);
  assert.deepEqual(scope.pids, []);
  assert.match(auditReport(auditLog(text), { scope }), /whole device log.*not found/);
});

test('process ids come from the log, from crash headers and from --pid, in both logcat formats', () => {
  assert.equal(linePid('10-14 12:00:00.000  1234  1234 E tag: x'), 1234);
  assert.equal(linePid('10-14 12:00:00.000 E/flutter ( 1234): x'), 1234);
  assert.equal(linePid('no pid here'), null);
  assert.deepEqual(pidsForPackage(`E AndroidRuntime: Process: ${APP}, PID: 99`, APP), [99]);
  const { scope } = filterByApp('10-14 12:00:00.000  55  55 E flutter : Unhandled Exception: x', { package: APP, pids: ['55'] });
  assert.deepEqual(scope.pids, [55]);
  assert.deepEqual(pidsForPackage(`Start proc 1:${APP}.other/u0`, APP), [], 'a different package that starts with the same prefix is not the app');
});
