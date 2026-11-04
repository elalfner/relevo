import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OUTCOME_CLASSES, phaseSeconds, readClass, readPhaseLog, recordPhase, writeClass } from '../scripts/lib/phase-log.mjs';
import { parseUsageMarker, summarizeOutcomes, usageMarker } from '../scripts/lib/run-usage.mjs';

const PROGRESS = new URL('../scripts/progress.mjs', import.meta.url).pathname;
const RUN_USAGE = new URL('../scripts/run-usage.mjs', import.meta.url).pathname;
const fresh = () => mkdtempSync(join(tmpdir(), 'relevo-phases-'));
const usage = { turns: 10, cost: 1.5, tokens: 1000, cached: 0 };
const bot = (marker) => ({ user: { type: 'Bot' }, created_at: '2026-03-10T00:00:00Z', body: `This run used 10 turns.\n\n${marker}` });

test('Scenario: a sequence of phases and attempts - each lasts until the next begins', () => {
  const dir = fresh();
  recordPhase(dir, { phase: 'planning' }, 0);
  recordPhase(dir, { phase: 'development' }, 20_000);
  recordPhase(dir, { phase: 'qa', attempt: 1, of: 3 }, 100_000);
  recordPhase(dir, { phase: 'development' }, 130_000);
  recordPhase(dir, { phase: 'qa', attempt: 2, of: 3 }, 200_000);
  assert.deepEqual(phaseSeconds(readPhaseLog(dir), 230_000), [
    { name: 'planning', seconds: 20 }, { name: 'development', seconds: 80 }, { name: 'qa', attempt: 1, seconds: 30 },
    { name: 'development', seconds: 70 }, { name: 'qa', attempt: 2, seconds: 30 },
  ]);
});

test('announcing the phase that is already running adds nothing, and a broken line is skipped', () => {
  const dir = fresh();
  assert.equal(recordPhase(dir, { phase: 'qa', attempt: 1 }, 1), true);
  assert.equal(recordPhase(dir, { phase: 'qa', attempt: 1 }, 2), false);
  writeFileSync(join(dir, 'phases.jsonl'), `${readFileSync(join(dir, 'phases.jsonl'), 'utf8')}not json\n`);
  assert.equal(readPhaseLog(dir).length, 1);
  assert.deepEqual(readPhaseLog(undefined), []);
});

test('progress.mjs records the phase and the class, and does nothing without its folder', () => {
  const dir = fresh();
  const env = { ...process.env, RELEVO_PROGRESS_DIR: dir };
  assert.equal(spawnSync('node', [PROGRESS, 'phase', 'development'], { env }).status, 0);
  assert.equal(spawnSync('node', [PROGRESS, 'class', 'qa-non-fixable'], { env }).status, 0);
  assert.equal(spawnSync('node', [PROGRESS, 'class', 'bogus'], { env }).status, 0);
  assert.deepEqual(readPhaseLog(dir).map((e) => e.phase), ['development']);
  assert.equal(readClass(dir), 'qa-non-fixable');
  const env2 = { ...process.env };
  delete env2.RELEVO_PROGRESS_DIR;
  assert.equal(spawnSync('node', [PROGRESS, 'class', 'built'], { env: env2 }).status, 0);
});

test('only the classes of the specification are written', () => {
  const dir = fresh();
  assert.deepEqual(OUTCOME_CLASSES, ['built', 'inputs', 'policy', 'qa-non-fixable', 'qa-fixable-after-retries', 'conflict', 'other']);
  assert.equal(writeClass(dir, 'nonsense'), false);
  assert.equal(readClass(dir), null);
});

test('Scenario: a built run with a retry - the marker lists the phases with their attempts and the class built', () => {
  const phases = [{ name: 'development', seconds: 80 }, { name: 'qa', attempt: 1, seconds: 30 }, { name: 'qa', attempt: 2, seconds: 25 }];
  const run = parseUsageMarker(bot(usageMarker(usage, { phases, outcomeClass: 'built' })));
  assert.equal(run.class, 'built');
  assert.deepEqual(run.phases.map((p) => [p.name, p.attempt, p.seconds]), [['development', null, 80], ['qa', 1, 30], ['qa', 2, 25]]);
});

test('Scenario: every class is kept, an unknown one is left out and the run still counts', () => {
  OUTCOME_CLASSES.forEach((c) => assert.equal(parseUsageMarker(bot(usageMarker(usage, { outcomeClass: c }))).class, c));
  const odd = parseUsageMarker(bot('<!-- relevo:usage {"turns":3,"class":"mystery","phases":[{"name":1}],"future":true} -->'));
  assert.equal(odd.turns, 3);
  assert.equal(odd.class, undefined);
  assert.equal(odd.phases, undefined);
});

test('Scenario: an old comment without phases or class is read as before', () => {
  const run = parseUsageMarker(bot('<!-- relevo:usage {"turns":4,"cost":0.2,"notional":false} -->'));
  assert.equal(run.turns, 4);
  assert.equal(run.class, undefined);
});

test('the visible sentence does not change when phases and class are added', () => {
  const plain = usageMarker(usage);
  const rich = usageMarker(usage, { phases: [{ name: 'qa', seconds: 1 }], outcomeClass: 'built' });
  assert.notEqual(plain, rich);
  assert.ok(rich.startsWith('<!-- relevo:usage {') && !rich.includes('\n'));
});

test('run-usage.mjs reads the folder of the run: phases and class in the marker, other when no class was written', () => {
  const dir = fresh();
  const log = join(dir, 'log.json');
  writeFileSync(log, JSON.stringify({ type: 'result', num_turns: 5, total_cost_usd: 0.5 }));
  recordPhase(dir, { phase: 'planning' }, Date.now() - 10_000);
  const out = spawnSync('node', [RUN_USAGE, '--file', log, '--progress-dir', dir], { encoding: 'utf8' }).stdout;
  const run = parseUsageMarker(bot(out.slice(out.indexOf('<!--'))));
  assert.equal(run.class, 'other');
  assert.equal(run.phases[0].name, 'planning');
  writeClass(dir, 'built');
  const built = spawnSync('node', [RUN_USAGE, '--file', log, '--progress-dir', dir], { encoding: 'utf8' }).stdout;
  assert.equal(parseUsageMarker(bot(built.slice(built.indexOf('<!--')))).class, 'built');
  const early = fresh();
  const ended = spawnSync('node', [RUN_USAGE, '--file', log, '--progress-dir', early], { encoding: 'utf8' }).stdout;
  assert.equal(parseUsageMarker(bot(ended.slice(ended.indexOf('<!--')))).class, 'other', 'a run that ended before any phase still has a class');
  const none = spawnSync('node', [RUN_USAGE, '--file', log], { encoding: 'utf8' }).stdout;
  assert.equal(parseUsageMarker(bot(none.slice(none.indexOf('<!--')))).class, undefined);
});

test('Scenario: a window with several outcomes and runs from before the records', () => {
  const summary = summarizeOutcomes([
    { class: 'built', phases: [{ name: 'qa', seconds: 30 }, { name: 'development', seconds: 70 }] },
    { class: 'inputs', phases: [{ name: 'planning', seconds: 5 }] },
    { class: 'qa-non-fixable', phases: [{ name: 'qa', seconds: 40 }] },
    { turns: 3 },
  ]);
  assert.deepEqual(summary.byClass, { built: 1, inputs: 1, 'qa-non-fixable': 1 });
  assert.deepEqual(summary.phaseSeconds, { qa: 70, development: 70, planning: 5 });
  assert.deepEqual([summary.withRecord, summary.withoutRecord], [3, 1]);
});
