import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditIosLog, parseNdjson } from '../scripts/lib/logaudit-ios.mjs';

// A sanitized slice of a real launch of an app in the iOS Simulator (iOS 27.1, 2026-11-17).
const REAL = readFileSync(new URL('./fixtures/ios-log/real-launch.ndjson', import.meta.url), 'utf8');
const line = (o) => JSON.stringify(o);
const entry = (messageType, subsystem, eventMessage) => line({ messageType, subsystem, category: '', eventMessage, timestamp: '2026-11-17 09:17:36.688170-0600' });

test('Scenario: Noise of an Apple framework - the Errors of a real launch are not findings, and they are counted', () => {
  const r = auditIosLog(REAL);
  assert.equal(r.status, 'clean');
  assert.equal(r.entries, 6);
  assert.equal(r.ignored, 3);
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.counts, { Default: 2, Error: 3, untyped: 1 });
});

test('Scenario: A SwiftUI runtime issue - a Fault is a finding', () => {
  const text = [entry('Default', 'com.urban.omb', 'started'), entry('Fault', 'com.apple.runtime-issues', 'Publishing changes from within view updates is not allowed')].join('\n');
  const r = auditIosLog(text);
  assert.equal(r.status, 'findings');
  assert.equal(r.findings.length, 1);
  assert.deepEqual([r.findings[0].level, r.findings[0].subsystem], ['fault', 'com.apple.runtime-issues']);
  assert.match(r.findings[0].message, /Publishing changes/);
});

test('Scenario: An error of the app - an Error of the app or of a library that is not Apple is a finding', () => {
  const r = auditIosLog([entry('Error', 'com.urban.omb', 'payment failed'), entry('Error', '', 'plain os_log error'), entry('Error', 'io.thirdparty.sdk', 'sdk error')].join('\n'));
  assert.equal(r.status, 'findings');
  assert.deepEqual(r.findings.map((f) => f.subsystem), ['com.urban.omb', '', 'io.thirdparty.sdk']);
  assert.equal(r.ignored, 0);
});

test('other types are not findings', () => {
  const r = auditIosLog([entry('Default', 'com.urban.omb', 'a'), entry('Info', 'com.urban.omb', 'b'), entry('Debug', 'com.urban.omb', 'c')].join('\n'));
  assert.equal(r.status, 'clean');
  assert.equal(r.findings.length, 0);
});

test('Scenario: An empty log - the audit is inconclusive and says so', () => {
  for (const empty of ['', '\n\n', 'getpwuid_r did not find a match for uid 502\n']) {
    const r = auditIosLog(empty);
    assert.equal(r.status, 'inconclusive');
    assert.match(r.reason, /no entry of the app/);
    assert.equal(r.entries, 0);
  }
});

test('Scenario: Lines that are not entries - they are skipped and the rest is read', () => {
  const text = ['getpwuid_r did not find a match for uid 502', '{broken json', '[1,2]', '{"unrelated":true}', entry('Fault', 'com.apple.runtime-issues', 'bad'), ''].join('\n');
  assert.equal(parseNdjson(text).length, 1);
  assert.equal(auditIosLog(text).status, 'findings');
});

test('identical findings are folded into one with a count, and long messages are cut', () => {
  const long = 'x'.repeat(500);
  const r = auditIosLog([entry('Fault', 'com.apple.runtime-issues', 'same'), entry('Fault', 'com.apple.runtime-issues', 'same'), entry('Error', 'com.urban.omb', long)].join('\n'));
  assert.equal(r.findings.length, 2);
  assert.equal(r.findings[0].count, 2);
  assert.equal(r.findings[1].message.length, 200);
});

// The crash reports of the app: a real report of a simulator app that ended in `fatalError` (trimmed to the fields the audit reads).
import { mkdtempSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { findCrashReports, auditSimulatorSource as auditSource } from '../scripts/lib/logaudit-ios.mjs';
import { formatLogStart } from '../scripts/lib/device-ios.mjs';

// The review start is local time of the machine, so the starts are built from the instant of the crash (2026-11-19 16:58:33 UTC), not written in a zone.
const CRASH_AT = Date.UTC(2026, 10, 19, 16, 58, 33);
const startAt = (seconds) => formatLogStart(new Date(CRASH_AT + seconds * 1000));
const BEFORE = startAt(-33);
const AFTER = startAt(27);

const crashFixture = new URL('./fixtures/ios-log/crash-report.ips', import.meta.url);
const UDID = '94E35096-C3C1-4FB7-A807-DFD9020E7E00';
const crashDir = (name = 'ProbeExec-2026-11-19-105845.ips') => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'crash-'));
  copyFileSync(crashFixture, joinPath(dir, name));
  return dir;
};

test('a crash report captured after the review started is a finding', () => {
  const found = findCrashReports({ dir: crashDir(), processName: 'ProbeExec', since: BEFORE, udid: UDID });
  assert.equal(found.length, 1);
  assert.equal(found[0].class, 'crash');
  assert.match(found[0].excerpt, /ProbeExec Trace\/BPT trap: 5 at 2026-11-19 10:58:33/);
});

test('a crash report from before the start, of another app, or of another simulator is not a finding', () => {
  assert.deepEqual(findCrashReports({ dir: crashDir(), processName: 'ProbeExec', since: AFTER, udid: UDID }), []);
  assert.deepEqual(findCrashReports({ dir: crashDir(), processName: 'Other', since: BEFORE, udid: UDID }), []);
  assert.deepEqual(findCrashReports({ dir: crashDir(), processName: 'ProbeExec', since: BEFORE, udid: 'OTHER-UDID' }), []);
});

test('a folder that cannot be read, or a file that is not a report, gives no finding', () => {
  assert.deepEqual(findCrashReports({ dir: '/nonexistent-crash-dir', processName: 'ProbeExec', since: BEFORE }), []);
  const dir = mkdtempSync(joinPath(tmpdir(), 'crash-'));
  writeFileSync(joinPath(dir, 'ProbeExec-2026-11-19-105845.ips'), 'not a report');
  assert.deepEqual(findCrashReports({ dir, processName: 'ProbeExec', since: BEFORE }), []);
});

test('a crash makes the audit reject even when the log of the app is empty', () => {
  const src = { source: 'simulator', udid: UDID, process: 'ProbeExec', since: BEFORE };
  const crashes = (args) => findCrashReports({ ...args, dir: crashDir() });
  const a = auditSource(src, () => '', crashes);
  assert.equal(a.verdict, 'REVIEW REJECTED');
  assert.equal(a.findings[0].class, 'crash');
  assert.equal(a.counts.crash, 1);
  assert.equal(auditSource(src, () => '', () => []).verdict, 'REVIEW INCONCLUSIVE');
});

test('a real SwiftUI runtime issue (state changed inside body, seen on iOS 27.0) is a Fault of com.apple.runtime-issues and a finding', () => {
  const text = readFileSync(new URL('./fixtures/ios-log/swiftui-runtime-issue.ndjson', import.meta.url), 'utf8');
  const a = auditIosLog(text);
  assert.equal(a.status, 'findings');
  assert.equal(a.findings[0].level, 'fault');
  assert.equal(a.findings[0].subsystem, 'com.apple.runtime-issues');
  assert.match(a.findings[0].message, /Modifying state during view update/);
});
