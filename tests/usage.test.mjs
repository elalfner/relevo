import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checksFromReceipt, limitsExceeded, parseUsageMarker, reachedUsageLimit, readUsage, runnerCut, sumUsage, usageLine, usageMarker } from '../scripts/lib/run-usage.mjs';

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

// ---- the turns of the subagents (specialist-review-lenses, task 9.1)
const lensNotice = (calls) => ({ type: 'system', subtype: 'task_notification', status: 'completed', usage: { total_tokens: 3000, tool_uses: calls, duration_ms: 5000 } });
const WITH_LENSES = JSON.stringify([{ type: 'system' }, lensNotice(3), lensNotice(0), { ...result, num_turns: 90 }]);

test('Scenario: Lenses use turns - the turns of the subagents are added to those of the run, and the sentence says so', () => {
  const usage = readUsage(WITH_LENSES);
  assert.equal(usage.subagentTurns, 5, 'tool_uses + 1 for each subagent: 4 and 1');
  assert.equal(usage.turns, 95);
  assert.match(usageLine(usage), /^This run used 95 turns \(5 by subagents\), about \$1\.82/);
});

test('a run without subagents is read as before, with no extra key', () => {
  assert.deepEqual(readUsage(ARRAY), { turns: 37, cost: 1.8234, tokens: 123000, cached: null });
});

test('Scenario: A runtime that does not count subagents - the limit is applied to the total and the sentence names it', () => {
  const usage = readUsage(WITH_LENSES);
  const limits = { run_max_turns: 92, run_max_cost: 5 };
  assert.deepEqual(limitsExceeded(usage, limits), [{ limit: 'limits.run_max_turns', used: 95, max: 92 }]);
  assert.match(usageLine(usage, { limits }), /It went past limits\.run_max_turns \(92\) with 95: the runner counts only the turns of the main agent/);
  assert.deepEqual(limitsExceeded(usage, { run_max_turns: 100, run_max_cost: 5 }), []);
  assert.doesNotMatch(usageLine(usage, { limits: { run_max_turns: 100, run_max_cost: 5 } }), /went past/);
  assert.deepEqual(limitsExceeded(readUsage(ARRAY), { run_max_cost: 1 }), [{ limit: 'limits.run_max_cost', used: 1.8234, max: 1 }]);
  assert.deepEqual(limitsExceeded(null, limits), []);
});

test('run-usage.mjs reads the limits from --config and says when a run went past them', () => {
  const log = write('lenses.json', WITH_LENSES);
  const cfg = write('relevo.yml', 'limits:\n  run_max_turns: 92\n');
  const r = spawnSync(process.execPath, [CLI('run-usage.mjs'), '--file', log, '--config', cfg], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /It went past limits\.run_max_turns \(92\) with 95/);
  const bad = spawnSync(process.execPath, [CLI('run-usage.mjs'), '--file', log, '--config', join(dir, 'missing.yml')], { encoding: 'utf8' });
  assert.equal(bad.status, 0, 'an unreadable config never fails the step');
  assert.match(bad.stdout, /95 turns/);
  assert.doesNotMatch(bad.stdout, /went past/);
});

