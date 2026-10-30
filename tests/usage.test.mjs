import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseUsageMarker, reachedUsageLimit, readUsage, sumUsage, usageLine, usageMarker } from '../scripts/lib/run-usage.mjs';

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

test('Scenario: Another failure - rate-limit events that report allowed are not a limit', () => {
  const log = [
    { type: 'system', subtype: 'init' },
    { type: 'rate_limit_event', rate_limit_info: { status: 'allowed', rateLimitType: 'five_hour', utilization: 0.02 } },
    { type: 'rate_limit_event', rate_limit_info: { status: 'allowed_warning', rateLimitType: 'five_hour', utilization: 0.01 } },
    { type: 'result', subtype: 'success', is_error: false, result: 'The shell failed', num_turns: 2 },
  ];
  assert.equal(reachedUsageLimit(JSON.stringify(log)), false);
  assert.equal(reachedUsageLimit(log.map((e) => JSON.stringify(e)).join('\n')), false);
});

test('Scenario: Limit reached - a rejected rate-limit event or an error result about a limit is recognised', () => {
  const rejected = [{ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour' } }];
  assert.equal(reachedUsageLimit(JSON.stringify(rejected)), true);
  const failed = [
    { type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } },
    { type: 'result', is_error: true, result: 'You have reached your usage limit' },
  ];
  assert.equal(reachedUsageLimit(JSON.stringify(failed)), true);
  const notError = [{ type: 'result', is_error: false, result: 'I explained the usage limit of the API' }];
  assert.equal(reachedUsageLimit(JSON.stringify(notError)), false);
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

const figuresOf = (marker) => JSON.parse(/<!-- relevo:usage (\{.*\}) -->/.exec(marker)[1]);

test('Scenario: Log with usage - the marker carries the figures of the sentence, and says whether the cost is notional', () => {
  const usage = readUsage(ARRAY);
  assert.deepEqual(figuresOf(usageMarker(usage)), { turns: 37, cost: 1.8234, tokens: 123000, notional: false });
  assert.equal(figuresOf(usageMarker(usage, { subscription: true })).notional, true);
  const cached = readUsage(JSON.stringify({ type: 'result', num_turns: 2, usage: { output_tokens: 5, cache_read_input_tokens: 90 } }));
  assert.equal(figuresOf(usageMarker(cached)).cached, 90);
});

test('Scenario: Log with partial usage - what the log does not report is left out of the sentence and of the marker', () => {
  const usage = readUsage(JSON.stringify({ type: 'result', num_turns: 4 }));
  assert.equal(usageLine(usage), 'This run used 4 turns.');
  assert.deepEqual(figuresOf(usageMarker(usage)), { turns: 4, notional: false });
  assert.equal(usageMarker(null), '');
});

test('Scenario: Log without usage - no marker, and run-usage.mjs prints nothing', () => {
  assert.equal(usageMarker(readUsage('not json')), '');
  const none = spawnSync('node', [CLI('run-usage.mjs'), '--file', write('empty.json', JSON.stringify([{ type: 'assistant' }]))], { encoding: 'utf8' });
  assert.deepEqual([none.status, none.stdout], [0, '']);
});

test('run-usage.mjs prints the sentence, a blank line and the marker, with notional true under a subscription', () => {
  const run = (...flags) => spawnSync('node', [CLI('run-usage.mjs'), '--file', write('b.json', ARRAY), ...flags], { encoding: 'utf8' });
  const [sentence, blank, marker, ...rest] = run().stdout.split('\n');
  assert.match(sentence, /^This run used 37 turns/);
  assert.equal(blank, '');
  assert.deepEqual(figuresOf(marker), { turns: 37, cost: 1.8234, tokens: 123000, notional: false });
  assert.deepEqual(rest, ['']);
  assert.equal(figuresOf(run('--subscription').stdout).notional, true);
});

const comment = (body, extra = {}) => ({ user: { type: 'Bot' }, created_at: '2026-03-10T10:00:00Z', body, ...extra });
const M = (o) => `This run used 1 turn.\n\n<!-- relevo:usage ${JSON.stringify(o)} -->`;

test('Scenario: Digest with usage - the marker of a comment of a bot is read back with its date', () => {
  assert.deepEqual(parseUsageMarker(comment(M({ turns: 3, cost: 0.5, tokens: 100, notional: true }))), { created_at: '2026-03-10T10:00:00Z', notional: true, turns: 3, cost: 0.5, tokens: 100 });
  assert.equal(parseUsageMarker(comment(M({ turns: 0, cost: 0 }))).cost, 0, 'a zero is a figure');
  assert.equal(parseUsageMarker(comment(usageMarker(readUsage(ARRAY)))).turns, 37, 'what the script writes is what the digest reads');
});

test('Scenario: Runs without a marker - a person, a malformed marker, two markers or a string for a number count for nothing', () => {
  assert.equal(parseUsageMarker(comment(M({ turns: 3 }), { user: { type: 'User' } })), null, 'a person typed it');
  assert.equal(parseUsageMarker({ body: M({ turns: 3 }) }), null, 'no author');
  assert.equal(parseUsageMarker(comment('This run used 3 turns, about $0.50.')), null, 'the sentence alone is never read');
  assert.equal(parseUsageMarker(comment('<!-- relevo:usage {"turns": -->')), null);
  assert.equal(parseUsageMarker(comment('<!-- relevo:usage [1,2] -->')), null);
  assert.equal(parseUsageMarker(comment(`${M({ turns: 3 })}\n${M({ turns: 4 })}`)), null);
  assert.equal(parseUsageMarker(comment(M({ turns: '3' }))), null);
  assert.equal(parseUsageMarker(comment(M({ notional: true }))), null, 'no figure at all');
  assert.equal(parseUsageMarker(comment(null)), null);
});

test('sumUsage adds the figures over the runs that report each, and counts the notional costs', () => {
  const runs = [
    { turns: 10, cost: 1, tokens: 100, notional: true },
    { turns: 20, cost: 2, notional: true },
    { turns: 5, notional: false },
  ];
  assert.deepEqual(sumUsage(runs), { runs: 3, turns: 35, cost: 3, tokens: 100, costRuns: 2, notionalRuns: 2 });
  assert.deepEqual(sumUsage([{ turns: 1, cost: 0.5, notional: false }, { turns: 1, cost: 0.5, notional: true }]).notionalRuns, 1);
  assert.deepEqual(sumUsage([{ turns: 1, notional: false }]), { runs: 1, turns: 1, cost: null, tokens: null, costRuns: 0, notionalRuns: 0 });
  assert.equal(sumUsage([]).runs, 0);
});
