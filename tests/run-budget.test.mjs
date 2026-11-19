import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetStatus, readLedger, recordAgent, subagentTurns, wholeNumber } from '../scripts/lib/run-budget.mjs';
import { recordPhase } from '../scripts/lib/phase-log.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/run-budget.mjs', import.meta.url));
const progress = () => mkdtempSync(join(tmpdir(), 'relevo-budget-'));
const run = (dir, args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, ...(dir ? { RELEVO_PROGRESS_DIR: dir } : { RELEVO_PROGRESS_DIR: '' }) }, cwd: mkdtempSync(join(tmpdir(), 'relevo-budget-cwd-')) });
const check = (dir, args = []) => {
  const r = run(dir, ['check', ...args]);
  return { code: r.status, json: JSON.parse(r.stdout.trim()) };
};
const record = (dir, agent, toolUses, extra = []) => run(dir, ['record', '--agent', agent, '--tool-uses', String(toolUses), ...extra]);

test('wholeNumber accepts only non-negative whole numbers', () => {
  assert.equal(wholeNumber('12'), 12);
  assert.equal(wholeNumber(' 7 '), 7);
  assert.equal(wholeNumber(0), 0);
  ['1.5', '-3', '12abc', '', 'abc', undefined, null, '1e3', '99999999999999'].forEach((v) => assert.equal(wholeNumber(v), null, String(v)));
});

test('Scenario: The run is within its limits - nothing stops and the turns of the subagents are counted', () => {
  const dir = progress();
  assert.equal(record(dir, 'relevo:dev', 66, ['--duration-ms', '1360760', '--tokens', '197794']).status, 0);
  assert.equal(record(dir, 'relevo:qa-spec', 21).status, 0);
  const { code, json } = check(dir, ['--max-turns', '100', '--max-minutes', '50']);
  assert.equal(code, 0);
  assert.equal(json.known, true);
  assert.equal(json.stop, false);
  assert.equal(json.subagent_turns, 67 + 22, 'tool calls plus the turn that gave the answer, for each agent');
  assert.deepEqual(json.agents, ['relevo:dev', 'relevo:qa-spec']);
});

test('Scenario: The turns of the subagents reach the limit between two lenses - the check says stop and exits 1', () => {
  const dir = progress();
  record(dir, 'relevo:dev', 66);
  record(dir, 'relevo:qa-spec', 21);
  assert.equal(check(dir, ['--max-turns', '100']).code, 0, '89 turns of 100');
  record(dir, 'relevo:qa-security', 10);
  const { code, json } = check(dir, ['--max-turns', '100']);
  assert.equal(code, 1, '100 turns reach a limit of 100');
  assert.equal(json.stop, true);
  assert.equal(json.reason, 'turns');
  assert.equal(json.subagent_turns, 100);
});

test('Scenario: The time of the run reaches its limit before a retry - the check says minutes', () => {
  const dir = progress();
  const now = Date.now();
  recordPhase(dir, { phase: 'planning' }, now - 51 * 60000);
  recordPhase(dir, { phase: 'development' }, now - 50 * 60000);
  const { code, json } = check(dir, ['--max-turns', '100', '--max-minutes', '50']);
  assert.equal(code, 1);
  assert.equal(json.reason, 'minutes');
  assert.ok(json.elapsed_minutes >= 51);
  const young = progress();
  recordPhase(young, { phase: 'planning' }, now - 10 * 60000);
  assert.equal(check(young, ['--max-minutes', '50']).code, 0);
});

test('Scenario: The guard cannot read its inputs - it says it does not know and nothing stops', () => {
  const none = check(null, ['--max-turns', '1', '--max-minutes', '5']);
  assert.equal(none.code, 0);
  assert.equal(none.json.known, false);
  assert.equal(none.json.stop, false);
  // No phase log: the minutes cannot be judged, the turns still can.
  const dir = progress();
  record(dir, 'relevo:dev', 5);
  const noClock = check(dir, ['--max-turns', '100', '--max-minutes', '1']);
  assert.equal(noClock.code, 0);
  assert.equal(noClock.json.elapsed_minutes, null);
  // A damaged ledger: bad lines are skipped, the good ones count.
  const damaged = progress();
  writeFileSync(join(damaged, 'budget.jsonl'), 'not json\n{"agent":"a b","tool_uses":3}\n{"agent":"relevo:dev","tool_uses":-1}\n');
  appendFileSync(join(damaged, 'budget.jsonl'), `${JSON.stringify({ agent: 'relevo:dev', tool_uses: 4, at: 1 })}\n`);
  assert.deepEqual(readLedger(damaged).map((e) => e.tool_uses), [4]);
  assert.equal(check(damaged, ['--max-turns', '100']).json.subagent_turns, 5);
});

