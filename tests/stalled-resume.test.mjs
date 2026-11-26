import test from 'node:test';
import assert from 'node:assert/strict';
import { latestStalled, madeNoProgress, stalledMarker } from '../scripts/lib/stalled-marker.mjs';
import { stallBlock } from '../scripts/lib/resume-gate.mjs';

const LIMITS = { turns: 100, minutes: 50, cost: 5 };
const bot = (body) => ({ user: { type: 'Bot' }, body, created_at: '2026-11-24T10:00:00Z' });
const person = (body) => ({ user: { type: 'User' }, body });
const failure = (marker = '') => `@persona-b #42 "Summary" stopped ❌\n\nThe run stopped at a limit before it finished (run limit reached).\n${marker}`;

test('the marker is built from the three numbers and nothing else', () => {
  assert.equal(stalledMarker(LIMITS), '<!-- relevo:stalled {"turns":100,"minutes":50,"cost":5} -->');
  assert.throws(() => stalledMarker({ turns: 100, minutes: 'x', cost: 5 }));
  assert.throws(() => stalledMarker({ turns: 100, minutes: 50, cost: -1 }));
  assert.throws(() => stalledMarker({ turns: 100, minutes: 50 }));
});

test('it is read from the last failure comment of a bot only', () => {
  const marker = stalledMarker(LIMITS);
  assert.deepEqual(latestStalled([bot(failure(marker))]), LIMITS);
  assert.equal(latestStalled([person(failure(marker))]), null, 'a person who types a marker changes nothing');
  assert.equal(latestStalled([bot('a comment that is not a failure\n' + marker)]), null);
  assert.equal(latestStalled([bot(failure(`${marker}\n${marker}`))]), null, 'exactly one marker counts');
  assert.equal(latestStalled([bot(failure('<!-- relevo:stalled {"turns":"a","minutes":50,"cost":5} -->'))]), null, 'a marker with a bad field counts for nothing');
  assert.equal(latestStalled([]), null);
  assert.equal(latestStalled(undefined), null);
});

test('a newer failure comment replaces the marker, so a resume that did progress blocks nothing', () => {
  const marker = stalledMarker(LIMITS);
  assert.equal(latestStalled([bot(failure(marker)), bot(failure())]), null);
  assert.deepEqual(latestStalled([bot(failure()), bot(failure(marker))]), LIMITS);
  assert.deepEqual(latestStalled([bot(failure(marker)), person('thanks'), bot('<!-- relevo:retry {} -->')]), LIMITS, 'comments that are not failures do not replace it');
});

test('the block lifts when one limit of the configuration is higher than the recorded one, and not when it is lower or equal', () => {
  const cfg = { run_max_turns: 100, run_max_minutes: 50, run_max_cost: 5 };
  assert.deepEqual(stallBlock(LIMITS, cfg).raise, ['run_max_turns', 'run_max_minutes', 'run_max_cost']);
  assert.equal(stallBlock(LIMITS, { ...cfg, run_max_cost: 8 }), null);
  assert.equal(stallBlock(LIMITS, { ...cfg, run_max_turns: 150 }), null);
  assert.notEqual(stallBlock(LIMITS, { ...cfg, run_max_minutes: 30 }), null);
  assert.equal(stallBlock(null, cfg), null);
});

test('a resumed run made no progress when it stopped at a limit with the same tasks done, and a resume that finished one task did', () => {
  assert.equal(madeNoProgress({ resumed: true, reason: 'run limit reached', doneAtStart: 4, doneAtEnd: 4 }), true);
  assert.equal(madeNoProgress({ resumed: true, reason: 'run limit reached', doneAtStart: 4, doneAtEnd: 5 }), false);
  assert.equal(madeNoProgress({ resumed: false, reason: 'run limit reached', doneAtStart: 0, doneAtEnd: 0 }), false, 'a first run is not a resume');
  assert.equal(madeNoProgress({ resumed: true, reason: 'QA rejected after the retries', doneAtStart: 4, doneAtEnd: 4 }), false, 'only a limit stalls');
  assert.equal(madeNoProgress({ resumed: true, reason: 'run limit reached', doneAtStart: null, doneAtEnd: 4 }), false, 'unknown counts are never taken for a stall');
});

// The script that `go` calls: it records the tasks done when a resumed run starts and says, at the failure path, whether that run stalled.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../scripts/resume-progress.mjs', import.meta.url).pathname;
const progress = mkdtempSync(join(tmpdir(), 'relevo-progress-'));
const config = join(mkdtempSync(join(tmpdir(), 'relevo-cfg-')), 'relevo.yml');
writeFileSync(config, 'limits:\n  run_max_cost: 5\n  run_max_turns: 100\n  run_max_minutes: 50\nteam:\n  spec_writer: persona-a\n  members: [persona-a]\n');
const cli = (env, ...args) => spawnSync('node', [CLI, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });

test('resume-progress: a resumed run that stops at a limit with the same tasks done is stalled, and the limits come from relevo.yml', () => {
  const env = { RELEVO_PROGRESS_DIR: progress };
  assert.equal(cli(env, 'start', '--done', '4').status, 0);
  const stalled = JSON.parse(cli(env, 'check', '--reason', 'run limit reached', '--done', '4', '--config', config).stdout);
  assert.deepEqual(stalled, { stalled: true, limit_turns: 100, limit_minutes: 50, limit_cost: 5 });
  const progressed = JSON.parse(cli(env, 'check', '--reason', 'run limit reached', '--done', '5', '--config', config).stdout);
  assert.deepEqual(progressed, { stalled: false });
  const other = JSON.parse(cli(env, 'check', '--reason', 'QA rejected after the retries', '--done', '4', '--config', config).stdout);
  assert.deepEqual(other, { stalled: false });
});

test('resume-progress: a run that was not resumed, or has no state folder, or cannot read its limits, is never stalled', () => {
  const fresh = mkdtempSync(join(tmpdir(), 'relevo-progress-'));
  assert.deepEqual(JSON.parse(cli({ RELEVO_PROGRESS_DIR: fresh }, 'check', '--reason', 'run limit reached', '--done', '0', '--config', config).stdout), { stalled: false }, 'no start was recorded');
  const none = cli({ RELEVO_PROGRESS_DIR: '' }, 'check', '--reason', 'run limit reached', '--done', '0', '--config', config);
  assert.equal(none.status, 0);
  assert.deepEqual(JSON.parse(none.stdout), { stalled: false });
  assert.equal(cli({ RELEVO_PROGRESS_DIR: progress }, 'start', '--done', '4').status, 0);
  const noConfig = JSON.parse(cli({ RELEVO_PROGRESS_DIR: progress }, 'check', '--reason', 'run limit reached', '--done', '4', '--config', join(fresh, 'missing.yml')).stdout);
  assert.deepEqual(noConfig, { stalled: false }, 'a limit that cannot be read is not taken for a stall');
  assert.equal(cli({ RELEVO_PROGRESS_DIR: progress }, 'nope').status, 2);
});