// ---- the consumption by agent and by model (run-budget-and-rescue)
// A log shaped like a real run, with invented figures: a main agent on one model, a developer on the same model and one
// QA lens on another. Each message appears twice (one entry per content block), as in a real log.
const usageOf = (read, created = 0) => ({ input_tokens: 10, output_tokens: 3, cache_read_input_tokens: read, cache_creation_input_tokens: created, cache_creation: { ephemeral_5m_input_tokens: created, ephemeral_1h_input_tokens: 0 } });
const said = (id, model, parent, usage, content = [{ type: 'text', text: 'x' }]) => [1, 2].map(() => ({ type: 'assistant', parent_tool_use_id: parent, message: { id, model, usage, content } }));
const callOf = (id, input) => ({ type: 'tool_use', id, name: 'Agent', input });
function agentLog({ duplicates = true, withIds = true, modelUsage = true } = {}) {
  const lines = [
    ...said('m1', 'model-s', null, usageOf(100000, 4000), [callOf('toolu_dev', { subagent_type: 'relevo:dev', model: 'sonnet', effort: 'high' })]),
    { type: 'system', subtype: 'task_started', tool_use_id: 'toolu_dev', subagent_type: 'relevo:dev' },
    ...said('d1', 'model-s', 'toolu_dev', usageOf(300000)),
    ...said('d2', 'model-s', 'toolu_dev', usageOf(500000, 1000)),
    { type: 'system', subtype: 'task_notification', ...(withIds ? { tool_use_id: 'toolu_dev' } : {}), status: 'completed', usage: { total_tokens: 90000, tool_uses: 20, duration_ms: 600000 } },
    ...said('m2', 'model-s', null, usageOf(150000), [callOf('toolu_spec', { subagent_type: 'relevo:qa-spec', model: 'opus', effort: 'high' })]),
    { type: 'system', subtype: 'task_started', tool_use_id: 'toolu_spec', subagent_type: 'relevo:qa-spec' },
    ...said('q1', 'model-o', 'toolu_spec', usageOf(200000)),
    { type: 'system', subtype: 'task_notification', ...(withIds ? { tool_use_id: 'toolu_spec' } : {}), status: 'completed', usage: { total_tokens: 40000, tool_uses: 7, duration_ms: 120000 } },
    { type: 'result', subtype: 'success', num_turns: 5, total_cost_usd: 3, usage: { input_tokens: 40, output_tokens: 12 },
      ...(modelUsage ? { modelUsage: { 'model-s': { costUSD: 2 }, 'model-o': { costUSD: 1 } } } : {}) },
  ];
  return JSON.stringify(duplicates ? lines : lines.filter((e, i, a) => e.type !== 'assistant' || a.findIndex((o) => o.type === 'assistant' && o.message.id === e.message.id) === i));
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('Scenario: A run with subagents - each agent is listed with its model, effort, turns, minutes and an estimated cost', () => {
  const usage = readUsage(agentLog());
  assert.deepEqual(usage.models, [{ model: 'model-s', cost: 2 }, { model: 'model-o', cost: 1 }]);
  assert.deepEqual(usage.agents.map((a) => a.name), ['main', 'relevo:dev', 'relevo:qa-spec']);
  const [main, dev, spec] = usage.agents;
  assert.deepEqual([main.model, main.turns, main.seconds, main.effort], ['model-s', 5, undefined, undefined]);
  assert.deepEqual([dev.model, dev.effort, dev.turns, dev.seconds], ['model-s', 'high', 21, 600], 'tool calls plus the turn that gave the answer');
  assert.deepEqual([spec.model, spec.effort, spec.turns, spec.seconds], ['model-o', 'high', 8, 120]);
  // The only agent on the second model gets all its cost; the first is shared by the weighted input side of the messages.
  near(spec.cost, 1);
  const weight = (read, created = 0) => 10 + read * 0.1 + created * 1.25;
  const wMain = weight(100000, 4000) + weight(150000);
  const wDev = weight(300000) + weight(500000, 1000);
  near(main.cost, 2 * (wMain / (wMain + wDev)));
  near(dev.cost, 2 * (wDev / (wMain + wDev)));
});

test('Scenario: The costs add up - the estimates of the agents of a model equal the real cost of that model', () => {
  const usage = readUsage(agentLog());
  near(usage.agents.reduce((t, a) => t + a.cost, 0), usage.models.reduce((t, m) => t + m.cost, 0));
});

test('a message that the log repeats for each content block counts once', () => {
  const doubled = readUsage(agentLog({ duplicates: true }));
  const single = readUsage(agentLog({ duplicates: false }));
  doubled.agents.forEach((a, i) => near(a.cost, single.agents[i].cost));
});

test('Scenario: The sentence lists the agents and the real cost of each model', () => {
  const line = usageLine(readUsage(agentLog()));
  assert.match(line, /By agent: main \(model-s\) 5 turns, about \$0\.\d\d; relevo:dev \(model-s, high\) 21 turns, 10\.0 min, about \$1\.\d\d; relevo:qa-spec \(model-o, high\) 8 turns, 2\.0 min, about \$1\.00\./);
  assert.match(line, /Cost by model: model-s \$2\.00, model-o \$1\.00\.$/);
});

test('Scenario: A log without the details - the comment and the marker are the same as before', () => {
  assert.equal(readUsage(ARRAY).agents, undefined);
  assert.equal(readUsage(ARRAY).models, undefined);
  assert.equal(usageLine(readUsage(ARRAY)), 'This run used 37 turns, about $1.82, 123,000 tokens.');
  // The subagents are there but their calls have no id to join on, and no model costs: only the totals are said.
  const bare = readUsage(agentLog({ withIds: false, modelUsage: false }));
  assert.equal(bare.agents, undefined);
  assert.equal(bare.models, undefined);
  assert.doesNotMatch(usageLine(bare), /By agent|Cost by model/);
  // The model costs without subagents: the cost by model is said, the agents are not.
  const onlyModels = readUsage(JSON.stringify({ type: 'result', num_turns: 3, total_cost_usd: 1, modelUsage: { 'model-s': { costUSD: 1 } } }));
  assert.deepEqual(onlyModels.models, [{ model: 'model-s', cost: 1 }]);
  assert.equal(onlyModels.agents, undefined);
});

test('Scenario: The marker is read by the digest - it carries agents and models, the totals are read as before, and a malformed key is left out', () => {
  const usage = readUsage(agentLog());
  const marker = usageMarker(usage, { subscription: true });
  const bot = (body) => ({ user: { type: 'Bot' }, body, created_at: '2026-11-04T10:00:00Z' });
  const run = parseUsageMarker(bot(marker));
  assert.equal(run.turns, usage.turns);
  assert.equal(run.cost, 3);
  assert.deepEqual(run.models, [{ model: 'model-s', cost: 2 }, { model: 'model-o', cost: 1 }]);
  assert.deepEqual(run.agents.map((a) => a.name), ['main', 'relevo:dev', 'relevo:qa-spec']);
  assert.equal(run.agents[1].turns, 21);
  const totals = sumUsage([run, run]);
  assert.equal(totals.cost, 6, 'the digest adds up the totals and ignores the new keys');
  const broken = marker.replace('"turns":21', '"turns":"many"');
  const read = parseUsageMarker(bot(broken));
  assert.equal(read.agents, undefined, 'one malformed agent leaves the key out');
  assert.equal(read.cost, 3, 'the totals are still read');
  assert.equal(parseUsageMarker(bot(usageMarker(readUsage(ARRAY)))).agents, undefined);
});

// ---- which limit of the runner cut the run
test('Scenario: A limit of the runner - the result of the log says whether it was the turn limit or the cost limit', () => {
  assert.equal(runnerCut(JSON.stringify([{ type: 'system' }, { type: 'result', subtype: 'error_max_turns', num_turns: 100 }])), 'turns');
  assert.equal(runnerCut(JSON.stringify([{ type: 'result', subtype: 'error_max_budget_usd', total_cost_usd: 5 }])), 'cost');
  assert.equal(runnerCut(LINES), null, 'a result that succeeded');
  assert.equal(runnerCut(JSON.stringify([{ type: 'result', subtype: 'error_during_execution' }])), null, 'another error is not a limit');
});

test('Scenario: The log does not say - nothing is named, and the command never fails', () => {
  ['', 'not json', JSON.stringify([{ type: 'assistant' }]), undefined].forEach((t) => assert.equal(runnerCut(t), null));
  const cli = (args, text) => {
    const file = text === undefined ? [] : ['--file', write('cut.json', text)];
    return spawnSync(process.execPath, [CLI('run-cut.mjs'), ...file, ...args], { encoding: 'utf8' });
  };
  const turns = cli([], JSON.stringify([{ type: 'result', subtype: 'error_max_turns' }]));
  assert.equal(turns.status, 0);
  assert.equal(turns.stdout.trim(), 'turns');
  assert.equal(cli([], JSON.stringify([{ type: 'result', subtype: 'error_max_budget_usd' }])).stdout.trim(), 'cost');
  const none = cli([], 'garbled');
  assert.equal(none.status, 0, 'exit 0 so that $(...) under bash -e does not stop the step');
  assert.equal(none.stdout.trim(), '');
  assert.equal(cli([], undefined).status, 0, 'no file at all');
});

const RECEIPT = JSON.stringify({ status: 'green', commands: [{ name: 'analyze', duration_ms: 12400, exit_code: 0 }, { name: 'test', duration_ms: 0, original_duration_ms: 454000, reused: true, exit_code: 0 }] });

test('Scenario: A run ends - the comment shows the seconds per check, with reused where the gate did not run it', () => {
  const checks = checksFromReceipt(RECEIPT);
  assert.deepEqual(checks, [{ name: 'analyze', seconds: 12 }, { name: 'test', seconds: 0, reused: true, original: 454 }]);
  assert.match(usageLine(readUsage(ARRAY), { checks }), / Checks of the gate: analyze 12s, test reused \(454s when it ran\)\./);
  assert.deepEqual(JSON.parse(usageMarker(readUsage(ARRAY), { checks }).match(/\{.*\}/)[0]).checks, checks);
});

test('Scenario: No receipt - the comment is as it was, and a damaged receipt adds nothing', () => {
  assert.equal(usageLine(readUsage(ARRAY), { checks: checksFromReceipt(null) }), 'This run used 37 turns, about $1.82, 123,000 tokens.');
  assert.equal(checksFromReceipt('not json'), null);
  assert.equal(checksFromReceipt(JSON.stringify({ commands: [{ name: 'Bad Name!', duration_ms: 5 }, { name: 'x', duration_ms: 'a' }] })), null);
  assert.equal(JSON.parse(usageMarker(readUsage(ARRAY), {}).match(/\{.*\}/)[0]).checks, undefined);
});

test('The command reads the receipt of the working folder, or the one it is given', () => {
  const log = write('exec-checks.json', ARRAY);
  const receipt = write('receipt-checks.json', RECEIPT);
  const empty = mkdtempSync(join(tmpdir(), 'relevo-usage-'));
  const run = (cwd, ...extra) => spawnSync('node', [CLI('run-usage.mjs'), '--file', log, ...extra], { cwd, encoding: 'utf8' });
  assert.match(run(empty, '--receipt', receipt).stdout, /Checks of the gate: analyze 12s/);
  assert.doesNotMatch(run(empty).stdout, /Checks of the gate/);
  assert.equal(run(empty, '--receipt', join(empty, 'missing.json')).status, 0);
});
