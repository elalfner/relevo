import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSimulatorSource, iosReviewAudit } from '../scripts/lib/logaudit-ios.mjs';
import { auditReport } from '../scripts/lib/logaudit.mjs';
import { applyWaivers, waiveFinding } from '../scripts/lib/review-state.mjs';

const e = (messageType, subsystem, eventMessage) => JSON.stringify({ messageType, subsystem, eventMessage });
const source = { source: 'simulator', udid: 'U1', process: 'OMB', since: '2026-11-17 09:00:00' };
const scope = { kind: 'ios', process: 'OMB', since: source.since };

test('a clean slice passes and counts the system noise', () => {
  const a = auditSimulatorSource(source, () => [e('Default', 'com.urban.omb', 'ok'), e('Error', 'com.apple.x', 'noise')].join('\n'));
  assert.equal(a.verdict, 'REVIEW PASSED');
  assert.equal(a.ignored, 1);
  assert.match(auditReport(a, { scope }), /1 error\(s\) written by Apple frameworks/);
});

test('a slice with findings is rejected and folded with a count', () => {
  const a = auditSimulatorSource(source, () => [e('Fault', 'com.apple.runtime-issues', 'bad'), e('Fault', 'com.apple.runtime-issues', 'bad')].join('\n'));
  assert.equal(a.verdict, 'REVIEW REJECTED');
  assert.equal(a.findings[0].count, 2);
  assert.equal(a.findings[0].class, 'fault');
  assert.match(auditReport(a, { scope }), /2 times/);
});

test('an empty slice is inconclusive', () => {
  assert.equal(auditSimulatorSource(source, () => '').verdict, 'REVIEW INCONCLUSIVE');
});

test('a simulator that is no longer booted is inconclusive, never a pass', () => {
  const a = auditSimulatorSource(source, () => { throw new Error('the log of the simulator could not be read: No devices are booted.'); });
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
