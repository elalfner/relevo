import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reachedUsageLimit, readUsage, usageLine } from '../scripts/lib/run-usage.mjs';

const dir = mkdtempSync(join(tmpdir(), 'relevo-usage-'));
const write = (name, text) => { writeFileSync(join(dir, name), text); return join(dir, name); };
const result = { type: 'result', subtype: 'success', num_turns: 37, total_cost_usd: 1.8234, usage: { input_tokens: 90000, output_tokens: 33000 } };
const ARRAY = JSON.stringify([{ type: 'system' }, { type: 'assistant', message: 'x' }, result]);
const LINES = [{ type: 'system' }, result].map((e) => JSON.stringify(e)).join('\n');
const CLI = (script) => new URL(`../scripts/${script}`, import.meta.url).pathname;

test('Scenario: Log with usage - turns, cost and tokens are read from a JSON array, from JSON lines and from a single object', () => {
  const expected = { turns: 37, cost: 1.8234, tokens: 123000, cached: null };
  assert.deepEqual(readUsage(ARRAY), expected);
  assert.deepEqual(readUsage(LINES), expected);
  assert.deepEqual(readUsage(JSON.stringify(result)), expected);
  assert.equal(usageLine(readUsage(ARRAY)), 'This run used 37 turns, about $1.82, 123,000 tokens.');
});

test('the last result wins, and a result without tokens or cost still reports the turns', () => {
  const two = JSON.stringify([result, { type: 'result', num_turns: 1 }]);
  assert.equal(usageLine(readUsage(two)), 'This run used 1 turn.');
  assert.deepEqual(readUsage(JSON.stringify([{ type: 'result', usage: { output_tokens: 5 } }])), { turns: null, cost: null, tokens: 5, cached: null });
});

test('Scenario: Log without usage - missing, empty, garbled or without a result gives nothing', () => {
  ['', '   ', 'not json at all', JSON.stringify([{ type: 'assistant' }]), JSON.stringify({ type: 'result' }), null, undefined].forEach((t) => {
    assert.equal(readUsage(t), null);
    assert.equal(usageLine(readUsage(t)), '');
  });
});

test('with a subscription the cost is said to be notional', () => {
  assert.match(usageLine(readUsage(ARRAY), { subscription: true }), /about \$1\.82 \(notional: a subscription is not billed per run\)/);
});

test('run-usage.mjs prints the line, prints nothing for an unreadable file, and always exits 0', () => {
  const ok = spawnSync('node', [CLI('run-usage.mjs'), '--file', write('a.json', ARRAY), '--subscription'], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /37 turns.*notional.*123,000 tokens/);
  const missing = spawnSync('node', [CLI('run-usage.mjs'), '--file', join(dir, 'nope.json')], { encoding: 'utf8' });
  assert.deepEqual([missing.status, missing.stdout], [0, '']);
  assert.deepEqual([spawnSync('node', [CLI('run-usage.mjs')], { encoding: 'utf8' }).status], [0]);
});

test('Scenario: Limit reached - the log of a failed run is recognised, in an array, in lines or as plain text', () => {
  assert.equal(reachedUsageLimit(JSON.stringify([{ type: 'result', is_error: true, result: 'Claude AI usage limit reached|1760000000' }])), true);
  assert.equal(reachedUsageLimit('Your credit balance is too low to access the Anthropic API'), true);
  assert.equal(reachedUsageLimit('429 rate_limit_error: this request would exceed your rate limit'), true);
  assert.equal(reachedUsageLimit('You exceeded your current quota'), true);
});

test('Scenario: Another failure - a log without such text is not a limit', () => {
  assert.equal(reachedUsageLimit(ARRAY), false);
  assert.equal(reachedUsageLimit('flutter analyze reported 3 errors'), false);
  assert.equal(reachedUsageLimit(''), false);
  assert.equal(reachedUsageLimit(undefined), false);
});

test('usage-limit.mjs exits 0 for a limit and 1 for anything else, including a missing file', () => {
  const run = (...args) => spawnSync('node', [CLI('usage-limit.mjs'), ...args], { encoding: 'utf8' }).status;
  assert.equal(run('--file', write('limit.txt', 'Claude AI usage limit reached')), 0);
  assert.equal(run('--file', write('fine.txt', 'all fine')), 1);
  assert.equal(run('--file', join(dir, 'missing')), 1);
  assert.equal(run(), 1);
});

test('tokens served from the prompt cache are reported apart, so a long run does not look tiny', () => {
  const log = JSON.stringify({ type: 'result', num_turns: 14, total_cost_usd: 0.43, usage: { input_tokens: 40, output_tokens: 5231, cache_read_input_tokens: 400000, cache_creation_input_tokens: 20000 } });
  assert.equal(readUsage(log).cached, 420000);
  assert.equal(usageLine(readUsage(log)), 'This run used 14 turns, about $0.43, 5,271 tokens (plus 420,000 from the cache).');
  assert.doesNotMatch(usageLine(readUsage(ARRAY)), /cache/, 'nothing about the cache when the log has none');
});
