import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSimulatorSource, iosReviewAudit } from '../scripts/lib/logaudit-ios.mjs';
import { auditReport } from '../scripts/lib/logaudit.mjs';
import { applyWaivers, waiveFinding, newState, confirmEnv, precheckItem, autoItem } from '../scripts/lib/review-state.mjs';

const e = (messageType, subsystem, eventMessage) => JSON.stringify({ messageType, subsystem, eventMessage });
const source = { source: 'simulator', udid: 'U1', process: 'OMB', since: '2026-11-17 09:00:00' };
const scope = { kind: 'ios', process: 'OMB', since: source.since };

test('a clean slice passes and counts the system noise', () => {
  const a = auditSimulatorSource(source, () => [e('Default', 'com.urban.omb', 'ok'), e('Error', 'com.apple.x', 'noise')].join('\n'), () => []);
  assert.equal(a.verdict, 'REVIEW PASSED');
  assert.equal(a.ignored, 1);
  assert.match(auditReport(a, { scope }), /1 error\(s\) were ignored as system noise/);
});

test('a slice with findings is rejected and folded with a count', () => {
  const a = auditSimulatorSource(source, () => [e('Fault', 'com.apple.runtime-issues', 'bad'), e('Fault', 'com.apple.runtime-issues', 'bad')].join('\n'), () => []);
  assert.equal(a.verdict, 'REVIEW REJECTED');
  assert.equal(a.findings[0].count, 2);
  assert.equal(a.findings[0].class, 'fault');
  assert.match(auditReport(a, { scope }), /2 times/);
});

test('an empty slice is inconclusive', () => {
  assert.equal(auditSimulatorSource(source, () => '', () => []).verdict, 'REVIEW INCONCLUSIVE');
});

test('a simulator that is no longer booted is inconclusive, never a pass', () => {
  const a = auditSimulatorSource(source, () => { throw new Error('the log of the simulator could not be read: No devices are booted.'); }, () => []);
  assert.equal(a.verdict, 'REVIEW INCONCLUSIVE');
  assert.match(a.reason, /No devices are booted/);
});

test('a finding of an iOS audit can be waived like the others', () => {
  const a = iosReviewAudit(e('Error', 'com.urban.omb', 'payment failed'));
  const state = { audit: { ...a, scope }, waivers: [] };
  waiveFinding(state, 1, 'known sandbox error');
  applyWaivers(state);
  assert.equal(state.audit.verdict, 'REVIEW PASSED (with waivers)');
});

test('a config error is not reported as a simulator that is not booted', () => {
  const a = auditSimulatorSource({ ...source, process: 'a" OR 1' }, ({ processName }) => { throw new Error(`the process name of the app has characters that a log filter does not accept (${processName})`); });
  assert.equal(a.verdict, 'REVIEW INCONCLUSIVE');
  assert.doesNotMatch(a.reason, /boot the simulator/);
});

const items = () => [{ id: 1, title: 'One', status: 'pending' }];
const iosState = (autopilot) => ({ ...newState(items(), { autopilot }), source });

test('Scenario: Precheck on iOS - refused until the person confirms the data, then recorded and still pending', () => {
  const s = iosState('precheck');
  assert.equal(s.autopilot, 'precheck');
  assert.throws(() => precheckItem(s, 1, 'ok', 'seen'), /non-production data/);
  const done = precheckItem(confirmEnv(s), 1, 'ok', 'seen');
  assert.deepEqual([done.items[0].status, done.items[0].precheck], ['pending', 'ok']);
});

test('Scenario: Auto on iOS - needs verify and the confirmation', () => {
  assert.throws(() => autoItem(confirmEnv(iosState('precheck')), 1, 'log line'), /"verify"/);
  assert.throws(() => autoItem(iosState('verify'), 1, 'log line'), /non-production data/);
  assert.equal(autoItem(confirmEnv(iosState('verify')), 1, 'log line').items[0].auto, 'log line');
});

test('Scenario: Autopilot off on iOS - precheck is refused', () => {
  assert.throws(() => precheckItem(confirmEnv(iosState('off')), 1, 'ok'), /off/);
});

const sys = (eventMessage, image = 'libCoreFSCache.dylib') => JSON.stringify({ messageType: 'Error', subsystem: '', eventMessage, senderImagePath: `/System/Library/Frameworks/OpenGLES.framework/${image}` });
const audited = (...entries) => auditSimulatorSource(source, () => entries.join('\n'), () => []);

test('Scenario: Ignored errors are listed - image, message and times, without changing the verdict', () => {
  const a = audited(sys('fopen failed'), sys('fopen failed'));
  assert.equal(a.verdict, 'REVIEW PASSED');
  const report = auditReport(a, { scope });
  assert.match(report, /2 error\(s\) were ignored as system noise \(a `com\.apple\.` subsystem, or no subsystem and a system image\)/);
  assert.match(report, /- `libCoreFSCache\.dylib`: `fopen failed` \(2 times\)/);
  assert.match(report, /no fault, and no error that is not system noise/);
  assert.doesNotMatch(report, /\/System\/Library|Apple frameworks/);
});

test('Scenario: More than five - the report lists five and counts them all', () => {
  const a = audited(...[1, 2, 3, 4, 5, 6, 7].map((n) => sys(`message ${n}`)));
  assert.equal(a.ignored, 7);
  const report = auditReport(a, { scope });
  assert.equal(report.split('\n').filter((l) => l.startsWith('- `libCoreFSCache.dylib`')).length, 5);
  assert.match(report, /7 error\(s\) were ignored/);
  assert.match(report, /The first 5 of 7 different ones/);
});

test('Scenario: Apple subsystems are not listed', () => {
  const report = auditReport(audited(e('Error', 'com.apple.x', 'noise')), { scope });
  assert.match(report, /1 error\(s\) were ignored/);
  assert.doesNotMatch(report, /written by a system image|- `/);
});

test('Scenario: After a waiver - the report written from the saved state still lists the ignored errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ios-waive-'));
  const statePath = join(dir, 'evidence', 'review-state.json');
  mkdirSync(join(dir, 'evidence'));
  const a = audited(sys('fopen failed'), e('Error', 'com.urban.omb', 'payment failed'));
  writeFileSync(statePath, JSON.stringify({ items: [], waivers: [], audit: { ...a, scope } }));
  execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/review-state.mjs', import.meta.url)), 'waive', '1', 'known'], { cwd: dir });
  assert.match(readFileSync(join(dir, 'evidence', 'review-report.md'), 'utf8'), /- `libCoreFSCache\.dylib`: `fopen failed` \(1 time\)/);
});
