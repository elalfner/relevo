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