test('Scenario: Only numbers are recorded - a figure that is not a whole number writes nothing', () => {
  const dir = progress();
  ['1.5', 'abc', '-2', '3; rm -rf /', ''].forEach((v) => assert.equal(record(dir, 'relevo:dev', v).status, 0, `${v}: the command itself never fails`));
  assert.equal(record(dir, 'bad agent name', 3).status, 0);
  assert.equal(record(dir, 'relevo:dev', 2, ['--tokens', 'lots']).status, 0, 'a bad optional figure is left out, the call is kept');
  assert.deepEqual(readLedger(dir).map((e) => [e.agent, e.tool_uses, e.tokens]), [['relevo:dev', 2, null]]);
  assert.equal(recordAgent(dir, { agent: 'relevo:dev', toolUses: '7' }), true);
  assert.equal(recordAgent(null, { agent: 'relevo:dev', toolUses: 7 }), false, 'no folder, no ledger');
});

test('the limits come from relevo.yml when no flag gives them, and a flag wins over the file', () => {
  const dir = progress();
  record(dir, 'relevo:dev', 49);
  const cwd = mkdtempSync(join(tmpdir(), 'relevo-budget-cfg-'));
  writeFileSync(join(cwd, 'relevo.yml'), 'limits:\n  run_max_cost: 5\n  run_max_turns: 50\n');
  const asked = (args) => {
    const r = spawnSync(process.execPath, [SCRIPT, 'check', ...args], { encoding: 'utf8', env: { ...process.env, RELEVO_PROGRESS_DIR: dir }, cwd });
    return { code: r.status, json: JSON.parse(r.stdout.trim()) };
  };
  assert.equal(asked([]).code, 1, '50 turns reach the 50 of the file');
  assert.equal(asked(['--max-turns', '80']).code, 0, 'the flag wins');
});

test('Scenario: an option that is not a whole number is ignored, and the guard says so in notes', () => {
  const dir = progress();
  const cwd = mkdtempSync(join(tmpdir(), 'relevo-budget-flag-'));
  writeFileSync(join(cwd, 'relevo.yml'), 'limits:\n  run_max_cost: 5\n  run_max_minutes: 40\n');
  const asked = (args) => JSON.parse(spawnSync(process.execPath, [SCRIPT, 'check', ...args], { encoding: 'utf8', env: { ...process.env, RELEVO_PROGRESS_DIR: dir }, cwd }).stdout.trim());
  const decimal = asked(['--max-minutes', '7.5']);
  assert.equal(decimal.max_minutes, 40, 'the value of relevo.yml applies');
  assert.equal(decimal.stop, false);
  assert.equal(decimal.notes.length, 1);
  assert.match(decimal.notes[0], /ignored --max-minutes "7\.5": it is not a whole number/);
  assert.deepEqual(asked(['--max-minutes', '9']).notes, [], 'a whole number says nothing');
});

test('Scenario: a relevo.yml that does not validate does not switch the limits off in silence', () => {
  const dir = progress();
  const cwd = mkdtempSync(join(tmpdir(), 'relevo-budget-bad-'));
  writeFileSync(join(cwd, 'relevo.yml'), 'limits:\n  run_max_cost: 5\n  run_max_minutes: 3\n');
  const r = spawnSync(process.execPath, [SCRIPT, 'check'], { encoding: 'utf8', env: { ...process.env, RELEVO_PROGRESS_DIR: dir }, cwd });
  const json = JSON.parse(r.stdout.trim());
  assert.equal(r.status, 0, 'it still fails open');
  assert.equal(json.max_minutes, null);
  assert.equal(json.notes.length, 1);
  assert.match(json.notes[0], /^config_invalid: .*relevo\.yml does not validate, so its limits were not read \(limits\.run_max_minutes\)/);
});

test('an unknown command exits 2, and subagentTurns of nothing is 0', () => {
  assert.equal(run(progress(), ['wander']).status, 2);
  assert.equal(subagentTurns([]), 0);
  assert.equal(budgetStatus({ dir: null }).known, false);
});
